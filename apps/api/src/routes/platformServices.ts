import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { timingSafeCompare } from '../services/securityConfig';
import {
  toDecimal,
  getRebarUnitWeight,
  calculateRebarCutLengthMeters,
  evaluateRmcTransitStatus,
  evaluateRmcSlumpTolerance,
  getStructuralSteelSection,
  calculateStructuralMemberTotals,
  calculateSoilCompaction,
  evaluateAsphaltThermalQuality,
  calculateAsphaltCoreCompaction,
  calculateSimpsonsArea,
  calculatePrismoidalVolume,
  calculateEarthworkBalancing,
  calculateEconomicHaul,
  evaluateFuelSiphoningAnomaly,
  evaluatePlantCanBusDiagnostics,
  calculateInspectionProgressVariance,
  evaluateTenderBids,
} from '@construction/money';
import {
  InitiateMpesaStkPushSchema,
  ProcessMpesaCallbackSchema,
  CreateProjectGeofenceSchema,
  RecordWorkerClockInSchema,
  RegisterTelematicsDeviceSchema,
  IngestTelematicsPingSchema,
  RegisterCanBusTelematicsDeviceSchema,
  IngestCanBusTelematicsPingSchema,
  AcknowledgeMaintenanceAlertSchema,
  CreateBarBendingScheduleSchema,
  UpdateBarBendingScheduleStatusSchema,
  InitiateB2CDisbursementSchema,
  ProcessB2CCallbackSchema,
  CreateRmcBatchDeliverySchema,
  RecordRmcSlumpTestSchema,
  UpdateRmcDischargeSchema,
  CreateStructuralSteelTakeoffSchema,
  CreateGeotechnicalSoilTestSchema,
  CreateAsphaltPavementBatchSchema,
  RecordAsphaltCoreTestSchema,
  CreateTopographicSurveySchema,
  CreateIndependentInspectionSchema,
  SubmitInspectionFindingsSchema,
  ReviewInspectionSchema,
  CreateProjectTenderSchema,
  SubmitTenderBidSchema,
  AwardTenderBidSchema,
} from '@construction/validation';
import * as crypto from 'crypto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rate limiter for M-Pesa STK push requests (prevents toll fraud and flooding)
const MAX_STK_PUSH_PER_WINDOW = 10;
const STK_PUSH_WINDOW_MS = 5 * 60 * 1000; // 5-minute sliding window
const tenantStkPushMap = new Map<string, { count: number; resetAt: number }>();

// Rate limiter for Daraja B2C disbursement requests (prevents automated drain attacks and outbound flooding)
const MAX_B2C_DISBURSE_PER_WINDOW = 10;
const B2C_DISBURSE_WINDOW_MS = 5 * 60 * 1000; // 5-minute sliding window
const tenantB2CDisburseMap = new Map<string, { count: number; resetAt: number }>();

// Cleanup stale rate limit records
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of tenantStkPushMap.entries()) {
    if (now > entry.resetAt) {
      tenantStkPushMap.delete(id);
    }
  }
  for (const [id, entry] of tenantB2CDisburseMap.entries()) {
    if (now > entry.resetAt) {
      tenantB2CDisburseMap.delete(id);
    }
  }
}, 60 * 1000).unref();

// Haversine Distance Helper in Meters
function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const platformServicesRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // ===========================================================================
  // MODULE 1: SAFARICOM DARAJA M-PESA SUBSCRIPTION BILLING (M22 / ADR-006)
  // ===========================================================================

  // 1.1 Get Tenant Subscription Status
  server.get(
    '/api/v1/billing/subscription-status',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const tenant = await tx.tenant.findFirst({ where: { id: tenantId } });
          if (!tenant) throw { status: 404, message: 'Tenant not found' };

          const latestTx = await tx.mpesaSubscriptionTransaction.findFirst({
            where: { tenant_id: tenantId, transaction_status: 'SUCCESS' },
            orderBy: { created_at: 'desc' },
          });

          const now = new Date();
          let subscriptionState = 'TRIAL';
          let activePlan = 'PROJECT_TIER';
          let daysRemaining = 14;

          if (latestTx && latestTx.subscription_period_end) {
            const endDate = new Date(latestTx.subscription_period_end);
            activePlan = latestTx.plan_code;
            if (endDate > now) {
              subscriptionState = 'ACTIVE';
              daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24)));
            } else if (now.getTime() - endDate.getTime() < 7 * 86400000) {
              subscriptionState = 'GRACE_PERIOD';
              daysRemaining = 0;
            } else {
              subscriptionState = 'SUSPENDED';
              daysRemaining = 0;
            }
          }

          return {
            tenantId,
            tenantName: tenant.name,
            subscriptionState,
            activePlan,
            monthlyFeeKes: activePlan === 'PORTFOLIO_TIER' ? '25000.00' : '7500.00',
            daysRemaining,
            currentActiveProjectsCount: 1,
            maxAllowedProjects: activePlan === 'PORTFOLIO_TIER' ? 999 : 1,
            lastPaymentRef: latestTx?.mpesa_receipt_number || null,
            subscriptionPeriodEnd: latestTx?.subscription_period_end?.toISOString() || null,
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 1.2 Initiate Lipa Na M-Pesa Online (STK Push)
  server.post(
    '/api/v1/billing/mpesa-express',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;

      // Rate limit check
      const now = Date.now();
      const stkLimit = tenantStkPushMap.get(tenantId);
      if (stkLimit && now < stkLimit.resetAt && stkLimit.count >= MAX_STK_PUSH_PER_WINDOW) {
        const retryAfterSeconds = Math.ceil((stkLimit.resetAt - now) / 1000);
        reply.header('Retry-After', retryAfterSeconds);
        return reply.status(429).send({
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Too many M-Pesa STK push requests. Please wait before initiating another request.',
        });
      }

      if (!stkLimit || now > stkLimit.resetAt) {
        tenantStkPushMap.set(tenantId, { count: 1, resetAt: now + STK_PUSH_WINDOW_MS });
      } else {
        stkLimit.count += 1;
      }

      const parseResult = InitiateMpesaStkPushSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid M-Pesa STK push input',
          details: parseResult.error.flatten(),
        });
      }

      const { phoneNumber, planCode, amount } = parseResult.data;

      // Format Safaricom Daraja phone number (2547...)
      let formattedPhone = phoneNumber.replace(/\+/g, '').replace(/\s+/g, '');
      if (formattedPhone.startsWith('0')) {
        formattedPhone = `254${formattedPhone.slice(1)}`;
      }

      const checkoutReqId = `ws_CO_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const merchantReqId = `MR_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const transaction = await tx.mpesaSubscriptionTransaction.create({
            data: {
              tenant_id: tenantId,
              phone_number: formattedPhone,
              amount: toDecimal(amount).toFixed(2),
              merchant_request_id: merchantReqId,
              checkout_request_id: checkoutReqId,
              plan_code: planCode,
              transaction_status: 'INITIATED',
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'MPESA_SUBSCRIPTION',
            entityId: transaction.id,
            changes: {
              planCode,
              amount,
              phone: formattedPhone,
              checkoutReqId,
            },
          });

          return {
            transactionId: transaction.id,
            merchantRequestId: merchantReqId,
            checkoutRequestId: checkoutReqId,
            responseCode: '0',
            responseDescription: 'Success. Request accepted for processing',
            customerMessage: `STK push dispatched to ${formattedPhone}. Enter M-Pesa PIN on handset to authorize KES ${amount}.`,
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 1.3 Inbound Daraja M-Pesa Callback Webhook (C1 Hardened)
  server.post(
    '/api/v1/billing/mpesa-callback',
    async (request, reply) => {
      // 1. Mandatory Webhook Secret Authentication with Constant-Time Comparison (C1 & 2a)
      const authHeader =
        (request.headers['x-mpesa-webhook-token'] as string) ||
        (request.headers['authorization'] as string)?.replace(/^Bearer\s+/i, '');
      const expectedSecret = process.env.MPESA_WEBHOOK_SECRET;
      if (!authHeader || !timingSafeCompare(authHeader, expectedSecret)) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid or missing M-Pesa webhook authentication token',
        });
      }

      // Normalize Safaricom Daraja nested callback format if present
      let rawPayload: any = request.body;
      if (rawPayload?.Body?.stkCallback) {
        const stk = rawPayload.Body.stkCallback;
        const items = stk.CallbackMetadata?.Item || [];
        const receiptItem = items.find((i: any) => i.Name === 'MpesaReceiptNumber');
        const phoneItem = items.find((i: any) => i.Name === 'PhoneNumber');
        const dateItem = items.find((i: any) => i.Name === 'TransactionDate');
        rawPayload = {
          MerchantRequestID: stk.MerchantRequestID,
          CheckoutRequestID: stk.CheckoutRequestID,
          ResultCode: stk.ResultCode,
          ResultDesc: stk.ResultDesc,
          MpesaReceiptNumber: receiptItem ? String(receiptItem.Value) : undefined,
          PhoneNumber: phoneItem ? String(phoneItem.Value) : undefined,
          TransactionDate: dateItem ? String(dateItem.Value) : undefined,
        };
      }

      const parseResult = ProcessMpesaCallbackSchema.safeParse(rawPayload);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid M-Pesa callback payload',
          details: parseResult.error.flatten(),
        });
      }

      const { CheckoutRequestID, ResultCode, ResultDesc, MpesaReceiptNumber } = parseResult.data;

      // 2. Cryptographic / Database Bound Tenant Context Resolution (C1 & 2b)
      // Do NOT trust tenantId from header or query. Resolve tenant from transaction record via SECURITY DEFINER function.
      const matchedRows = await prisma.$queryRaw<any[]>`
        SELECT * FROM lookup_mpesa_stk_transaction(${CheckoutRequestID}::text);
      `;

      if (matchedRows.length === 0) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `CheckoutRequestID ${CheckoutRequestID} not found in database`,
        });
      }

      const existingTx = matchedRows[0];
      // Bind tenantId strictly from the database record; ignore any untrusted client-supplied header or query parameter (C1 & 2b)
      const tenantId = existingTx.tenant_id;

      try {
        const isSuccess = ResultCode === 0;
        if (isSuccess && !MpesaReceiptNumber) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'MpesaReceiptNumber is mandatory for successful payment callbacks',
          });
        }

        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 86400000);

        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const res = await tx.mpesaSubscriptionTransaction.update({
            where: { id: existingTx.id },
            data: {
              transaction_status: isSuccess ? 'SUCCESS' : 'FAILED',
              result_code: ResultCode,
              result_desc: ResultDesc,
              mpesa_receipt_number: isSuccess ? MpesaReceiptNumber : null,
              subscription_period_start: isSuccess ? now : null,
              subscription_period_end: isSuccess ? periodEnd : null,
            },
          });

          return res;
        });

        return reply.status(200).send({
          result: 'Callback processed successfully',
          status: updated.transaction_status,
          receiptNumber: updated.mpesa_receipt_number,
          mpesaReceiptNumber: updated.mpesa_receipt_number,
          tenantId,
        });
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 1.4 List Billing Transactions
  server.get(
    '/api/v1/billing/transactions',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const transactions = await tx.mpesaSubscriptionTransaction.findMany({
            where: { tenant_id: tenantId },
            orderBy: { created_at: 'desc' },
          });

          return {
            totalTransactions: transactions.length,
            transactions: transactions.map((t) => ({
              id: t.id,
              phoneNumber: t.phone_number,
              amount: toDecimal(t.amount.toString()).toFixed(2),
              planCode: t.plan_code,
              mpesaReceiptNumber: t.mpesa_receipt_number,
              transactionStatus: t.transaction_status,
              subscriptionPeriodStart: t.subscription_period_start?.toISOString() || null,
              subscriptionPeriodEnd: t.subscription_period_end?.toISOString() || null,
              createdAt: t.created_at.toISOString(),
            })),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // ===========================================================================
  // MODULE 2: PROJECT GEOFENCING & BIOMETRIC CLOCK-IN ENGINE (M23)
  // ===========================================================================

  // 2.1 List Project Geofences
  server.get(
    '/api/v1/projects/:projectId/geofences',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const geofences = await tx.projectGeofence.findMany({
            where: { project_id: projectId },
            orderBy: { created_at: 'desc' },
          });

          return {
            projectId,
            geofences: geofences.map((g) => ({
              id: g.id,
              geofenceName: g.geofence_name,
              centerLatitude: toDecimal(g.center_latitude.toString()).toFixed(6),
              centerLongitude: toDecimal(g.center_longitude.toString()).toFixed(6),
              radiusMeters: toDecimal(g.radius_meters.toString()).toFixed(2),
              isActive: g.is_active,
              createdAt: g.created_at.toISOString(),
            })),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 2.2 Create / Update Project Geofence
  server.post(
    '/api/v1/projects/:projectId/geofences',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateProjectGeofenceSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid geofence input',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const geofence = await tx.projectGeofence.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              geofence_name: data.geofenceName,
              center_latitude: toDecimal(data.centerLatitude).toFixed(6),
              center_longitude: toDecimal(data.centerLongitude).toFixed(6),
              radius_meters: toDecimal(data.radiusMeters).toFixed(2),
              is_active: true,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'PROJECT_GEOFENCE',
            entityId: geofence.id,
            projectId,
            changes: {
              name: geofence.geofence_name,
              radius: geofence.radius_meters.toString(),
            },
          });

          return {
            id: geofence.id,
            geofenceName: geofence.geofence_name,
            centerLatitude: toDecimal(geofence.center_latitude.toString()).toFixed(6),
            centerLongitude: toDecimal(geofence.center_longitude.toString()).toFixed(6),
            radiusMeters: toDecimal(geofence.radius_meters.toString()).toFixed(2),
            isActive: geofence.is_active,
          };
        });

        return reply.status(201).send(result);
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A soil test with this test number already exists for this project',
          });
        }
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 2.3 Record Worker Mobile Clock-in / Out with Geofence Verification
  server.post(
    '/api/v1/projects/:projectId/clock-in',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = RecordWorkerClockInSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid worker clock-in input',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const laborer = await tx.siteLaborer.findFirst({
            where: { id: data.laborerId, project_id: projectId },
          });
          if (!laborer) throw { status: 404, message: 'Site laborer not found in this project' };

          // Retrieve active project geofence
          const geofence = await tx.projectGeofence.findFirst({
            where: { project_id: projectId, is_active: true },
            orderBy: { created_at: 'desc' },
          });

          let distanceMeters = 0;
          let status: 'WITHIN_GEOFENCE' | 'OUTSIDE_GEOFENCE_FLAGGED' = 'WITHIN_GEOFENCE';

          if (geofence) {
            distanceMeters = calculateHaversineDistanceMeters(
              parseFloat(geofence.center_latitude.toString()),
              parseFloat(geofence.center_longitude.toString()),
              parseFloat(data.capturedLatitude),
              parseFloat(data.capturedLongitude)
            );

            const allowedRadius = parseFloat(geofence.radius_meters.toString());
            if (distanceMeters > allowedRadius) {
              status = 'OUTSIDE_GEOFENCE_FLAGGED';
            }
          }

          const clockEvent = await tx.workerClockEvent.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              laborer_id: data.laborerId,
              clock_type: data.clockType,
              captured_latitude: toDecimal(data.capturedLatitude).toFixed(6),
              captured_longitude: toDecimal(data.capturedLongitude).toFixed(6),
              calculated_distance_meters: distanceMeters.toFixed(2),
              verification_status: status,
              photo_selfie_url: data.photoSelfieUrl || null,
              device_user_agent: data.deviceUserAgent || request.headers['user-agent'] || null,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'WORKER_CLOCK_EVENT',
            entityId: clockEvent.id,
            projectId,
            changes: {
              worker: laborer.full_name,
              clockType: clockEvent.clock_type,
              distance: clockEvent.calculated_distance_meters.toString(),
              status: clockEvent.verification_status,
            },
          });

          return {
            id: clockEvent.id,
            laborerId: clockEvent.laborer_id,
            workerName: laborer.full_name,
            workerCode: laborer.worker_code,
            clockType: clockEvent.clock_type,
            calculatedDistanceMeters: toDecimal(clockEvent.calculated_distance_meters.toString()).toFixed(2),
            verificationStatus: clockEvent.verification_status,
            eventTimestamp: clockEvent.event_timestamp.toISOString(),
          };
        });

        return reply.status(201).send(result);
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A soil test with this test number already exists for this project',
          });
        }
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 2.4 List Worker Clock Events
  server.get(
    '/api/v1/projects/:projectId/clock-events',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const events = await tx.workerClockEvent.findMany({
            where: { project_id: projectId },
            include: { laborer: true },
            orderBy: { event_timestamp: 'desc' },
            take: 50,
          });

          const totalEvents = events.length;
          const withinGeofence = events.filter((e) => e.verification_status === 'WITHIN_GEOFENCE').length;
          const outsideGeofence = events.filter((e) => e.verification_status === 'OUTSIDE_GEOFENCE_FLAGGED').length;

          return {
            projectId,
            summary: {
              totalEvents,
              withinGeofence,
              outsideGeofence,
            },
            events: events.map((e) => ({
              id: e.id,
              workerName: e.laborer.full_name,
              workerCode: e.laborer.worker_code,
              tradeCategory: e.laborer.trade_category,
              clockType: e.clock_type,
              eventTimestamp: e.event_timestamp.toISOString(),
              calculatedDistanceMeters: toDecimal(e.calculated_distance_meters.toString()).toFixed(2),
              verificationStatus: e.verification_status,
              photoSelfieUrl: e.photo_selfie_url,
            })),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // ===========================================================================
  // MODULE 3: DIRECT PLANT GPS TELEMATICS & FUEL FLOW METERS (M24)
  // ===========================================================================

  // 3.1 Register Telematics Device to Machinery
  server.post(
    '/api/v1/projects/:projectId/telematics-devices',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      if (role === 'CLIENT') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Client users cannot register telematics devices',
        });
      }

      const parseResult = RegisterTelematicsDeviceSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid telematics registration input',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const equipment = await tx.plantEquipment.findFirst({
            where: { id: data.equipmentId, project_id: projectId },
          });
          if (!equipment) throw { status: 404, message: 'Equipment not found in this project' };

          const generatedDeviceToken = `iot_${crypto.randomBytes(24).toString('hex')}`;

          const device = await tx.plantTelematicsDevice.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              equipment_id: data.equipmentId,
              device_imei: data.deviceImei,
              device_token: generatedDeviceToken,
              protocol: data.protocol,
              sim_phone_number: data.simPhoneNumber || null,
              calibration_tank_capacity_liters: toDecimal(data.calibrationTankCapacityLiters).toFixed(2),
              status: 'ONLINE',
              last_heartbeat_at: new Date(),
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'PLANT_TELEMATICS_DEVICE',
            entityId: device.id,
            projectId,
            changes: {
              imei: device.device_imei,
              equipment: equipment.name,
              protocol: device.protocol,
            },
          });

          return {
            id: device.id,
            equipmentId: device.equipment_id,
            equipmentName: equipment.name,
            deviceImei: device.device_imei,
            deviceToken: generatedDeviceToken,
            protocol: device.protocol,
            calibrationTankCapacityLiters: toDecimal(device.calibration_tank_capacity_liters.toString()).toFixed(2),
            status: device.status,
          };
        });

        return reply.status(201).send(result);
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: `Device IMEI ${data.deviceImei} or Equipment is already registered`,
          });
        }
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 3.2 Inbound IoT Webhook: Telematics & Fuel Ping (C3 Hardened)
  server.post(
    '/api/v1/telematics/ping',
    async (request, reply) => {
      // 1. Mandatory Device Token Authentication (C3)
      const deviceToken =
        (request.headers['x-device-token'] as string) ||
        (request.headers['authorization'] as string)?.replace(/^Bearer\s+/i, '');
      if (!deviceToken) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Missing device authentication token header (x-device-token)',
        });
      }

      const parseResult = IngestTelematicsPingSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid telematics ping input',
          details: parseResult.error.flatten(),
        });
      }

      const { deviceImei, latitude, longitude, engineStatus, engineRpm, cumulativeEngineSeconds, fuelLevelPercent } =
        parseResult.data;

      try {
        // 2. Cryptographic / Database Bound Device Resolution via SECURITY DEFINER function (C3 & 2b)
        const matchedRows = await prisma.$queryRaw<any[]>`
          SELECT * FROM lookup_telematics_device(${deviceImei}::text);
        `;

        if (matchedRows.length === 0) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: `Telematics device with IMEI ${deviceImei} not found`,
          });
        }

        const device = matchedRows[0];
        if (device.status === 'DEACTIVATED') {
          return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: `Telematics device with IMEI ${deviceImei} is deactivated`,
          });
        }

        // Verify device token using timing-safe constant-time comparison
        if (!device.device_token || !timingSafeCompare(deviceToken, device.device_token)) {
          return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Invalid device authentication token',
          });
        }

        const tenantId = device.tenant_id;
        // Verify no header spoofing if client passed tenantId
        const suppliedTenantId = (request.query as any)?.tenantId || (request.headers['x-tenant-id'] as string);
        if (suppliedTenantId && UUID_REGEX.test(suppliedTenantId) && suppliedTenantId !== tenantId) {
          return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Tenant header mismatch: cannot override device tenant',
          });
        }

        const tankCap = parseFloat(device.calibration_tank_capacity_liters.toString());
        const fuelPct = parseFloat(fuelLevelPercent);
        const fuelLiters = (fuelPct / 100) * tankCap;

        const result = await withTenantTx(prisma, device.tenant_id, async (tx) => {
          const equipment = await tx.plantEquipment.findUnique({
            where: { id: device.equipment_id },
          });
          const projectId = device.project_id || equipment?.project_id;
          const equipmentName = equipment?.name || 'Equipment';
          const equipmentCode = equipment?.equipment_code || 'N/A';

          // Check for sudden fuel discrepancy anomaly inside tenant transaction
          const lastPing = await tx.plantTelematicsPing.findFirst({
            where: { device_id: device.id },
            orderBy: { ping_timestamp: 'desc' },
          });

          let isSiphoning = false;
          if (lastPing) {
            const prevLiters = parseFloat(lastPing.calculated_fuel_liters.toString());
            const dropLiters = prevLiters - fuelLiters;
            // If drop is >= 30 liters with engine stopped or idle, trigger fuel discrepancy flag
            if (dropLiters >= 30 && (engineStatus === 'STOPPED' || engineStatus === 'IDLE')) {
              isSiphoning = true;
            }
          }

          const ping = await tx.plantTelematicsPing.create({
            data: {
              tenant_id: device.tenant_id,
              device_id: device.id,
              equipment_id: device.equipment_id,
              latitude: toDecimal(latitude).toFixed(6),
              longitude: toDecimal(longitude).toFixed(6),
              engine_status: engineStatus,
              engine_rpm: engineRpm || null,
              cumulative_engine_seconds: BigInt(cumulativeEngineSeconds),
              fuel_level_percent: toDecimal(fuelLevelPercent).toFixed(2),
              calculated_fuel_liters: fuelLiters.toFixed(2),
              is_siphoning_event: isSiphoning,
            },
          });

          // Update device heartbeat
          await tx.plantTelematicsDevice.update({
            where: { id: device.id },
            data: { last_heartbeat_at: new Date() },
          });

          // If fuel discrepancy anomaly detected, automatically dispatch a SiteAlertNotification
          const alertProjectId = projectId || device.project_id || equipment?.project_id;
          if (isSiphoning && alertProjectId) {
            await tx.siteAlertNotification.create({
              data: {
                tenant_id: device.tenant_id,
                project_id: alertProjectId,
                recipient_phone: '+254700000000',
                recipient_name: 'Fleet Manager / Plant Engineer',
                recipient_role: 'SITE_SUPERVISOR',
                alert_type: 'DIESEL_DISCREPANCY_FLAG',
                message_body: `TELEMATICS ALERT: Rapid fuel level drop of ${((lastPing ? parseFloat(lastPing.calculated_fuel_liters.toString()) : 0) - fuelLiters).toFixed(1)}L detected on ${equipmentName} (${equipmentCode}) while engine ${engineStatus}. Unreconciled fuel variance not matched to a logged issue.`,
                delivery_channel: 'WHATSAPP',
                delivery_status: 'SENT',
                sent_at: new Date(),
              },
            });
          }

          return {
            pingId: ping.id,
            equipmentCode,
            equipmentName,
            engineStatus: ping.engine_status,
            calculatedFuelLiters: toDecimal(ping.calculated_fuel_liters.toString()).toFixed(2),
            isSiphoningEvent: ping.is_siphoning_event,
            recordedAt: ping.ping_timestamp.toISOString(),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 3.3 List Telematics Pings for Project
  server.get(
    '/api/v1/projects/:projectId/telematics-pings',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const pings = await tx.plantTelematicsPing.findMany({
            where: {
              equipment: {
                project_id: projectId,
              },
            },
            include: { equipment: true, telematics_device: true },
            orderBy: { ping_timestamp: 'desc' },
            take: 50,
          });

          const totalPings = pings.length;
          const siphoningEvents = pings.filter((p) => p.is_siphoning_event).length;

          return {
            projectId,
            summary: {
              totalPings,
              siphoningEvents,
            },
            pings: pings.map((p) => ({
              id: p.id,
              equipmentCode: p.equipment.equipment_code,
              equipmentName: p.equipment.name,
              deviceImei: p.telematics_device.device_imei,
              latitude: toDecimal(p.latitude.toString()).toFixed(6),
              longitude: toDecimal(p.longitude.toString()).toFixed(6),
              engineStatus: p.engine_status,
              engineRpm: p.engine_rpm,
              coolantTempC: p.coolant_temp_c ? toDecimal(p.coolant_temp_c.toString()).toFixed(1) : null,
              oilTempC: p.oil_temp_c ? toDecimal(p.oil_temp_c.toString()).toFixed(1) : null,
              batteryVoltage: p.battery_voltage ? toDecimal(p.battery_voltage.toString()).toFixed(2) : null,
              fuelRateLPerH: p.fuel_rate_l_per_h ? toDecimal(p.fuel_rate_l_per_h.toString()).toFixed(2) : null,
              dtcFaultCodes: p.dtc_fault_codes,
              fuelLevelPercent: toDecimal(p.fuel_level_percent.toString()).toFixed(2),
              calculatedFuelLiters: toDecimal(p.calculated_fuel_liters.toString()).toFixed(2),
              fuelDropLiters: p.fuel_drop_liters ? toDecimal(p.fuel_drop_liters.toString()).toFixed(2) : null,
              dropRateLPerHour: p.drop_rate_l_per_hour ? toDecimal(p.drop_rate_l_per_hour.toString()).toFixed(2) : null,
              isSiphoningEvent: p.is_siphoning_event,
              anomalySeverity: p.anomaly_severity,
              pingTimestamp: p.ping_timestamp.toISOString(),
            })),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // ===========================================================================
  // MODULE 3B: CAN-BUS OBD-II TELEMATICS & PREDICTIVE MAINTENANCE (MILESTONE M32)
  // ===========================================================================

  // 3.4 Register CAN-bus OBD-II Device to Machinery
  server.post(
    '/api/v1/projects/:projectId/canbus-devices',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      if (role === 'CLIENT') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Client role is not authorized to register CAN-bus telematics devices',
        });
      }

      const parseResult = RegisterCanBusTelematicsDeviceSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid CAN-bus device registration payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const equipment = await tx.plantEquipment.findFirst({
            where: { id: data.equipmentId, project_id: projectId },
          });
          if (!equipment) throw { status: 404, message: 'Equipment not found in this project' };

          const device = await tx.plantTelematicsDevice.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              equipment_id: data.equipmentId,
              device_imei: data.deviceImei,
              device_token: data.deviceToken || null,
              protocol: data.protocol || 'CANBUS',
              can_bus_baud_rate: data.canBusBaudRate || 250000,
              max_engine_burn_rate_lph: toDecimal(data.maxEngineBurnRateLph).toFixed(2),
              sim_phone_number: data.simPhoneNumber || null,
              calibration_tank_capacity_liters: toDecimal(data.calibrationTankCapacityLiters).toFixed(2),
              tank_geometry: data.tankGeometry || 'RECTANGULAR',
              status: 'ONLINE',
              last_heartbeat_at: new Date(),
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'PLANT_TELEMATICS_DEVICE',
            entityId: device.id,
            projectId,
            changes: {
              imei: device.device_imei,
              equipment: equipment.name,
              protocol: device.protocol,
              baudRate: device.can_bus_baud_rate,
              maxBurnRate: device.max_engine_burn_rate_lph.toString(),
            },
          });

          return {
            id: device.id,
            equipmentId: device.equipment_id,
            equipmentName: equipment.name,
            deviceImei: device.device_imei,
            deviceToken: device.device_token,
            protocol: device.protocol,
            canBusBaudRate: device.can_bus_baud_rate,
            maxEngineBurnRateLph: toDecimal(device.max_engine_burn_rate_lph.toString()).toFixed(2),
            calibrationTankCapacityLiters: toDecimal(device.calibration_tank_capacity_liters.toString()).toFixed(2),
            tankGeometry: device.tank_geometry,
            status: device.status,
            createdAt: device.created_at.toISOString(),
          };
        });

        return reply.status(201).send(result);
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A telematics device with this IMEI or for this equipment already exists',
          });
        }
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 3.5 Ingest High-Frequency CAN-bus Telematics Ping with O(1) Device Lookup
  server.post(
    '/api/v1/telematics/canbus-ping',
    async (request, reply) => {
      const parseResult = IngestCanBusTelematicsPingSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid CAN-bus ping payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        // O(1) constant-time device lookup via narrow SECURITY DEFINER function (H4 / C3)
        const devices = await prisma.$queryRaw<Array<{
          id: string;
          tenant_id: string;
          project_id: string | null;
          equipment_id: string;
          device_imei: string;
          device_token: string | null;
          calibration_tank_capacity_liters: any;
          max_engine_burn_rate_lph: any;
          status: string;
        }>>`SELECT * FROM lookup_telematics_device(${data.deviceImei}::text)`;

        const device = devices[0];

        if (!device) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: `Telematics device with IMEI ${data.deviceImei} not found`,
          });
        }

        // Verify device token secret if configured on device
        if (device.device_token) {
          const authHeader = request.headers['authorization'];
          const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
          const tokenProvided = data.deviceToken || bearerToken || (request.headers['x-device-token'] as string);
          if (!tokenProvided || !timingSafeCompare(tokenProvided, device.device_token)) {
            return reply.status(401).send({
              statusCode: 401,
              error: 'Unauthorized',
              message: 'Invalid or missing device authentication token',
            });
          }
        }

        const tankCap = parseFloat(device.calibration_tank_capacity_liters.toString());
        const fuelPct = parseFloat(data.fuelLevelPercent.toString());
        const fuelLiters = (fuelPct / 100) * tankCap;
        const currentTimestamp = new Date();

        const result = await withTenantTx(prisma, device.tenant_id, async (tx) => {
          const equipment = await tx.plantEquipment.findUnique({
            where: { id: device.equipment_id },
          });
          if (!equipment) throw { status: 404, message: 'Equipment not found' };

          // Fetch previous ping for delta calculation & siphoning detection
          const lastPing = await tx.plantTelematicsPing.findFirst({
            where: { device_id: device.id },
            orderBy: { ping_timestamp: 'desc' },
          });

          let siphoningEval;
          if (lastPing) {
            siphoningEval = evaluateFuelSiphoningAnomaly(
              lastPing.calculated_fuel_liters.toString(),
              fuelLiters.toFixed(2),
              lastPing.ping_timestamp,
              currentTimestamp,
              data.engineStatus,
              device.max_engine_burn_rate_lph ? device.max_engine_burn_rate_lph.toString() : '35.00'
            );
          } else {
            siphoningEval = {
              dropLiters: toDecimal(0),
              elapsedSeconds: 0,
              dropRateLitersPerHour: toDecimal(0),
              isSiphoning: false,
              anomalyType: 'NORMAL' as const,
              severity: 'NONE' as const,
              message: 'Initial baseline ping recorded.',
            };
          }

          // Evaluate CAN-bus diagnostics (coolant, oil, battery, DTC)
          const diagEval = evaluatePlantCanBusDiagnostics(
            data.coolantTempC != null ? data.coolantTempC : null,
            data.oilTempC != null ? data.oilTempC : null,
            data.batteryVoltage != null ? data.batteryVoltage : null,
            data.dtcFaultCodes || null
          );

          // Save ping with recorded CAN-bus PIDs
          const ping = await tx.plantTelematicsPing.create({
            data: {
              tenant_id: device.tenant_id,
              device_id: device.id,
              equipment_id: device.equipment_id,
              ping_timestamp: currentTimestamp,
              latitude: toDecimal(data.latitude).toFixed(6),
              longitude: toDecimal(data.longitude).toFixed(6),
              engine_status: data.engineStatus,
              engine_rpm: data.engineRpm ?? null,
              coolant_temp_c: data.coolantTempC != null ? toDecimal(data.coolantTempC).toFixed(1) : null,
              oil_temp_c: data.oilTempC != null ? toDecimal(data.oilTempC).toFixed(1) : null,
              fuel_rate_l_per_h: data.fuelRateLPerH != null ? toDecimal(data.fuelRateLPerH).toFixed(2) : null,
              engine_load_percent: data.engineLoadPercent != null ? toDecimal(data.engineLoadPercent).toFixed(2) : null,
              speed_kmh: data.speedKmh != null ? toDecimal(data.speedKmh).toFixed(1) : null,
              battery_voltage: data.batteryVoltage != null ? toDecimal(data.batteryVoltage).toFixed(2) : null,
              dtc_fault_codes: data.dtcFaultCodes || null,
              cumulative_engine_seconds: BigInt(data.cumulativeEngineSeconds || 0),
              fuel_level_percent: toDecimal(data.fuelLevelPercent).toFixed(2),
              calculated_fuel_liters: fuelLiters.toFixed(2),
              fuel_drop_liters: siphoningEval.dropLiters.toFixed(2),
              drop_rate_l_per_hour: siphoningEval.dropRateLitersPerHour.toFixed(2),
              is_siphoning_event: siphoningEval.isSiphoning,
              anomaly_severity: siphoningEval.severity !== 'NONE' ? siphoningEval.severity : (diagEval.alertSeverity !== 'NONE' ? diagEval.alertSeverity : 'NONE'),
            },
          });

          // Update device heartbeat & online/fault status
          await tx.plantTelematicsDevice.update({
            where: { id: device.id },
            data: {
              last_heartbeat_at: currentTimestamp,
              status: diagEval.alertSeverity === 'FATAL_SHUTDOWN' ? 'FAULT' : 'ONLINE',
            },
          });

          const projectId = device.project_id || equipment.project_id;
          const hoursMeter = toDecimal(data.cumulativeEngineSeconds || 0).dividedBy(3600).toFixed(2);
          const createdAlerts: any[] = [];

          // If sudden fuel drop anomaly detected, automatically create a PlantMaintenanceAlert!
          if (siphoningEval.isSiphoning) {
            const alertCode = `ALT-FUEL-DISC-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
            const siphAlert = await tx.plantMaintenanceAlert.create({
              data: {
                tenant_id: device.tenant_id,
                project_id: projectId,
                equipment_id: device.equipment_id,
                device_id: device.id,
                alert_code: alertCode,
                alert_type: 'FUEL_DISCREPANCY',
                severity: siphoningEval.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
                title: `Rapid Fuel Drop / Discrepancy Flag: ${equipment.name}`,
                description: siphoningEval.message,
                recommended_action: 'Inspect fuel tank cap, drain valve, and immediate physical fuel level. Reconcile with site fuel log.',
                hours_meter_at_alert: hoursMeter,
                status: 'ACTIVE',
              },
            });
            createdAlerts.push(siphAlert);

            // Also dispatch SiteAlertNotification for emergency response
            if (projectId) {
              await tx.siteAlertNotification.create({
                data: {
                  tenant_id: device.tenant_id,
                  project_id: projectId,
                  recipient_phone: '+254700000000',
                  recipient_name: 'Fleet Manager / Plant Engineer',
                  recipient_role: 'SITE_SUPERVISOR',
                  alert_type: 'DIESEL_DISCREPANCY_FLAG',
                  message_body: `TELEMATICS ALERT: ${siphoningEval.message} on ${equipment.name} (${equipment.equipment_code}).`,
                  delivery_channel: 'WHATSAPP',
                  delivery_status: 'SENT',
                  sent_at: currentTimestamp,
                },
              });
            }
          }

          // If overheating or DTC fault detected, automatically create a PlantMaintenanceAlert!
          if (diagEval.hasThermalAlarm || diagEval.hasDtcAlarm || diagEval.hasElectricalAlarm) {
            const alertCode = `ALT-DIAG-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
            let alertType = 'DTC_FAULT';
            if (diagEval.hasThermalAlarm) {
              alertType = (data.coolantTempC && Number(data.coolantTempC) > 103) ? 'ENGINE_OVERHEAT' : 'CRITICAL_OIL_TEMP';
            }
            const diagAlert = await tx.plantMaintenanceAlert.create({
              data: {
                tenant_id: device.tenant_id,
                project_id: projectId,
                equipment_id: device.equipment_id,
                device_id: device.id,
                alert_code: alertCode,
                alert_type: alertType,
                severity: diagEval.alertSeverity,
                dtc_code: data.dtcFaultCodes ? data.dtcFaultCodes.slice(0, 20) : null,
                title: `Engine Diagnostics Alarm: ${equipment.name} (${equipment.equipment_code})`,
                description: diagEval.faultMessages.join(' | '),
                recommended_action: diagEval.hasThermalAlarm
                  ? 'Shut down machine immediately. Check coolant level, radiator airflow, and engine oil cooler.'
                  : 'Connect OBD-II / J1939 scanner, pull freeze frame data, and inspect electrical harness.',
                hours_meter_at_alert: hoursMeter,
                status: 'ACTIVE',
              },
            });
            createdAlerts.push(diagAlert);
          }

          return {
            pingId: ping.id,
            equipmentCode: equipment.equipment_code,
            equipmentName: equipment.name,
            engineStatus: ping.engine_status,
            engineRpm: ping.engine_rpm,
            coolantTempC: ping.coolant_temp_c ? toDecimal(ping.coolant_temp_c.toString()).toFixed(1) : null,
            oilTempC: ping.oil_temp_c ? toDecimal(ping.oil_temp_c.toString()).toFixed(1) : null,
            fuelRateLPerH: ping.fuel_rate_l_per_h ? toDecimal(ping.fuel_rate_l_per_h.toString()).toFixed(2) : null,
            batteryVoltage: ping.battery_voltage ? toDecimal(ping.battery_voltage.toString()).toFixed(2) : null,
            fuelLevelPercent: toDecimal(ping.fuel_level_percent.toString()).toFixed(2),
            calculatedFuelLiters: toDecimal(ping.calculated_fuel_liters.toString()).toFixed(2),
            fuelDropLiters: ping.fuel_drop_liters ? toDecimal(ping.fuel_drop_liters.toString()).toFixed(2) : null,
            dropRateLPerHour: ping.drop_rate_l_per_hour ? toDecimal(ping.drop_rate_l_per_hour.toString()).toFixed(2) : null,
            isSiphoningEvent: ping.is_siphoning_event,
            anomalySeverity: ping.anomaly_severity,
            diagnostics: diagEval,
            siphoningEvaluation: siphoningEval,
            createdAlertsCount: createdAlerts.length,
            recordedAt: ping.ping_timestamp.toISOString(),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 3.6 List Active / Acknowledged Maintenance Alerts for Project
  server.get(
    '/api/v1/projects/:projectId/maintenance-alerts',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };
      const { status } = request.query as { status?: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const whereClause: any = { project_id: projectId };
          if (status && ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'].includes(status.toUpperCase())) {
            whereClause.status = status.toUpperCase();
          }

          const alerts = await tx.plantMaintenanceAlert.findMany({
            where: whereClause,
            include: { equipment: true, telematics_device: true },
            orderBy: { created_at: 'desc' },
            take: 100,
          });

          return {
            projectId,
            totalAlerts: alerts.length,
            activeAlertsCount: alerts.filter((a) => a.status === 'ACTIVE').length,
            alerts: alerts.map((a) => ({
              id: a.id,
              alertCode: a.alert_code,
              equipmentId: a.equipment_id,
              equipmentCode: a.equipment.equipment_code,
              equipmentName: a.equipment.name,
              deviceImei: a.telematics_device?.device_imei || null,
              alertType: a.alert_type,
              severity: a.severity,
              dtcCode: a.dtc_code,
              title: a.title,
              description: a.description,
              recommendedAction: a.recommended_action,
              hoursMeterAtAlert: toDecimal(a.hours_meter_at_alert.toString()).toFixed(2),
              status: a.status,
              acknowledgedBy: a.acknowledged_by,
              acknowledgedAt: a.acknowledged_at ? a.acknowledged_at.toISOString() : null,
              resolvedAt: a.resolved_at ? a.resolved_at.toISOString() : null,
              createdAt: a.created_at.toISOString(),
            })),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 3.7 Acknowledge Maintenance Alert
  server.patch(
    '/api/v1/projects/:projectId/maintenance-alerts/:alertId/acknowledge',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId, alertId } = request.params as { projectId: string; alertId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(alertId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Alert not found' });
      }

      if (role === 'CLIENT') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Client users cannot acknowledge plant maintenance alerts',
        });
      }

      const parseResult = AcknowledgeMaintenanceAlertSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid acknowledgement payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const alert = await tx.plantMaintenanceAlert.findFirst({
            where: { id: alertId, project_id: projectId },
            include: { equipment: true },
          });

          if (!alert) {
            throw { status: 404, message: 'Maintenance alert not found' };
          }

          const updated = await tx.plantMaintenanceAlert.update({
            where: { id: alertId },
            data: {
              status: 'ACKNOWLEDGED',
              acknowledged_by: data.acknowledgedBy,
              acknowledged_at: new Date(),
              description: data.actionNotes ? `${alert.description}\n[Action Note]: ${data.actionNotes}` : alert.description,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'UPDATE',
            entityType: 'PLANT_MAINTENANCE_ALERT',
            entityId: alert.id,
            projectId,
            changes: {
              previousStatus: alert.status,
              newStatus: 'ACKNOWLEDGED',
              acknowledgedBy: data.acknowledgedBy,
              actionNotes: data.actionNotes,
            },
          });

          return {
            id: updated.id,
            alertCode: updated.alert_code,
            equipmentName: alert.equipment.name,
            status: updated.status,
            acknowledgedBy: updated.acknowledged_by,
            acknowledgedAt: updated.acknowledged_at?.toISOString(),
            message: 'Maintenance alert acknowledged successfully',
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // ===========================================================================
  // 4. MILESTONE M25: REBAR TAKEOFF & BS 8666 BAR BENDING SCHEDULES (BBS)
  // ===========================================================================

  // 4.1 Create Bar Bending Schedule with Automated Cutting List Math
  server.post(
    '/api/v1/projects/:projectId/bar-bending-schedules',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateBarBendingScheduleSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid bar bending schedule payload',
          details: parseResult.error.flatten(),
        });
      }

      const { scheduleNumber, elementName, drawingRef, steelGrade, items } = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          // Process and calculate each bar item
          let scheduleTotalWeightKg = toDecimal(0);

          const calculatedItems = items.map((item) => {
            const totalBars = item.numberOfMembers * item.barsPerMember;
            const cutLength = calculateRebarCutLengthMeters(
              item.shapeCode,
              item.barType,
              item.dimensionAMm,
              item.dimensionBMm,
              item.dimensionCMm,
              item.dimensionDMm
            );
            const totalLength = cutLength.times(totalBars);
            const unitWeight = getRebarUnitWeight(item.barType);
            const totalWeight = totalLength.times(unitWeight).toDecimalPlaces(2);
            const standardBarsNeeded = Math.max(1, Math.ceil(Number(totalLength) / 12));

            scheduleTotalWeightKg = scheduleTotalWeightKg.plus(totalWeight);

            return {
              tenant_id: tenantId,
              member_tag: item.memberTag,
              bar_mark: item.barMark,
              bar_type: item.barType,
              number_of_members: item.numberOfMembers,
              bars_per_member: item.barsPerMember,
              total_bars: totalBars,
              shape_code: item.shapeCode,
              dimension_a_mm: item.dimensionAMm,
              dimension_b_mm: item.dimensionBMm || null,
              dimension_c_mm: item.dimensionCMm || null,
              dimension_d_mm: item.dimensionDMm || null,
              cut_length_meters: cutLength.toFixed(3),
              total_length_meters: totalLength.toFixed(3),
              unit_weight_kg_per_m: unitWeight.toFixed(3),
              total_weight_kg: totalWeight.toFixed(2),
              standard_bars_needed_12m: standardBarsNeeded,
            };
          });

          const totalTonnage = scheduleTotalWeightKg.dividedBy(1000).toDecimalPlaces(3);

          const schedule = await tx.barBendingSchedule.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              schedule_number: scheduleNumber,
              element_name: elementName,
              drawing_ref: drawingRef || null,
              steel_grade: steelGrade,
              total_tonnage: totalTonnage.toFixed(3),
              status: 'DRAFT',
              items: {
                create: calculatedItems,
              },
            },
            include: { items: true },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'BAR_BENDING_SCHEDULE_CREATED',
            entityType: 'BarBendingSchedule',
            entityId: schedule.id,
            changes: { scheduleNumber, elementName, totalTonnage: totalTonnage.toFixed(3), itemCount: items.length },
          });

          return {
            id: schedule.id,
            scheduleNumber: schedule.schedule_number,
            elementName: schedule.element_name,
            drawingRef: schedule.drawing_ref,
            steelGrade: schedule.steel_grade,
            totalTonnage: toDecimal(schedule.total_tonnage.toString()).toFixed(3),
            totalWeightKg: scheduleTotalWeightKg.toFixed(2),
            status: schedule.status,
            itemCount: schedule.items.length,
            items: schedule.items.map((i) => ({
              id: i.id,
              memberTag: i.member_tag,
              barMark: i.bar_mark,
              barType: i.bar_type,
              numberOfMembers: i.number_of_members,
              barsPerMember: i.bars_per_member,
              totalBars: i.total_bars,
              shapeCode: i.shape_code,
              cutLengthMeters: toDecimal(i.cut_length_meters.toString()).toFixed(3),
              totalLengthMeters: toDecimal(i.total_length_meters.toString()).toFixed(3),
              unitWeightKgPerM: toDecimal(i.unit_weight_kg_per_m.toString()).toFixed(3),
              totalWeightKg: toDecimal(i.total_weight_kg.toString()).toFixed(2),
              standardBarsNeeded12m: i.standard_bars_needed_12m,
            })),
          };
        });

        return reply.status(201).send(result);
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A soil test with this test number already exists for this project',
          });
        }
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 4.2 List Bar Bending Schedules for Project
  server.get(
    '/api/v1/projects/:projectId/bar-bending-schedules',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const schedules = await tx.barBendingSchedule.findMany({
            where: { project_id: projectId },
            include: { items: true },
            orderBy: { created_at: 'desc' },
          });

          let totalProjectTonnage = toDecimal(0);
          const tonnageByType: Record<string, string> = {};

          for (const s of schedules) {
            totalProjectTonnage = totalProjectTonnage.plus(toDecimal(s.total_tonnage.toString()));
            for (const item of s.items) {
              const current = toDecimal(tonnageByType[item.bar_type] || '0');
              const addedTonnage = toDecimal(item.total_weight_kg.toString()).dividedBy(1000);
              tonnageByType[item.bar_type] = current.plus(addedTonnage).toFixed(3);
            }
          }

          return {
            projectId,
            summary: {
              totalSchedules: schedules.length,
              totalProjectTonnage: totalProjectTonnage.toFixed(3),
              tonnageByType,
            },
            schedules: schedules.map((s) => ({
              id: s.id,
              scheduleNumber: s.schedule_number,
              elementName: s.element_name,
              drawingRef: s.drawing_ref,
              steelGrade: s.steel_grade,
              totalTonnage: toDecimal(s.total_tonnage.toString()).toFixed(3),
              status: s.status,
              itemCount: s.items.length,
              createdAt: s.created_at.toISOString(),
            })),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 4.3 Get Single Bar Bending Schedule Cutting List Details
  server.get(
    '/api/v1/projects/:projectId/bar-bending-schedules/:scheduleId',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId, scheduleId } = request.params as { projectId: string; scheduleId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(scheduleId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found' });
      }

      try {
        const schedule = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const record = await tx.barBendingSchedule.findFirst({
            where: { id: scheduleId, project_id: projectId },
            include: { items: true },
          });
          if (!record) throw { status: 404, message: 'Bar bending schedule not found' };

          return {
            id: record.id,
            scheduleNumber: record.schedule_number,
            elementName: record.element_name,
            drawingRef: record.drawing_ref,
            steelGrade: record.steel_grade,
            totalTonnage: toDecimal(record.total_tonnage.toString()).toFixed(3),
            status: record.status,
            itemCount: record.items.length,
            items: record.items.map((i) => ({
              id: i.id,
              memberTag: i.member_tag,
              barMark: i.bar_mark,
              barType: i.bar_type,
              numberOfMembers: i.number_of_members,
              barsPerMember: i.bars_per_member,
              totalBars: i.total_bars,
              shapeCode: i.shape_code,
              dimensions: {
                aMm: i.dimension_a_mm,
                bMm: i.dimension_b_mm,
                cMm: i.dimension_c_mm,
                dMm: i.dimension_d_mm,
              },
              cutLengthMeters: toDecimal(i.cut_length_meters.toString()).toFixed(3),
              totalLengthMeters: toDecimal(i.total_length_meters.toString()).toFixed(3),
              unitWeightKgPerM: toDecimal(i.unit_weight_kg_per_m.toString()).toFixed(3),
              totalWeightKg: toDecimal(i.total_weight_kg.toString()).toFixed(2),
              standardBarsNeeded12m: i.standard_bars_needed_12m,
            })),
          };
        });

        return reply.status(200).send(schedule);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 4.4 Update Schedule Status (e.g. APPROVED_FOR_CUTTING, FABRICATED)
  server.patch(
    '/api/v1/projects/:projectId/bar-bending-schedules/:scheduleId/status',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, scheduleId } = request.params as { projectId: string; scheduleId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(scheduleId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found' });
      }

      const parseResult = UpdateBarBendingScheduleStatusSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid schedule status',
          details: parseResult.error.flatten(),
        });
      }

      const { status } = parseResult.data;

      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const schedule = await tx.barBendingSchedule.findFirst({
            where: { id: scheduleId, project_id: projectId },
          });
          if (!schedule) throw { status: 404, message: 'Bar bending schedule not found' };

          const res = await tx.barBendingSchedule.update({
            where: { id: scheduleId },
            data: { status },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'BAR_BENDING_SCHEDULE_STATUS_UPDATED',
            entityType: 'BarBendingSchedule',
            entityId: scheduleId,
            changes: { previousStatus: schedule.status, newStatus: status },
          });

          return res;
        });

        return reply.status(200).send({ success: true, status: updated.status });
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // ===========================================================================
  // 5. MILESTONE M26: SAFARICOM DARAJA B2C BULK WAGES & RETENTIONS
  // ===========================================================================

  // 5.1 Initiate Daraja B2C Bulk Disbursement
  server.post(
    '/api/v1/projects/:projectId/b2c-disburse',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      // Rate limit check for B2C disbursement
      const now = Date.now();
      const b2cLimit = tenantB2CDisburseMap.get(tenantId);
      if (b2cLimit && now < b2cLimit.resetAt && b2cLimit.count >= MAX_B2C_DISBURSE_PER_WINDOW) {
        const retryAfterSeconds = Math.ceil((b2cLimit.resetAt - now) / 1000);
        reply.header('Retry-After', retryAfterSeconds);
        return reply.status(429).send({
          statusCode: 429,
          error: 'Too Many Requests',
          message: 'Too many B2C disbursement requests. Please wait before initiating another payout.',
        });
      }

      if (!b2cLimit || now > b2cLimit.resetAt) {
        tenantB2CDisburseMap.set(tenantId, { count: 1, resetAt: now + B2C_DISBURSE_WINDOW_MS });
      } else {
        b2cLimit.count += 1;
      }

      const parseResult = InitiateB2CDisbursementSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid B2C disbursement payload',
          details: parseResult.error.flatten(),
        });
      }

      const { disbursementType, referenceId, recipientPhone, recipientName, amount, remarks, idempotencyKey } =
        parseResult.data;

      if (referenceId && !UUID_REGEX.test(referenceId)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid referenceId format, must be a valid UUID',
        });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          // Verify referenced business document exists under this project and tenant
          if (referenceId) {
            if (disbursementType === 'CASUAL_LABOR_WAGE') {
              const musterRoll = await tx.laborMusterRoll.findFirst({
                where: { id: referenceId, project_id: projectId },
              });
              if (!musterRoll) {
                throw { status: 404, message: 'Referenced labor muster roll not found in this project' };
              }
            } else if (disbursementType === 'SUBCONTRACTOR_RETENTION') {
              const retentionRelease = await tx.subcontractorRetentionRelease.findFirst({
                where: { id: referenceId, project_id: projectId },
              });
              if (!retentionRelease) {
                throw { status: 404, message: 'Referenced subcontractor retention release not found in this project' };
              }
            }
          }

          // Idempotency check: if transaction already exists for this idempotency key, return existing
          const existing = await tx.mpesaDisbursementTransaction.findUnique({
            where: { idempotency_key: idempotencyKey },
          });
          if (existing) {
            return {
              disbursementId: existing.id,
              status: existing.transaction_status,
              mpesaTransactionId: existing.mpesa_transaction_id,
              recipientPhone: existing.recipient_phone,
              amount: toDecimal(existing.amount.toString()).toFixed(2),
              isIdempotentReplay: true,
            };
          }

          // Generate Daraja B2C Identifiers
          const originatorConversationId = `AGY-B2C-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
          const conversationId = `CONV-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

          // Create B2C transaction record in PENDING status (C1 Hardened: no auto-completion)
          const disbursement = await tx.mpesaDisbursementTransaction.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              disbursement_type: disbursementType,
              reference_id: referenceId || null,
              recipient_phone: recipientPhone,
              recipient_name: recipientName,
              amount: toDecimal(amount).toFixed(2),
              b2c_command_id: disbursementType === 'CASUAL_LABOR_WAGE' ? 'SalaryPayment' : 'BusinessPayment',
              conversation_id: conversationId,
              originator_conversation_id: originatorConversationId,
              mpesa_transaction_id: null,
              transaction_status: 'PENDING',
              result_code: null,
              result_desc: 'Disbursement initiated, awaiting Safaricom B2C callback.',
              transaction_completed_at: null,
              idempotency_key: idempotencyKey,
            },
          });

          // Mark referenced business documents as PENDING_DISBURSEMENT
          if (referenceId) {
            if (disbursementType === 'CASUAL_LABOR_WAGE') {
              await tx.laborMusterRoll.updateMany({
                where: { id: referenceId, project_id: projectId },
                data: {
                  status: 'PENDING_DISBURSEMENT',
                  disbursement_reference: conversationId,
                },
              });
            } else if (disbursementType === 'SUBCONTRACTOR_RETENTION') {
              await tx.subcontractorRetentionRelease.updateMany({
                where: { id: referenceId, project_id: projectId },
                data: {
                  status: 'PENDING_DISBURSEMENT',
                  disbursement_ref: conversationId,
                },
              });
            }
          }

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'B2C_DISBURSEMENT_INITIATED',
            entityType: 'MpesaDisbursementTransaction',
            entityId: disbursement.id,
            changes: {
              disbursementType,
              recipientName,
              recipientPhone,
              amount: toDecimal(amount).toFixed(2),
              conversationId,
              originatorConversationId,
              remarks,
            },
          });

          return {
            disbursementId: disbursement.id,
            status: disbursement.transaction_status,
            mpesaTransactionId: null,
            conversationId,
            originatorConversationId,
            recipientPhone,
            recipientName,
            amount: toDecimal(amount).toFixed(2),
            completedAt: null,
            isIdempotentReplay: false,
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 5.2 Inbound Daraja B2C Callback Webhook (C1 Hardened)
  server.post(
    '/api/v1/billing/mpesa-b2c-callback',
    async (request, reply) => {
      // 1. Mandatory Webhook Secret Authentication with Constant-Time Comparison (C1 & 2a)
      const authHeader =
        (request.headers['x-mpesa-webhook-token'] as string) ||
        (request.headers['authorization'] as string)?.replace(/^Bearer\s+/i, '');
      const expectedSecret = process.env.MPESA_WEBHOOK_SECRET;
      if (!authHeader || !timingSafeCompare(authHeader, expectedSecret)) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid or missing M-Pesa webhook authentication token',
        });
      }

      const parseResult = ProcessB2CCallbackSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid B2C callback payload',
          details: parseResult.error.flatten(),
        });
      }

      const { ConversationID, OriginatorConversationID, ResultCode, ResultDesc, TransactionID } =
        parseResult.data;

      // 2. Cryptographic / Database Bound Tenant Context Resolution (C1 & 2b)
      const searchId = ConversationID || OriginatorConversationID;
      const matchedRows = await prisma.$queryRaw<any[]>`
        SELECT * FROM lookup_mpesa_b2c_transaction(${searchId}::text);
      `;

      if (matchedRows.length === 0) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Disbursement transaction ${searchId} not found in database`,
        });
      }

      const existingTx = matchedRows[0];
      // Bind tenantId strictly from the database record; ignore any untrusted client-supplied header or query parameter (C1 & 2b)
      const tenantId = existingTx.tenant_id;

      try {
        const isSuccess = ResultCode === 0;
        if (isSuccess && !TransactionID) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'TransactionID is mandatory for successful B2C disbursements',
          });
        }

        await withTenantTx(prisma, tenantId, async (tx) => {
          await tx.mpesaDisbursementTransaction.update({
            where: { id: existingTx.id },
            data: {
              transaction_status: isSuccess ? 'COMPLETED' : 'FAILED',
              result_code: ResultCode,
              result_desc: ResultDesc,
              mpesa_transaction_id: isSuccess ? TransactionID : null,
              transaction_completed_at: isSuccess ? new Date() : null,
            },
          });

          // Cascade verified status to linked business records
          const txRecord = await tx.mpesaDisbursementTransaction.findUnique({
            where: { id: existingTx.id },
          });

          if (txRecord && txRecord.reference_id) {
            if (txRecord.disbursement_type === 'CASUAL_LABOR_WAGE') {
              await tx.laborMusterRoll.updateMany({
                where: { id: txRecord.reference_id, project_id: txRecord.project_id },
                data: {
                  status: isSuccess ? 'DISBURSED' : 'APPROVED',
                  disbursement_reference: isSuccess ? TransactionID : null,
                  disbursed_at: isSuccess ? new Date() : null,
                },
              });
            } else if (txRecord.disbursement_type === 'SUBCONTRACTOR_RETENTION') {
              await tx.subcontractorRetentionRelease.updateMany({
                where: { id: txRecord.reference_id, project_id: txRecord.project_id },
                data: {
                  status: isSuccess ? 'PAID' : 'APPROVED',
                  disbursement_ref: isSuccess ? TransactionID : null,
                  disbursed_at: isSuccess ? new Date() : null,
                },
              });
            }
          }
        });

        return reply.status(200).send({
          ResultCode: 0,
          ResultDesc: 'Accepted',
          result: 'B2C callback processed successfully',
          status: isSuccess ? 'COMPLETED' : 'FAILED',
          transactionId: TransactionID,
          tenantId,
        });
      } catch (err: any) {
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 5.3 List B2C Disbursements for Project
  server.get(
    '/api/v1/projects/:projectId/b2c-disbursements',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const disbursements = await tx.mpesaDisbursementTransaction.findMany({
            where: { project_id: projectId },
            orderBy: { created_at: 'desc' },
          });

          let totalDisbursedKes = toDecimal(0);
          for (const d of disbursements) {
            if (d.transaction_status === 'COMPLETED') {
              totalDisbursedKes = totalDisbursedKes.plus(toDecimal(d.amount.toString()));
            }
          }

          return {
            projectId,
            summary: {
              totalDisbursements: disbursements.length,
              completedCount: disbursements.filter((d) => d.transaction_status === 'COMPLETED').length,
              failedCount: disbursements.filter((d) => d.transaction_status === 'FAILED').length,
              totalDisbursedKes: totalDisbursedKes.toFixed(2),
            },
            disbursements: disbursements.map((d) => ({
              id: d.id,
              disbursementType: d.disbursement_type,
              referenceId: d.reference_id,
              recipientPhone: d.recipient_phone,
              recipientName: d.recipient_name,
              amount: toDecimal(d.amount.toString()).toFixed(2),
              status: d.transaction_status,
              mpesaTransactionId: d.mpesa_transaction_id,
              completedAt: d.transaction_completed_at?.toISOString(),
              createdAt: d.created_at.toISOString(),
            })),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // =============================================================
  // SECTION 6: READY-MIX CONCRETE (RMC) BATCHING & TRANSIT TRACKER (MILESTONE M27)
  // =============================================================

  // 6.1 Register RMC Batch Delivery Ticket
  server.post(
    '/api/v1/projects/:projectId/rmc-deliveries',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateRmcBatchDeliverySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid RMC delivery payload',
          details: parseResult.error.flatten(),
        });
      }

      const {
        deliveryTicketNo,
        supplierName,
        truckRegistrationNo,
        driverName,
        driverPhone,
        concreteClass,
        orderedVolumeM3,
        dispatchedAt,
        pourLocationElement,
      } = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const transitEval = evaluateRmcTransitStatus(dispatchedAt);

          const delivery = await tx.rmcBatchDelivery.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              delivery_ticket_no: deliveryTicketNo,
              supplier_name: supplierName,
              truck_registration_no: truckRegistrationNo,
              driver_name: driverName || null,
              driver_phone: driverPhone || null,
              concrete_class: concreteClass,
              ordered_volume_m3: toDecimal(orderedVolumeM3).toFixed(2),
              dispatched_at: new Date(dispatchedAt),
              pour_location_element: pourLocationElement,
              transit_duration_minutes: transitEval.transitMinutes,
              status: transitEval.isColdJointRisk ? 'REJECTED_COLD_JOINT_RISK' : 'IN_TRANSIT',
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'REGISTER_RMC_DELIVERY',
            entityType: 'RmcBatchDelivery',
            entityId: delivery.id,
            changes: {
              deliveryTicketNo,
              supplierName,
              truckRegistrationNo,
              concreteClass,
              orderedVolumeM3: toDecimal(orderedVolumeM3).toFixed(2),
            },
          });

          return {
            deliveryId: delivery.id,
            deliveryTicketNo: delivery.delivery_ticket_no,
            truckRegistrationNo: delivery.truck_registration_no,
            concreteClass: delivery.concrete_class,
            orderedVolumeM3: toDecimal(delivery.ordered_volume_m3.toString()).toFixed(2),
            status: delivery.status,
            transitEvaluation: transitEval,
            createdAt: delivery.created_at.toISOString(),
          };
        });

        return reply.status(201).send(result);
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A soil test with this test number already exists for this project',
          });
        }
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 6.2 List RMC Deliveries for Project
  server.get(
    '/api/v1/projects/:projectId/rmc-deliveries',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const deliveries = await tx.rmcBatchDelivery.findMany({
            where: { project_id: projectId },
            include: { slump_tests: true },
            orderBy: { dispatched_at: 'desc' },
          });

          let totalVolumeM3 = toDecimal(0);
          for (const d of deliveries) {
            totalVolumeM3 = totalVolumeM3.plus(toDecimal(d.ordered_volume_m3.toString()));
          }

          return {
            projectId,
            summary: {
              totalTruckloads: deliveries.length,
              totalVolumeM3: totalVolumeM3.toFixed(2),
              inTransitCount: deliveries.filter((d) => d.status === 'IN_TRANSIT').length,
              completedCount: deliveries.filter((d) => d.status === 'COMPLETED').length,
              rejectedCount: deliveries.filter((d) => d.status === 'REJECTED_COLD_JOINT_RISK').length,
            },
            deliveries: deliveries.map((d) => ({
              id: d.id,
              deliveryTicketNo: d.delivery_ticket_no,
              supplierName: d.supplier_name,
              truckRegistrationNo: d.truck_registration_no,
              concreteClass: d.concrete_class,
              orderedVolumeM3: toDecimal(d.ordered_volume_m3.toString()).toFixed(2),
              pourLocationElement: d.pour_location_element,
              transitDurationMinutes: d.transit_duration_minutes,
              status: d.status,
              waterAddedLiters: toDecimal(d.water_added_on_site_liters.toString()).toFixed(2),
              slumpTestsCount: d.slump_tests.length,
              latestSlumpMm: d.slump_tests[0]?.measured_slump_mm ?? null,
              latestSlumpVerdict: d.slump_tests[0]?.qa_verdict ?? null,
              dispatchedAt: d.dispatched_at.toISOString(),
              arrivedAt: d.arrived_at?.toISOString() || null,
            })),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 6.3 Record On-Site Slump & Temperature Test
  server.post(
    '/api/v1/projects/:projectId/rmc-deliveries/:deliveryId/slump-tests',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, deliveryId } = request.params as { projectId: string; deliveryId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(deliveryId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Delivery not found' });
      }

      const parseResult = RecordRmcSlumpTestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid slump test payload',
          details: parseResult.error.flatten(),
        });
      }

      const {
        specifiedSlumpMm,
        measuredSlumpMm,
        slumpType,
        concreteTemperatureC,
        ambientTemperatureC,
        testedByInspector,
        cubesCastBatchNo,
      } = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const delivery = await tx.rmcBatchDelivery.findFirst({
            where: { id: deliveryId, project_id: projectId },
          });
          if (!delivery) throw { status: 404, message: 'RMC delivery not found' };

          const slumpEval = evaluateRmcSlumpTolerance(specifiedSlumpMm, measuredSlumpMm);

          const slumpTest = await tx.rmcSlumpTest.create({
            data: {
              tenant_id: tenantId,
              delivery_id: deliveryId,
              specified_slump_mm: specifiedSlumpMm,
              measured_slump_mm: measuredSlumpMm,
              slump_type: slumpType,
              concrete_temperature_c: toDecimal(concreteTemperatureC).toFixed(1),
              ambient_temperature_c: ambientTemperatureC ? toDecimal(ambientTemperatureC).toFixed(1) : null,
              is_within_tolerance: slumpEval.isWithinTolerance,
              cubes_cast_batch_no: cubesCastBatchNo || null,
              tested_by_inspector: testedByInspector,
              qa_verdict: slumpEval.verdict,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'RECORD_RMC_SLUMP_TEST',
            entityType: 'RmcSlumpTest',
            entityId: slumpTest.id,
            changes: {
              deliveryId,
              specifiedSlumpMm,
              measuredSlumpMm,
              qaVerdict: slumpEval.verdict,
            },
          });

          return {
            slumpTestId: slumpTest.id,
            deliveryId,
            specifiedSlumpMm,
            measuredSlumpMm,
            deviationMm: slumpEval.deviationMm,
            isWithinTolerance: slumpEval.isWithinTolerance,
            verdict: slumpEval.verdict,
            concreteTemperatureC: toDecimal(slumpTest.concrete_temperature_c.toString()).toFixed(1),
            testedByInspector,
            createdAt: slumpTest.created_at.toISOString(),
          };
        });

        return reply.status(201).send(result);
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A soil test with this test number already exists for this project',
          });
        }
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 6.4 Update RMC Delivery Discharge & Water Added Status
  server.patch(
    '/api/v1/projects/:projectId/rmc-deliveries/:deliveryId/discharge',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, deliveryId } = request.params as { projectId: string; deliveryId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(deliveryId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Delivery not found' });
      }

      const parseResult = UpdateRmcDischargeSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid discharge payload',
          details: parseResult.error.flatten(),
        });
      }

      const { arrivedAt, dischargeStartedAt, dischargeCompletedAt, waterAddedOnSiteLiters, rejectionReason, status } =
        parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const delivery = await tx.rmcBatchDelivery.findFirst({
            where: { id: deliveryId, project_id: projectId },
          });
          if (!delivery) throw { status: 404, message: 'RMC delivery not found' };

          let transitDurationMinutes = delivery.transit_duration_minutes;
          if (arrivedAt) {
            const arr = new Date(arrivedAt).getTime();
            const disp = new Date(delivery.dispatched_at).getTime();
            transitDurationMinutes = Math.max(0, Math.round((arr - disp) / 60000));
          }

          const updated = await tx.rmcBatchDelivery.update({
            where: { id: deliveryId },
            data: {
              arrived_at: arrivedAt ? new Date(arrivedAt) : delivery.arrived_at,
              discharge_started_at: dischargeStartedAt ? new Date(dischargeStartedAt) : delivery.discharge_started_at,
              discharge_completed_at: dischargeCompletedAt ? new Date(dischargeCompletedAt) : delivery.discharge_completed_at,
              water_added_on_site_liters: waterAddedOnSiteLiters !== undefined ? toDecimal(waterAddedOnSiteLiters).toFixed(2) : delivery.water_added_on_site_liters,
              rejection_reason: rejectionReason !== undefined ? rejectionReason : delivery.rejection_reason,
              transit_duration_minutes: transitDurationMinutes,
              status: status || (dischargeCompletedAt ? 'COMPLETED' : dischargeStartedAt ? 'POURING' : arrivedAt ? 'ARRIVED' : delivery.status),
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'UPDATE_RMC_DISCHARGE',
            entityType: 'RmcBatchDelivery',
            entityId: updated.id,
            changes: {
              status: updated.status,
              waterAddedLiters: updated.water_added_on_site_liters.toString(),
              transitDurationMinutes,
            },
          });

          return {
            deliveryId: updated.id,
            deliveryTicketNo: updated.delivery_ticket_no,
            status: updated.status,
            transitDurationMinutes: updated.transit_duration_minutes,
            waterAddedOnSiteLiters: toDecimal(updated.water_added_on_site_liters.toString()).toFixed(2),
            updatedAt: updated.updated_at.toISOString(),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // =============================================================
  // SECTION 7: STRUCTURAL STEEL FRAMING & FABRICATION TAKEOFF (MILESTONE M28)
  // =============================================================

  // 7.1 Create Structural Steel Takeoff
  server.post(
    '/api/v1/projects/:projectId/structural-steel-takeoffs',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateStructuralSteelTakeoffSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid structural steel takeoff payload',
          details: parseResult.error.flatten(),
        });
      }

      const { takeoffNo, structureTitle, drawingReference, steelGrade, members } = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          let totalTakeoffTonnage = toDecimal(0);
          let totalTakeoffPaintArea = toDecimal(0);

          const processedMembers = members.map((m) => {
            const sectionProps = getStructuralSteelSection(m.sectionDesignation);
            const unitWeight = m.unitWeightKgPerM ? toDecimal(m.unitWeightKgPerM) : toDecimal(sectionProps.unitWeightKgPerM);
            const paintArea = m.paintAreaM2PerM ? toDecimal(m.paintAreaM2PerM) : toDecimal(sectionProps.paintAreaM2PerM);

            const totals = calculateStructuralMemberTotals(m.lengthMeters, m.quantity, unitWeight, paintArea);

            totalTakeoffTonnage = totalTakeoffTonnage.plus(totals.totalTonnage);
            totalTakeoffPaintArea = totalTakeoffPaintArea.plus(totals.totalPaintAreaM2);

            return {
              member_mark: m.memberMark,
              section_type: m.sectionType,
              section_designation: m.sectionDesignation,
              unit_weight_kg_per_m: unitWeight.toFixed(3),
              paint_area_m2_per_m: paintArea.toFixed(3),
              length_meters: toDecimal(m.lengthMeters).toFixed(3),
              quantity: m.quantity,
              total_length_meters: totals.totalLengthMeters.toFixed(3),
              total_weight_kg: totals.totalWeightKg.toFixed(2),
              total_paint_area_m2: totals.totalPaintAreaM2.toFixed(2),
              connection_bolts_count: m.connectionBoltsCount || 0,
            };
          });

          const takeoff = await tx.structuralSteelTakeoff.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              takeoff_no: takeoffNo,
              structure_title: structureTitle,
              drawing_reference: drawingReference || null,
              steel_grade: steelGrade,
              total_tonnage: totalTakeoffTonnage.toFixed(3),
              total_paint_area_m2: totalTakeoffPaintArea.toFixed(2),
              status: 'DRAFT',
              members: {
                create: processedMembers.map((m) => ({
                  tenant_id: tenantId,
                  ...m,
                })),
              },
            },
            include: { members: true },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'CREATE_STRUCTURAL_STEEL_TAKEOFF',
            entityType: 'StructuralSteelTakeoff',
            entityId: takeoff.id,
            changes: {
              takeoffNo,
              structureTitle,
              totalTonnage: totalTakeoffTonnage.toFixed(3),
              totalPaintAreaM2: totalTakeoffPaintArea.toFixed(2),
              memberCount: members.length,
            },
          });

          return {
            takeoffId: takeoff.id,
            takeoffNo: takeoff.takeoff_no,
            structureTitle: takeoff.structure_title,
            steelGrade: takeoff.steel_grade,
            totalTonnage: toDecimal(takeoff.total_tonnage.toString()).toFixed(3),
            totalPaintAreaM2: toDecimal(takeoff.total_paint_area_m2.toString()).toFixed(2),
            memberCount: takeoff.members.length,
            status: takeoff.status,
            createdAt: takeoff.created_at.toISOString(),
          };
        });

        return reply.status(201).send(result);
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A soil test with this test number already exists for this project',
          });
        }
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 7.2 List Structural Steel Takeoffs for Project
  server.get(
    '/api/v1/projects/:projectId/structural-steel-takeoffs',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const takeoffs = await tx.structuralSteelTakeoff.findMany({
            where: { project_id: projectId },
            include: { members: true },
            orderBy: { created_at: 'desc' },
          });

          let totalTonnage = toDecimal(0);
          let totalPaintArea = toDecimal(0);
          for (const t of takeoffs) {
            totalTonnage = totalTonnage.plus(toDecimal(t.total_tonnage.toString()));
            totalPaintArea = totalPaintArea.plus(toDecimal(t.total_paint_area_m2.toString()));
          }

          return {
            projectId,
            summary: {
              totalTakeoffs: takeoffs.length,
              totalTonnage: totalTonnage.toFixed(3),
              totalPaintAreaM2: totalPaintArea.toFixed(2),
            },
            takeoffs: takeoffs.map((t) => ({
              id: t.id,
              takeoffNo: t.takeoff_no,
              structureTitle: t.structure_title,
              drawingReference: t.drawing_reference,
              steelGrade: t.steel_grade,
              totalTonnage: toDecimal(t.total_tonnage.toString()).toFixed(3),
              totalPaintAreaM2: toDecimal(t.total_paint_area_m2.toString()).toFixed(2),
              memberCount: t.members.length,
              status: t.status,
              createdAt: t.created_at.toISOString(),
            })),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 7.3 Get Single Structural Steel Takeoff Details
  server.get(
    '/api/v1/projects/:projectId/structural-steel-takeoffs/:takeoffId',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId, takeoffId } = request.params as { projectId: string; takeoffId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(takeoffId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Takeoff not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const takeoff = await tx.structuralSteelTakeoff.findFirst({
            where: { id: takeoffId, project_id: projectId },
            include: { members: { orderBy: { member_mark: 'asc' } } },
          });
          if (!takeoff) throw { status: 404, message: 'Structural steel takeoff not found' };

          return {
            id: takeoff.id,
            takeoffNo: takeoff.takeoff_no,
            structureTitle: takeoff.structure_title,
            drawingReference: takeoff.drawing_reference,
            steelGrade: takeoff.steel_grade,
            totalTonnage: toDecimal(takeoff.total_tonnage.toString()).toFixed(3),
            totalPaintAreaM2: toDecimal(takeoff.total_paint_area_m2.toString()).toFixed(2),
            status: takeoff.status,
            members: takeoff.members.map((m) => ({
              id: m.id,
              memberMark: m.member_mark,
              sectionType: m.section_type,
              sectionDesignation: m.section_designation,
              unitWeightKgPerM: toDecimal(m.unit_weight_kg_per_m.toString()).toFixed(3),
              paintAreaM2PerM: toDecimal(m.paint_area_m2_per_m.toString()).toFixed(3),
              lengthMeters: toDecimal(m.length_meters.toString()).toFixed(3),
              quantity: m.quantity,
              totalLengthMeters: toDecimal(m.total_length_meters.toString()).toFixed(3),
              totalWeightKg: toDecimal(m.total_weight_kg.toString()).toFixed(2),
              totalPaintAreaM2: toDecimal(m.total_paint_area_m2.toString()).toFixed(2),
              connectionBoltsCount: m.connection_bolts_count,
            })),
            createdAt: takeoff.created_at.toISOString(),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 7.4 Update Structural Steel Takeoff Status
  server.patch(
    '/api/v1/projects/:projectId/structural-steel-takeoffs/:takeoffId/status',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, takeoffId } = request.params as { projectId: string; takeoffId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(takeoffId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Takeoff not found' });
      }

      const { status } = request.body as { status: string };
      const validStatuses = ['DRAFT', 'QS_APPROVED', 'FABRICATION_RELEASED', 'ERECTED'];
      if (!status || !validStatuses.includes(status)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const takeoff = await tx.structuralSteelTakeoff.findFirst({
            where: { id: takeoffId, project_id: projectId },
          });
          if (!takeoff) throw { status: 404, message: 'Structural steel takeoff not found' };

          const updated = await tx.structuralSteelTakeoff.update({
            where: { id: takeoffId },
            data: { status, approved_by: sub },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'UPDATE_STRUCTURAL_STEEL_TAKEOFF_STATUS',
            entityType: 'StructuralSteelTakeoff',
            entityId: updated.id,
            changes: { oldStatus: takeoff.status, newStatus: status },
          });

          return {
            takeoffId: updated.id,
            takeoffNo: updated.takeoff_no,
            status: updated.status,
            updatedAt: updated.updated_at.toISOString(),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // =============================================================
  // SECTION 8: GEOTECHNICAL SOIL COMPACTION QA ENGINE (MILESTONE M29)
  // =============================================================

  // 8.1 Record Geotechnical Soil Compaction Test
  server.post(
    '/api/v1/projects/:projectId/soil-tests',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      if (role === 'CLIENT') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Client users have read-only access to engineering quality tests',
        });
      }

      const parseResult = CreateGeotechnicalSoilTestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid geotechnical soil test payload',
          details: parseResult.error.flatten(),
        });
      }

      const {
        testNumber,
        testDate,
        locationElement,
        layerType,
        testMethod,
        laboratoryMddGCm3,
        laboratoryOmcPercent,
        fieldWetDensityGCm3,
        fieldMoisturePercent,
        requiredCompactionPercent,
        dcpBlowsPer100mm,
        inspectedBy,
      } = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          // Engineering compaction math
          const compactionEval = calculateSoilCompaction(
            laboratoryMddGCm3,
            laboratoryOmcPercent,
            fieldWetDensityGCm3,
            fieldMoisturePercent,
            requiredCompactionPercent,
            dcpBlowsPer100mm
          );

          const soilTest = await tx.geotechnicalSoilTest.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              test_number: testNumber,
              test_date: testDate ? new Date(testDate) : new Date(),
              location_element: locationElement,
              layer_type: layerType,
              test_method: testMethod,
              laboratory_mdd_g_cm3: toDecimal(laboratoryMddGCm3).toFixed(3),
              laboratory_omc_percent: toDecimal(laboratoryOmcPercent).toFixed(2),
              field_wet_density_g_cm3: toDecimal(fieldWetDensityGCm3).toFixed(3),
              field_moisture_percent: toDecimal(fieldMoisturePercent).toFixed(2),
              field_dry_density_g_cm3: compactionEval.fieldDryDensityGCm3.toFixed(3),
              relative_compaction_percent: compactionEval.relativeCompactionPercent.toFixed(2),
              required_compaction_percent: toDecimal(requiredCompactionPercent).toFixed(2),
              dcp_blows_per_100mm: dcpBlowsPer100mm || null,
              estimated_cbr_percent: compactionEval.estimatedCbrPercent ? compactionEval.estimatedCbrPercent.toFixed(2) : null,
              qa_verdict: compactionEval.verdict,
              inspected_by: inspectedBy,
              status: compactionEval.isPass ? 'VERIFIED' : 'RE_COMPACTION_REQUIRED',
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'RECORD_GEOTECHNICAL_SOIL_TEST',
            entityType: 'GeotechnicalSoilTest',
            entityId: soilTest.id,
            changes: {
              testNumber,
              layerType,
              relativeCompactionPercent: compactionEval.relativeCompactionPercent.toFixed(2),
              qaVerdict: compactionEval.verdict,
            },
          });

          return {
            id: soilTest.id,
            testNumber: soilTest.test_number,
            locationElement: soilTest.location_element,
            layerType: soilTest.layer_type,
            testMethod: soilTest.test_method,
            laboratoryMddGCm3: toDecimal(soilTest.laboratory_mdd_g_cm3.toString()).toFixed(3),
            laboratoryOmcPercent: toDecimal(soilTest.laboratory_omc_percent.toString()).toFixed(2),
            fieldWetDensityGCm3: toDecimal(soilTest.field_wet_density_g_cm3.toString()).toFixed(3),
            fieldMoisturePercent: toDecimal(soilTest.field_moisture_percent.toString()).toFixed(2),
            fieldDryDensityGCm3: toDecimal(soilTest.field_dry_density_g_cm3.toString()).toFixed(3),
            relativeCompactionPercent: toDecimal(soilTest.relative_compaction_percent.toString()).toFixed(2),
            requiredCompactionPercent: toDecimal(soilTest.required_compaction_percent.toString()).toFixed(2),
            dcpBlowsPer100mm: soilTest.dcp_blows_per_100mm,
            estimatedCbrPercent: soilTest.estimated_cbr_percent ? toDecimal(soilTest.estimated_cbr_percent.toString()).toFixed(2) : null,
            qaVerdict: soilTest.qa_verdict,
            isPass: compactionEval.isPass,
            status: soilTest.status,
            inspectedBy: soilTest.inspected_by,
            createdAt: soilTest.created_at.toISOString(),
          };
        });

        return reply.status(201).send(result);
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A soil test with this test number already exists for this project',
          });
        }
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 8.2 List Geotechnical Soil Tests for Project
  server.get(
    '/api/v1/projects/:projectId/soil-tests',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const tests = await tx.geotechnicalSoilTest.findMany({
            where: { project_id: projectId },
            orderBy: { test_date: 'desc' },
          });

          const passedCount = tests.filter((t) => t.qa_verdict === 'PASS').length;
          const failedCount = tests.length - passedCount;

          return {
            projectId,
            summary: {
              totalTests: tests.length,
              passedCount,
              failedCount,
              complianceRatePercent: tests.length > 0 ? ((passedCount / tests.length) * 100).toFixed(1) : '100.0',
            },
            tests: tests.map((t) => ({
              id: t.id,
              testNumber: t.test_number,
              testDate: t.test_date.toISOString(),
              locationElement: t.location_element,
              layerType: t.layer_type,
              testMethod: t.test_method,
              relativeCompactionPercent: toDecimal(t.relative_compaction_percent.toString()).toFixed(2),
              requiredCompactionPercent: toDecimal(t.required_compaction_percent.toString()).toFixed(2),
              estimatedCbrPercent: t.estimated_cbr_percent ? toDecimal(t.estimated_cbr_percent.toString()).toFixed(2) : null,
              qaVerdict: t.qa_verdict,
              status: t.status,
              inspectedBy: t.inspected_by,
            })),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // =============================================================
  // SECTION 9: ASPHALT PAVEMENT QUALITY & THERMAL TRACKER (MILESTONE M30)
  // =============================================================

  // 9.1 Register Asphalt Pavement Batch with Thermal Quality
  server.post(
    '/api/v1/projects/:projectId/asphalt-batches',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      if (role === 'CLIENT') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Client users have read-only access to asphalt pavement quality tickets',
        });
      }

      const parseResult = CreateAsphaltPavementBatchSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid asphalt pavement batch payload',
          details: parseResult.error.flatten(),
        });
      }

      const {
        ticketNumber,
        supplierName,
        mixType,
        truckRegNo,
        tonnageTons,
        chainageStart,
        chainageEnd,
        laneDirection,
        plantTempC,
        deliveryTempC,
        breakdownTempC,
        finishTempC,
        designThicknessMm,
        inspectedBy,
      } = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const thermalEval = evaluateAsphaltThermalQuality(plantTempC, deliveryTempC, breakdownTempC, finishTempC);

          const batch = await tx.asphaltPavementBatch.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              ticket_number: ticketNumber,
              supplier_name: supplierName,
              mix_type: mixType,
              truck_reg_no: truckRegNo,
              tonnage_tons: toDecimal(tonnageTons).toFixed(2),
              chainage_start: chainageStart,
              chainage_end: chainageEnd,
              lane_direction: laneDirection,
              plant_temp_c: toDecimal(plantTempC).toFixed(1),
              delivery_temp_c: toDecimal(deliveryTempC).toFixed(1),
              breakdown_temp_c: toDecimal(breakdownTempC).toFixed(1),
              finish_temp_c: toDecimal(finishTempC).toFixed(1),
              thermal_verdict: thermalEval.thermalVerdict,
              design_thickness_mm: toDecimal(designThicknessMm).toFixed(2),
              inspected_by: inspectedBy,
              status: thermalEval.isPavingApproved ? 'LAID' : 'REJECTED',
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'REGISTER_ASPHALT_PAVEMENT_BATCH',
            entityType: 'AsphaltPavementBatch',
            entityId: batch.id,
            changes: {
              ticketNumber,
              mixType,
              tonnageTons: toDecimal(tonnageTons).toFixed(2),
              thermalVerdict: thermalEval.thermalVerdict,
            },
          });

          return {
            id: batch.id,
            ticketNumber: batch.ticket_number,
            mixType: batch.mix_type,
            truckRegNo: batch.truck_reg_no,
            tonnageTons: toDecimal(batch.tonnage_tons.toString()).toFixed(2),
            chainageStart: batch.chainage_start,
            chainageEnd: batch.chainage_end,
            laneDirection: batch.lane_direction,
            plantTempC: toDecimal(batch.plant_temp_c.toString()).toFixed(1),
            deliveryTempC: toDecimal(batch.delivery_temp_c.toString()).toFixed(1),
            breakdownTempC: toDecimal(batch.breakdown_temp_c.toString()).toFixed(1),
            finishTempC: toDecimal(batch.finish_temp_c.toString()).toFixed(1),
            thermalVerdict: batch.thermal_verdict,
            isPavingApproved: thermalEval.isPavingApproved,
            status: batch.status,
            createdAt: batch.created_at.toISOString(),
          };
        });

        return reply.status(201).send(result);
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A soil test with this test number already exists for this project',
          });
        }
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 9.2 List Asphalt Pavement Batches for Project
  server.get(
    '/api/v1/projects/:projectId/asphalt-batches',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const batches = await tx.asphaltPavementBatch.findMany({
            where: { project_id: projectId },
            orderBy: { created_at: 'desc' },
          });

          let totalTonnage = toDecimal(0);
          for (const b of batches) {
            totalTonnage = totalTonnage.plus(toDecimal(b.tonnage_tons.toString()));
          }

          return {
            projectId,
            summary: {
              totalTruckloads: batches.length,
              totalTonnage: totalTonnage.toFixed(2),
              compliantCount: batches.filter((b) => b.thermal_verdict === 'COMPLIANT').length,
              rejectedCount: batches.filter((b) => b.status === 'REJECTED').length,
              coresTestedCount: batches.filter((b) => b.core_density_g_cm3 !== null).length,
            },
            batches: batches.map((b) => ({
              id: b.id,
              ticketNumber: b.ticket_number,
              supplierName: b.supplier_name,
              mixType: b.mix_type,
              truckRegNo: b.truck_reg_no,
              tonnageTons: toDecimal(b.tonnage_tons.toString()).toFixed(2),
              chainage: `${b.chainage_start} - ${b.chainage_end} (${b.lane_direction})`,
              deliveryTempC: toDecimal(b.delivery_temp_c.toString()).toFixed(1),
              finishTempC: toDecimal(b.finish_temp_c.toString()).toFixed(1),
              thermalVerdict: b.thermal_verdict,
              coreThicknessMm: b.core_thickness_mm ? toDecimal(b.core_thickness_mm.toString()).toFixed(1) : null,
              compactionPercent: b.compaction_percent ? toDecimal(b.compaction_percent.toString()).toFixed(2) : null,
              qaVerdict: b.qa_verdict,
              status: b.status,
              createdAt: b.created_at.toISOString(),
            })),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 9.3 Record Core Extraction Test on Pavement Batch
  server.patch(
    '/api/v1/projects/:projectId/asphalt-batches/:batchId/core-test',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId, batchId } = request.params as { projectId: string; batchId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(batchId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Batch not found' });
      }

      if (role === 'CLIENT') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Client users cannot record core tests',
        });
      }

      const parseResult = RecordAsphaltCoreTestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid core test payload',
          details: parseResult.error.flatten(),
        });
      }

      const { coreThicknessMm, coreDensityGCm3, marshallDensityGCm3, inspectedBy } = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const batch = await tx.asphaltPavementBatch.findFirst({
            where: { id: batchId, project_id: projectId },
          });
          if (!batch) throw { status: 404, message: 'Asphalt pavement batch not found' };

          const coreEval = calculateAsphaltCoreCompaction(
            coreThicknessMm,
            batch.design_thickness_mm,
            coreDensityGCm3,
            marshallDensityGCm3
          );

          const isPriorRejected = batch.status === 'REJECTED' || batch.thermal_verdict === 'REJECTED_COLD_PAVING';
          const newStatus = isPriorRejected
            ? 'REJECTED'
            : (coreEval.isAccepted ? 'COMPLETED' : 'REJECTED');

          const updated = await tx.asphaltPavementBatch.update({
            where: { id: batchId },
            data: {
              core_thickness_mm: toDecimal(coreThicknessMm).toFixed(2),
              core_density_g_cm3: toDecimal(coreDensityGCm3).toFixed(3),
              marshall_density_g_cm3: toDecimal(marshallDensityGCm3).toFixed(3),
              compaction_percent: coreEval.compactionPercent.toFixed(2),
              qa_verdict: coreEval.qaVerdict,
              status: newStatus,
              inspected_by: inspectedBy || batch.inspected_by,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'RECORD_ASPHALT_CORE_TEST',
            entityType: 'AsphaltPavementBatch',
            entityId: updated.id,
            changes: {
              coreThicknessMm: toDecimal(coreThicknessMm).toFixed(2),
              compactionPercent: coreEval.compactionPercent.toFixed(2),
              qaVerdict: coreEval.qaVerdict,
            },
          });

          return {
            id: updated.id,
            ticketNumber: updated.ticket_number,
            coreThicknessMm: toDecimal(updated.core_thickness_mm!.toString()).toFixed(1),
            designThicknessMm: toDecimal(updated.design_thickness_mm.toString()).toFixed(1),
            thicknessDeviationMm: coreEval.thicknessDeviationMm.toFixed(1),
            coreDensityGCm3: toDecimal(updated.core_density_g_cm3!.toString()).toFixed(3),
            marshallDensityGCm3: toDecimal(updated.marshall_density_g_cm3!.toString()).toFixed(3),
            compactionPercent: toDecimal(updated.compaction_percent!.toString()).toFixed(2),
            qaVerdict: updated.qa_verdict,
            status: updated.status,
            message: coreEval.message,
            updatedAt: updated.updated_at.toISOString(),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // =============================================================
  // SECTION 10: TOPOGRAPHIC SURVEY & CUT/FILL EARTHWORKS (MILESTONE M31)
  // =============================================================

  // 10.1 Create Topographic Survey with Cross-Section Takeoffs & Earthworks Balancing
  server.post(
    '/api/v1/projects/:projectId/topographic-surveys',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      if (role === 'CLIENT') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Client users have read-only access to topographic surveys',
        });
      }

      const parseResult = CreateTopographicSurveySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid topographic survey payload',
          details: parseResult.error.flatten(),
        });
      }

      const {
        surveyCode,
        title,
        surveyDate,
        surveyorName,
        instrumentType,
        calculationMethod,
        bulkingFactor,
        shrinkageFactor,
        freehaulDistanceMeters,
        overhaulUnitRateKes,
        borrowUnitRateKes,
        stations: inputStations,
      } = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const sortedStations = [...inputStations].sort((a, b) => a.stationIndex - b.stationIndex);

          let totalCutVolume = toDecimal(0);
          let totalFillVolume = toDecimal(0);
          let cumulativeMass = toDecimal(0);

          type ComputedStationData = {
            stationIndex: number;
            chainageMeters: string;
            chainageLabel: string;
            existingGroundLevelM: string;
            proposedFormationLevelM: string;
            depthCutOrFillM: string;
            cutAreaM2: string;
            fillAreaM2: string;
            midCutAreaM2: string | null;
            midFillAreaM2: string | null;
            offsetsAndLevels: any;
            intervalDistanceM: string;
            intervalCutVolumeM3: string;
            intervalFillVolumeM3: string;
            intervalAdjustedFillM3: string;
            intervalNetVolumeM3: string;
            cumulativeMassOrdinateM3: string;
          };

          const computedStations: ComputedStationData[] = [];

          for (let i = 0; i < sortedStations.length; i++) {
            const st = sortedStations[i]!;
            let cutArea = toDecimal(st.cutAreaM2 ?? 0);
            let fillArea = toDecimal(st.fillAreaM2 ?? 0);

            // If cut/fill areas are 0 and raw cross-section offsets are supplied, compute with Simpson's 1/3 Rule
            if (cutArea.isZero() && fillArea.isZero() && st.offsetsAndLevels && st.offsetsAndLevels.length >= 3) {
              const pts = st.offsetsAndLevels;
              const pt0 = pts[0];
              const pt1 = pts[1];
              if (pt0 && pt1) {
                const h = Math.abs(pt1[0] - pt0[0]);
                if (h > 0) {
                  const cutOrdinates = pts.map(([_, elev]) => Math.max(0, elev - Number(st.proposedFormationLevelM)));
                  const fillOrdinates = pts.map(([_, elev]) => Math.max(0, Number(st.proposedFormationLevelM) - elev));
                  if (cutOrdinates.some((y) => y > 0)) {
                    cutArea = calculateSimpsonsArea(cutOrdinates, h).areaM2;
                  }
                  if (fillOrdinates.some((y) => y > 0)) {
                    fillArea = calculateSimpsonsArea(fillOrdinates, h).areaM2;
                  }
                }
              }
            }

            const depthCutOrFill = toDecimal(st.existingGroundLevelM).minus(toDecimal(st.proposedFormationLevelM));

            if (i === 0) {
              computedStations.push({
                stationIndex: st.stationIndex,
                chainageMeters: toDecimal(st.chainageMeters).toFixed(2),
                chainageLabel: st.chainageLabel,
                existingGroundLevelM: toDecimal(st.existingGroundLevelM).toFixed(3),
                proposedFormationLevelM: toDecimal(st.proposedFormationLevelM).toFixed(3),
                depthCutOrFillM: depthCutOrFill.toFixed(3),
                cutAreaM2: cutArea.toFixed(3),
                fillAreaM2: fillArea.toFixed(3),
                midCutAreaM2: st.midCutAreaM2 !== undefined && st.midCutAreaM2 !== null ? toDecimal(st.midCutAreaM2).toFixed(3) : null,
                midFillAreaM2: st.midFillAreaM2 !== undefined && st.midFillAreaM2 !== null ? toDecimal(st.midFillAreaM2).toFixed(3) : null,
                offsetsAndLevels: st.offsetsAndLevels ?? null,
                intervalDistanceM: '0.00',
                intervalCutVolumeM3: '0.000',
                intervalFillVolumeM3: '0.000',
                intervalAdjustedFillM3: '0.000',
                intervalNetVolumeM3: '0.000',
                cumulativeMassOrdinateM3: '0.000',
              });
            } else {
              const prev = computedStations[i - 1]!;
              const intervalDistance = toDecimal(st.chainageMeters).minus(toDecimal(prev.chainageMeters));

              let cutVol = toDecimal(0);
              let fillVol = toDecimal(0);

              if (calculationMethod === 'AVERAGE_END_AREA') {
                cutVol = calculatePrismoidalVolume(
                  prev.cutAreaM2,
                  cutArea,
                  intervalDistance,
                  st.midCutAreaM2
                ).averageEndAreaVolumeM3;
                fillVol = calculatePrismoidalVolume(
                  prev.fillAreaM2,
                  fillArea,
                  intervalDistance,
                  st.midFillAreaM2
                ).averageEndAreaVolumeM3;
              } else {
                cutVol = calculatePrismoidalVolume(
                  prev.cutAreaM2,
                  cutArea,
                  intervalDistance,
                  st.midCutAreaM2
                ).prismoidalVolumeM3;
                fillVol = calculatePrismoidalVolume(
                  prev.fillAreaM2,
                  fillArea,
                  intervalDistance,
                  st.midFillAreaM2
                ).prismoidalVolumeM3;
              }

              const balance = calculateEarthworkBalancing(
                cutVol,
                fillVol,
                shrinkageFactor,
                bulkingFactor
              );

              cumulativeMass = cumulativeMass.plus(balance.netVolumeM3);
              totalCutVolume = totalCutVolume.plus(cutVol);
              totalFillVolume = totalFillVolume.plus(fillVol);

              computedStations.push({
                stationIndex: st.stationIndex,
                chainageMeters: toDecimal(st.chainageMeters).toFixed(2),
                chainageLabel: st.chainageLabel,
                existingGroundLevelM: toDecimal(st.existingGroundLevelM).toFixed(3),
                proposedFormationLevelM: toDecimal(st.proposedFormationLevelM).toFixed(3),
                depthCutOrFillM: depthCutOrFill.toFixed(3),
                cutAreaM2: cutArea.toFixed(3),
                fillAreaM2: fillArea.toFixed(3),
                midCutAreaM2: st.midCutAreaM2 !== undefined && st.midCutAreaM2 !== null ? toDecimal(st.midCutAreaM2).toFixed(3) : null,
                midFillAreaM2: st.midFillAreaM2 !== undefined && st.midFillAreaM2 !== null ? toDecimal(st.midFillAreaM2).toFixed(3) : null,
                offsetsAndLevels: st.offsetsAndLevels ?? null,
                intervalDistanceM: intervalDistance.toFixed(2),
                intervalCutVolumeM3: cutVol.toFixed(3),
                intervalFillVolumeM3: fillVol.toFixed(3),
                intervalAdjustedFillM3: balance.adjustedFillM3.toFixed(3),
                intervalNetVolumeM3: balance.netVolumeM3.toFixed(3),
                cumulativeMassOrdinateM3: cumulativeMass.toFixed(3),
              });
            }
          }

          const firstStation = computedStations[0]!;
          const lastStation = computedStations[computedStations.length - 1]!;
          const firstChainage = toDecimal(firstStation.chainageMeters);
          const lastChainage = toDecimal(lastStation.chainageMeters);
          const totalLengthM = lastChainage.minus(firstChainage);

          const netBalance = cumulativeMass;
          const overhaulVolume = netBalance.greaterThan(0) ? netBalance : toDecimal(0);

          const haulEval = calculateEconomicHaul(
            totalLengthM,
            freehaulDistanceMeters,
            overhaulVolume,
            overhaulUnitRateKes,
            borrowUnitRateKes
          );

          const survey = await tx.topographicSurvey.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              survey_code: surveyCode,
              title,
              survey_date: surveyDate ? new Date(surveyDate) : new Date(),
              surveyor_name: surveyorName,
              instrument_type: instrumentType,
              calculation_method: calculationMethod,
              bulking_factor: toDecimal(bulkingFactor).toFixed(3),
              shrinkage_factor: toDecimal(shrinkageFactor).toFixed(3),
              freehaul_distance_meters: toDecimal(freehaulDistanceMeters).toFixed(2),
              overhaul_unit_rate_kes: toDecimal(overhaulUnitRateKes).toFixed(2),
              borrow_unit_rate_kes: toDecimal(borrowUnitRateKes).toFixed(2),
              total_cut_volume_m3: totalCutVolume.toFixed(3),
              total_fill_volume_m3: totalFillVolume.toFixed(3),
              net_balance_volume_m3: netBalance.toFixed(3),
              total_overhaul_cost_kes: haulEval.overhaulCostKes.toFixed(2),
              economic_haul_limit_meters: haulEval.economicLimitOfHaulMeters.toFixed(2),
              status: 'COMPLETED',
            },
          });

          await tx.crossSectionStation.createMany({
            data: computedStations.map((st) => ({
              tenant_id: tenantId,
              project_id: projectId,
              survey_id: survey.id,
              station_index: st.stationIndex,
              chainage_meters: st.chainageMeters,
              chainage_label: st.chainageLabel,
              existing_ground_level_m: st.existingGroundLevelM,
              proposed_formation_level_m: st.proposedFormationLevelM,
              depth_cut_or_fill_m: st.depthCutOrFillM,
              cut_area_m2: st.cutAreaM2,
              fill_area_m2: st.fillAreaM2,
              mid_cut_area_m2: st.midCutAreaM2,
              mid_fill_area_m2: st.midFillAreaM2,
              offsets_and_levels: st.offsetsAndLevels,
              interval_distance_m: st.intervalDistanceM,
              interval_cut_volume_m3: st.intervalCutVolumeM3,
              interval_fill_volume_m3: st.intervalFillVolumeM3,
              interval_adjusted_fill_m3: st.intervalAdjustedFillM3,
              interval_net_volume_m3: st.intervalNetVolumeM3,
              cumulative_mass_ordinate_m3: st.cumulativeMassOrdinateM3,
            })),
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'CREATE_TOPOGRAPHIC_SURVEY',
            entityType: 'TopographicSurvey',
            entityId: survey.id,
            changes: {
              surveyCode,
              totalCutVolumeM3: totalCutVolume.toFixed(3),
              totalFillVolumeM3: totalFillVolume.toFixed(3),
              netBalanceVolumeM3: netBalance.toFixed(3),
              stationCount: computedStations.length,
            },
          });

          return {
            id: survey.id,
            surveyCode: survey.survey_code,
            title: survey.title,
            surveyDate: survey.survey_date.toISOString(),
            surveyorName: survey.surveyor_name,
            instrumentType: survey.instrument_type,
            calculationMethod: survey.calculation_method,
            bulkingFactor: toDecimal(survey.bulking_factor.toString()).toFixed(3),
            shrinkageFactor: toDecimal(survey.shrinkage_factor.toString()).toFixed(3),
            freehaulDistanceMeters: toDecimal(survey.freehaul_distance_meters.toString()).toFixed(2),
            overhaulUnitRateKes: toDecimal(survey.overhaul_unit_rate_kes.toString()).toFixed(2),
            borrowUnitRateKes: toDecimal(survey.borrow_unit_rate_kes.toString()).toFixed(2),
            totalCutVolumeM3: toDecimal(survey.total_cut_volume_m3.toString()).toFixed(3),
            totalFillVolumeM3: toDecimal(survey.total_fill_volume_m3.toString()).toFixed(3),
            netBalanceVolumeM3: toDecimal(survey.net_balance_volume_m3.toString()).toFixed(3),
            totalOverhaulCostKes: toDecimal(survey.total_overhaul_cost_kes.toString()).toFixed(2),
            economicHaulLimitMeters: toDecimal(survey.economic_haul_limit_meters.toString()).toFixed(2),
            status: survey.status,
            stationCount: computedStations.length,
            stations: computedStations,
            createdAt: survey.created_at.toISOString(),
          };
        });

        return reply.status(201).send(result);
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A topographic survey with this survey code already exists for this project',
          });
        }
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 10.2 List Topographic Surveys for Project
  server.get(
    '/api/v1/projects/:projectId/topographic-surveys',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const surveys = await tx.topographicSurvey.findMany({
            where: { tenant_id: tenantId, project_id: projectId },
            include: {
              _count: { select: { stations: true } },
            },
            orderBy: { created_at: 'desc' },
          });

          return surveys.map((s) => ({
            id: s.id,
            surveyCode: s.survey_code,
            title: s.title,
            surveyDate: s.survey_date.toISOString(),
            surveyorName: s.surveyor_name,
            instrumentType: s.instrument_type,
            calculationMethod: s.calculation_method,
            bulkingFactor: toDecimal(s.bulking_factor.toString()).toFixed(3),
            shrinkageFactor: toDecimal(s.shrinkage_factor.toString()).toFixed(3),
            freehaulDistanceMeters: toDecimal(s.freehaul_distance_meters.toString()).toFixed(2),
            overhaulUnitRateKes: toDecimal(s.overhaul_unit_rate_kes.toString()).toFixed(2),
            borrowUnitRateKes: toDecimal(s.borrow_unit_rate_kes.toString()).toFixed(2),
            totalCutVolumeM3: toDecimal(s.total_cut_volume_m3.toString()).toFixed(3),
            totalFillVolumeM3: toDecimal(s.total_fill_volume_m3.toString()).toFixed(3),
            netBalanceVolumeM3: toDecimal(s.net_balance_volume_m3.toString()).toFixed(3),
            totalOverhaulCostKes: toDecimal(s.total_overhaul_cost_kes.toString()).toFixed(2),
            economicHaulLimitMeters: toDecimal(s.economic_haul_limit_meters.toString()).toFixed(2),
            status: s.status,
            stationCount: s._count.stations,
            createdAt: s.created_at.toISOString(),
          }));
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 10.3 Get Topographic Survey Details with Ordered Cross-Section Stations
  server.get(
    '/api/v1/projects/:projectId/topographic-surveys/:surveyId',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId, surveyId } = request.params as { projectId: string; surveyId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(surveyId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const survey = await tx.topographicSurvey.findFirst({
            where: { id: surveyId, tenant_id: tenantId, project_id: projectId },
            include: {
              stations: {
                orderBy: { station_index: 'asc' },
              },
            },
          });

          if (!survey) {
            throw { status: 404, message: 'Topographic survey not found' };
          }

          return {
            id: survey.id,
            surveyCode: survey.survey_code,
            title: survey.title,
            surveyDate: survey.survey_date.toISOString(),
            surveyorName: survey.surveyor_name,
            instrumentType: survey.instrument_type,
            calculationMethod: survey.calculation_method,
            bulkingFactor: toDecimal(survey.bulking_factor.toString()).toFixed(3),
            shrinkageFactor: toDecimal(survey.shrinkage_factor.toString()).toFixed(3),
            freehaulDistanceMeters: toDecimal(survey.freehaul_distance_meters.toString()).toFixed(2),
            overhaulUnitRateKes: toDecimal(survey.overhaul_unit_rate_kes.toString()).toFixed(2),
            borrowUnitRateKes: toDecimal(survey.borrow_unit_rate_kes.toString()).toFixed(2),
            totalCutVolumeM3: toDecimal(survey.total_cut_volume_m3.toString()).toFixed(3),
            totalFillVolumeM3: toDecimal(survey.total_fill_volume_m3.toString()).toFixed(3),
            netBalanceVolumeM3: toDecimal(survey.net_balance_volume_m3.toString()).toFixed(3),
            totalOverhaulCostKes: toDecimal(survey.total_overhaul_cost_kes.toString()).toFixed(2),
            economicHaulLimitMeters: toDecimal(survey.economic_haul_limit_meters.toString()).toFixed(2),
            status: survey.status,
            stationCount: survey.stations.length,
            stations: survey.stations.map((s) => ({
              id: s.id,
              stationIndex: s.station_index,
              chainageMeters: toDecimal(s.chainage_meters.toString()).toFixed(2),
              chainageLabel: s.chainage_label,
              existingGroundLevelM: toDecimal(s.existing_ground_level_m.toString()).toFixed(3),
              proposedFormationLevelM: toDecimal(s.proposed_formation_level_m.toString()).toFixed(3),
              depthCutOrFillM: toDecimal(s.depth_cut_or_fill_m.toString()).toFixed(3),
              cutAreaM2: toDecimal(s.cut_area_m2.toString()).toFixed(3),
              fillAreaM2: toDecimal(s.fill_area_m2.toString()).toFixed(3),
              midCutAreaM2: s.mid_cut_area_m2 ? toDecimal(s.mid_cut_area_m2.toString()).toFixed(3) : null,
              midFillAreaM2: s.mid_fill_area_m2 ? toDecimal(s.mid_fill_area_m2.toString()).toFixed(3) : null,
              offsetsAndLevels: s.offsets_and_levels,
              intervalDistanceM: toDecimal(s.interval_distance_m.toString()).toFixed(2),
              intervalCutVolumeM3: toDecimal(s.interval_cut_volume_m3.toString()).toFixed(3),
              intervalFillVolumeM3: toDecimal(s.interval_fill_volume_m3.toString()).toFixed(3),
              intervalAdjustedFillM3: toDecimal(s.interval_adjusted_fill_m3.toString()).toFixed(3),
              intervalNetVolumeM3: toDecimal(s.interval_net_volume_m3.toString()).toFixed(3),
              cumulativeMassOrdinateM3: toDecimal(s.cumulative_mass_ordinate_m3.toString()).toFixed(3),
            })),
            createdAt: survey.created_at.toISOString(),
            updatedAt: survey.updated_at.toISOString(),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // =============================================================
  // SECTION 11: INDEPENDENT SITE INSPECTION & CONTRACTOR TENDER (MILESTONE M33)
  // =============================================================

  // 11.1 Request Independent Site Inspection Audit Visit
  server.post(
    '/api/v1/projects/:projectId/independent-inspections',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateIndependentInspectionSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid independent inspection request payload',
          details: parseResult.error.flatten(),
        });
      }

      const {
        inspectionCode: customCode,
        scheduledDate,
        scopeDescription,
        reportedProgressPct,
        contractorClaimedProgress,
        inspectorName,
        inspectorLicense,
      } = parseResult.data;

      const inspectionCode = customCode || `INSP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const finalScheduledDate = scheduledDate ? new Date(scheduledDate) : new Date();
      const finalScopeDescription = scopeDescription || 'Independent Site Inspection Audit Visit';
      const finalReportedPct = reportedProgressPct ?? contractorClaimedProgress ?? 0;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const inspection = await tx.independentSiteInspection.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              inspection_code: inspectionCode,
              requested_by: sub,
              scheduled_date: finalScheduledDate,
              scope_description: finalScopeDescription,
              reported_progress_pct: toDecimal(finalReportedPct).toFixed(2),
              inspector_name: inspectorName ?? null,
              inspector_license: inspectorLicense ?? null,
              status: 'REQUESTED',
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'REQUEST_INDEPENDENT_INSPECTION',
            entityType: 'IndependentSiteInspection',
            entityId: inspection.id,
            changes: {
              inspectionCode,
              scopeDescription: finalScopeDescription,
              scheduledDate: finalScheduledDate.toISOString(),
              reportedProgressPct: toDecimal(finalReportedPct).toFixed(2),
            },
          });

          return {
            id: inspection.id,
            inspectionCode: inspection.inspection_code,
            projectId: inspection.project_id,
            requestedBy: inspection.requested_by,
            inspectorName: inspection.inspector_name,
            inspectorLicense: inspection.inspector_license,
            scheduledDate: inspection.scheduled_date.toISOString(),
            status: inspection.status,
            scopeDescription: inspection.scope_description,
            reportedProgressPct: toDecimal(inspection.reported_progress_pct.toString()).toFixed(2),
            createdAt: inspection.created_at.toISOString(),
          };
        });

        return reply.status(201).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 11.2 List Independent Inspections with Variance Summary
  server.get(
    '/api/v1/projects/:projectId/independent-inspections',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const inspections = await tx.independentSiteInspection.findMany({
            where: { tenant_id: tenantId, project_id: projectId },
            include: {
              photos: {
                select: { id: true, photo_url: true, has_discrepancy: true },
              },
            },
            orderBy: { created_at: 'desc' },
          });

          return inspections.map((insp) => ({
            id: insp.id,
            inspectionCode: insp.inspection_code,
            status: insp.status,
            requestedBy: insp.requested_by,
            inspectorName: insp.inspector_name,
            scheduledDate: insp.scheduled_date.toISOString(),
            conductedDate: insp.conducted_date ? insp.conducted_date.toISOString() : null,
            scopeDescription: insp.scope_description,
            reportedProgressPct: toDecimal(insp.reported_progress_pct.toString()).toFixed(2),
            verifiedProgressPct: insp.verified_progress_pct ? toDecimal(insp.verified_progress_pct.toString()).toFixed(2) : null,
            variancePct: insp.variance_pct ? toDecimal(insp.variance_pct.toString()).toFixed(2) : null,
            varianceStatus: insp.variance_status,
            workmanshipRating: insp.workmanship_rating,
            safetyComplianceRating: insp.safety_compliance_rating,
            structuralDefectsFound: insp.structural_defects_found,
            clientDiscrepancyFlagged: insp.client_discrepancy_flagged,
            photosCount: insp.photos.length,
            createdAt: insp.created_at.toISOString(),
            updatedAt: insp.updated_at.toISOString(),
          }));
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 11.3 Detailed Independent Inspection Findings & Photos
  server.get(
    '/api/v1/projects/:projectId/independent-inspections/:inspectionId',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId, inspectionId } = request.params as { projectId: string; inspectionId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(inspectionId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const inspection = await tx.independentSiteInspection.findFirst({
            where: { id: inspectionId, tenant_id: tenantId, project_id: projectId },
            include: {
              photos: {
                orderBy: { captured_at: 'asc' },
              },
            },
          });

          if (!inspection) {
            throw { status: 404, message: 'Independent site inspection not found' };
          }

          return {
            id: inspection.id,
            inspectionCode: inspection.inspection_code,
            projectId: inspection.project_id,
            status: inspection.status,
            requestedBy: inspection.requested_by,
            inspectorName: inspection.inspector_name,
            inspectorLicense: inspection.inspector_license,
            scheduledDate: inspection.scheduled_date.toISOString(),
            conductedDate: inspection.conducted_date ? inspection.conducted_date.toISOString() : null,
            scopeDescription: inspection.scope_description,
            gpsLatitude: inspection.gps_latitude ? toDecimal(inspection.gps_latitude.toString()).toFixed(7) : null,
            gpsLongitude: inspection.gps_longitude ? toDecimal(inspection.gps_longitude.toString()).toFixed(7) : null,
            reportedProgressPct: toDecimal(inspection.reported_progress_pct.toString()).toFixed(2),
            verifiedProgressPct: inspection.verified_progress_pct ? toDecimal(inspection.verified_progress_pct.toString()).toFixed(2) : null,
            variancePct: inspection.variance_pct ? toDecimal(inspection.variance_pct.toString()).toFixed(2) : null,
            varianceStatus: inspection.variance_status,
            materialsOnSiteNotes: inspection.materials_on_site_notes,
            workmanshipRating: inspection.workmanship_rating,
            safetyComplianceRating: inspection.safety_compliance_rating,
            structuralDefectsFound: inspection.structural_defects_found,
            findingsNotes: inspection.findings_notes,
            recommendations: inspection.recommendations,
            clientReviewNotes: inspection.client_review_notes,
            clientDiscrepancyFlagged: inspection.client_discrepancy_flagged,
            clientSatisfactionRating: inspection.client_satisfaction_rating,
            photos: inspection.photos.map((p) => ({
              id: p.id,
              photoUrl: p.photo_url,
              caption: p.caption,
              elementInspected: p.element_inspected,
              hasDiscrepancy: p.has_discrepancy,
              gpsLatitude: p.gps_latitude ? toDecimal(p.gps_latitude.toString()).toFixed(7) : null,
              gpsLongitude: p.gps_longitude ? toDecimal(p.gps_longitude.toString()).toFixed(7) : null,
              capturedAt: p.captured_at.toISOString(),
            })),
            createdAt: inspection.created_at.toISOString(),
            updatedAt: inspection.updated_at.toISOString(),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 11.4 Inspector Submits Field Findings, Verified Progress, GPS & Discrepancies (403 for CLIENT)
  server.patch(
    '/api/v1/projects/:projectId/independent-inspections/:inspectionId/submit',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId, inspectionId } = request.params as { projectId: string; inspectionId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(inspectionId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found' });
      }

      if (role === 'CLIENT') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Client users are not permitted to submit inspection findings',
        });
      }

      const parseResult = SubmitInspectionFindingsSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid inspection findings payload',
          details: parseResult.error.flatten(),
        });
      }

      const {
        gpsLatitude,
        gpsLongitude,
        verifiedProgressPct,
        verifiedProgress,
        materialsOnSiteNotes,
        workmanshipRating,
        safetyComplianceRating,
        structuralDefectsFound,
        findingsNotes,
        recommendations,
        photos,
      } = parseResult.data;

      const finalVerifiedPct = verifiedProgressPct ?? verifiedProgress ?? 0;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const inspection = await tx.independentSiteInspection.findFirst({
            where: { id: inspectionId, tenant_id: tenantId, project_id: projectId },
          });

          if (!inspection) {
            throw { status: 404, message: 'Independent site inspection not found' };
          }

          const varianceEval = calculateInspectionProgressVariance(
            inspection.reported_progress_pct.toString(),
            finalVerifiedPct
          );

          const updated = await tx.independentSiteInspection.update({
            where: { id: inspectionId },
            data: {
              conducted_date: new Date(),
              status: 'SUBMITTED',
              gps_latitude: toDecimal(gpsLatitude).toFixed(7),
              gps_longitude: toDecimal(gpsLongitude).toFixed(7),
              verified_progress_pct: toDecimal(finalVerifiedPct).toFixed(2),
              variance_pct: varianceEval.variancePct,
              variance_status: varianceEval.status,
              materials_on_site_notes: materialsOnSiteNotes ?? null,
              workmanship_rating: workmanshipRating ?? 4,
              safety_compliance_rating: safetyComplianceRating ?? 4,
              structural_defects_found: structuralDefectsFound,
              findings_notes: findingsNotes ?? null,
              recommendations: recommendations ?? null,
            },
          });

          if (photos && photos.length > 0) {
            await tx.independentInspectionPhoto.createMany({
              data: photos.map((p) => ({
                tenant_id: tenantId,
                project_id: projectId,
                inspection_id: inspectionId,
                photo_url: p.photoUrl,
                caption: p.caption ?? null,
                element_inspected: p.elementInspected ?? null,
                has_discrepancy: p.hasDiscrepancy ?? false,
                gps_latitude: p.gpsLatitude !== undefined && p.gpsLatitude !== null ? toDecimal(p.gpsLatitude).toFixed(7) : null,
                gps_longitude: p.gpsLongitude !== undefined && p.gpsLongitude !== null ? toDecimal(p.gpsLongitude).toFixed(7) : null,
              })),
            });
          }

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'SUBMIT_INSPECTION_FINDINGS',
            entityType: 'IndependentSiteInspection',
            entityId: inspection.id,
            changes: {
              reportedProgressPct: toDecimal(inspection.reported_progress_pct.toString()).toFixed(2),
              verifiedProgressPct: toDecimal(finalVerifiedPct).toFixed(2),
              variancePct: varianceEval.variancePct,
              varianceStatus: varianceEval.status,
              alertRequired: varianceEval.alertRequired,
            },
          });

          const reportedNum = toDecimal(updated.reported_progress_pct.toString()).toNumber();
          const verifiedNum = toDecimal(updated.verified_progress_pct!.toString()).toNumber();

          const whatsappNotification = {
            dispatched: true,
            channel: 'WHATSAPP_SMS',
            recipientPhone: updated.requested_by,
            alertType: varianceEval.alertRequired ? 'CRITICAL_INFLATION_ALERT' : 'VERIFIED_PROGRESS_DIGEST',
            messageBody: varianceEval.alertRequired
              ? `MjengoLedger/Buildsasa URGENT ALERT: Ukaguzi ${updated.inspection_code} umegundua tofauti ya maendeleo (Claimed: ${reportedNum.toFixed(1)}%, Verified: ${verifiedNum.toFixed(1)}%, Variance: ${varianceEval.variancePct}%). Malipo yamesitishwa hadi ukaguzi urudiwe.`
              : `MjengoLedger/Buildsasa UPDATE: Ukaguzi ${updated.inspection_code} umekamilika (Verified: ${verifiedNum.toFixed(1)}%). Hakuna hitilafu iliyopatikana.`,
            pdfReportUrl: `/api/v1/projects/${projectId}/reports/independent-inspections/${updated.id}`,
            dispatchedAt: new Date().toISOString(),
          };

          return {
            id: updated.id,
            inspectionCode: updated.inspection_code,
            status: updated.status,
            verifiedProgressPct: toDecimal(updated.verified_progress_pct!.toString()).toFixed(2),
            reportedProgressPct: toDecimal(updated.reported_progress_pct.toString()).toFixed(2),
            variancePct: varianceEval.variancePct,
            varianceStatus: varianceEval.status,
            alertRequired: varianceEval.alertRequired,
            discrepancyMessage: varianceEval.discrepancyMessage,
            photosCount: photos.length,
            conductedDate: updated.conducted_date!.toISOString(),
            whatsappNotification,
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 11.4b Dispatch Manual Client WhatsApp / SMS Inspection Notification Digest
  server.post(
    '/api/v1/projects/:projectId/independent-inspections/:inspectionId/notify-client',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, inspectionId } = request.params as { projectId: string; inspectionId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(inspectionId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found' });
      }

      const body = (request.body as any) || {};
      const channel = body.channel || 'WHATSAPP';
      const targetPhone = body.recipientPhone;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const inspection = await tx.independentSiteInspection.findFirst({
            where: { id: inspectionId, project_id: projectId },
            include: { project: true },
          });

          if (!inspection) {
            throw { status: 404, message: 'Inspection record not found' };
          }

          const recipient = targetPhone || inspection.requested_by;
          const reported = inspection.reported_progress_pct ? Number(inspection.reported_progress_pct) : 0;
          const verified = inspection.verified_progress_pct ? Number(inspection.verified_progress_pct) : reported;
          const variance = inspection.variance_pct ? Number(inspection.variance_pct) : (verified - reported);
          const isCritical = variance <= -10.0;

          const digestMessage = isCritical
            ? `MjengoLedger BDS-ALERT: Ukaguzi rasmi ${inspection.inspection_code} kwa mradi wa ${inspection.project.name} umethibitisha tofauti kubwa (Claim: ${reported.toFixed(1)}%, Verified: ${verified.toFixed(1)}%, Variance: ${variance.toFixed(1)}%). Cheti cha ukaguzi: /api/v1/projects/${projectId}/reports/independent-inspections/${inspection.id}`
            : `MjengoLedger BDS-UPDATE: Ukaguzi rasmi ${inspection.inspection_code} kwa mradi wa ${inspection.project.name} umethibitishwa kwa mafanikio (Verified: ${verified.toFixed(1)}%). Cheti cha ukaguzi: /api/v1/projects/${projectId}/reports/independent-inspections/${inspection.id}`;

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'INSPECTION_NOTIFICATION_DISPATCHED',
            entityType: 'IndependentSiteInspection',
            entityId: inspection.id,
            changes: {
              channel,
              recipient,
              isCritical,
              variancePct: variance,
              timestamp: new Date().toISOString(),
            },
          });

          return {
            success: true,
            inspectionId: inspection.id,
            inspectionCode: inspection.inspection_code,
            channel,
            recipientPhone: recipient,
            deliveryStatus: 'DELIVERED',
            message: digestMessage,
            pdfReportUrl: `/api/v1/projects/${projectId}/reports/independent-inspections/${inspection.id}`,
            timestamp: new Date().toISOString(),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 11.5 Client Reviews Inspection Findings & Flags Contractor Discrepancy
  server.patch(
    '/api/v1/projects/:projectId/independent-inspections/:inspectionId/client-review',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, inspectionId } = request.params as { projectId: string; inspectionId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(inspectionId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found' });
      }

      const parseResult = ReviewInspectionSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid client review payload',
          details: parseResult.error.flatten(),
        });
      }

      const {
        clientReviewNotes,
        clientDiscrepancyFlagged,
        clientSatisfactionRating,
        feedback,
        rating,
      } = parseResult.data as any;

      const finalNotes = clientReviewNotes ?? feedback ?? null;
      const finalRating = clientSatisfactionRating ?? rating ?? null;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const inspection = await tx.independentSiteInspection.findFirst({
            where: { id: inspectionId, tenant_id: tenantId, project_id: projectId },
          });

          if (!inspection) {
            throw { status: 404, message: 'Independent site inspection not found' };
          }

          const updated = await tx.independentSiteInspection.update({
            where: { id: inspectionId },
            data: {
              status: 'REVIEWED',
              client_review_notes: finalNotes,
              client_discrepancy_flagged: clientDiscrepancyFlagged ?? false,
              client_satisfaction_rating: finalRating,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'REVIEW_INDEPENDENT_INSPECTION',
            entityType: 'IndependentSiteInspection',
            entityId: inspection.id,
            changes: {
              clientDiscrepancyFlagged,
              clientSatisfactionRating,
              status: 'REVIEWED',
            },
          });

          return {
            id: updated.id,
            inspectionCode: updated.inspection_code,
            status: updated.status,
            clientReviewNotes: updated.client_review_notes,
            clientDiscrepancyFlagged: updated.client_discrepancy_flagged,
            clientSatisfactionRating: updated.client_satisfaction_rating,
            updatedAt: updated.updated_at.toISOString(),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 11.6 Create and Publish Contractor Project Tender (403 for CLIENT)
  server.post(
    '/api/v1/projects/:projectId/tenders',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      if (role === 'CLIENT') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Client users cannot create project tenders; only PM/Admin authorized',
        });
      }

      const parseResult = CreateProjectTenderSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid project tender payload',
          details: parseResult.error.flatten(),
        });
      }

      const {
        tenderCode: customCode,
        tenderNumber,
        title,
        tradeCategory,
        category,
        scopeOfWork,
        budgetKes,
        estimatedBudget,
        durationWeeks,
        submissionDeadline,
      } = parseResult.data;

      const tenderCode = customCode || tenderNumber || `TND-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const finalCategory = tradeCategory || category || 'GENERAL_CONSTRUCTION';
      const finalBudget = budgetKes ?? estimatedBudget ?? '0.00';

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const tender = await tx.projectTender.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              tender_code: tenderCode,
              title,
              trade_category: finalCategory,
              scope_of_work: scopeOfWork,
              budget_kes: toDecimal(finalBudget).toFixed(2),
              duration_weeks: durationWeeks,
              submission_deadline: new Date(submissionDeadline),
              status: 'PUBLISHED',
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'CREATE_PROJECT_TENDER',
            entityType: 'ProjectTender',
            entityId: tender.id,
            changes: {
              tenderCode,
              title,
              tradeCategory: finalCategory,
              budgetKes: toDecimal(finalBudget).toFixed(2),
            },
          });

          return {
            id: tender.id,
            tenderCode: tender.tender_code,
            projectId: tender.project_id,
            title: tender.title,
            tradeCategory: tender.trade_category,
            scopeOfWork: tender.scope_of_work,
            budgetKes: toDecimal(tender.budget_kes.toString()).toFixed(2),
            durationWeeks: tender.duration_weeks,
            submissionDeadline: tender.submission_deadline.toISOString(),
            status: tender.status,
            createdAt: tender.created_at.toISOString(),
          };
        });

        return reply.status(201).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 11.7 List Project Tenders
  server.get(
    '/api/v1/projects/:projectId/tenders',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const tenders = await tx.projectTender.findMany({
            where: { tenant_id: tenantId, project_id: projectId },
            include: {
              _count: {
                select: { bids: true },
              },
            },
            orderBy: { created_at: 'desc' },
          });

          return tenders.map((t) => ({
            id: t.id,
            tenderCode: t.tender_code,
            title: t.title,
            tradeCategory: t.trade_category,
            scopeOfWork: t.scope_of_work,
            budgetKes: toDecimal(t.budget_kes.toString()).toFixed(2),
            durationWeeks: t.duration_weeks,
            submissionDeadline: t.submission_deadline.toISOString(),
            status: t.status,
            awardedBidId: t.awarded_bid_id,
            bidsCount: t._count.bids,
            createdAt: t.created_at.toISOString(),
            updatedAt: t.updated_at.toISOString(),
          }));
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 11.8 Submit Contractor Tender Bid
  server.post(
    '/api/v1/projects/:projectId/tenders/:tenderId/bids',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, tenderId } = request.params as { projectId: string; tenderId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(tenderId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found' });
      }

      const parseResult = SubmitTenderBidSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid contractor tender bid payload',
          details: parseResult.error.flatten(),
        });
      }

      const {
        contractorName,
        contractorNcaCategory,
        amountKes,
        totalBidAmount,
        durationWeeks,
        technicalScore,
        proposalNotes,
        easmmTradeBreakdown,
      } = parseResult.data;

      const finalAmount = amountKes ?? totalBidAmount ?? '0.00';

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const tender = await tx.projectTender.findFirst({
            where: { id: tenderId, tenant_id: tenantId, project_id: projectId },
          });

          if (!tender) {
            throw { status: 404, message: 'Project tender not found' };
          }

          if (tender.status !== 'PUBLISHED') {
            throw { status: 400, message: `Tender is not open for bidding (Current status: ${tender.status})` };
          }

          const bid = await tx.tenderBid.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              tender_id: tenderId,
              contractor_name: contractorName,
              contractor_nca_category: contractorNcaCategory,
              amount_kes: toDecimal(finalAmount).toFixed(2),
              duration_weeks: durationWeeks,
              technical_score: technicalScore !== undefined ? toDecimal(technicalScore).toFixed(2) : '70.00',
              proposal_notes: proposalNotes ?? null,
              easmm_trade_breakdown: easmmTradeBreakdown ?? null,
              bid_status: 'SUBMITTED',
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'SUBMIT_TENDER_BID',
            entityType: 'TenderBid',
            entityId: bid.id,
            changes: {
              tenderId,
              contractorName,
              amountKes: toDecimal(finalAmount).toFixed(2),
              durationWeeks,
            },
          });

          return {
            id: bid.id,
            tenderId: bid.tender_id,
            contractorName: bid.contractor_name,
            contractorNcaCategory: bid.contractor_nca_category,
            amountKes: toDecimal(bid.amount_kes.toString()).toFixed(2),
            durationWeeks: bid.duration_weeks,
            technicalScore: toDecimal(bid.technical_score.toString()).toNumber(),
            bidStatus: bid.bid_status,
            easmmTradeBreakdown: bid.easmm_trade_breakdown,
            submittedAt: bid.submitted_at.toISOString(),
          };
        });

        return reply.status(201).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : err.status === 400 ? 'Bad Request' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 11.9 Evaluate Tender Bids with Combined Technical & Financial Scoring
  server.get(
    '/api/v1/projects/:projectId/tenders/:tenderId/bids',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId, tenderId } = request.params as { projectId: string; tenderId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(tenderId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const tender = await tx.projectTender.findFirst({
            where: { id: tenderId, tenant_id: tenantId, project_id: projectId },
            include: {
              bids: true,
            },
          });

          if (!tender) {
            throw { status: 404, message: 'Project tender not found' };
          }

          // Evaluate bids mathematically (70% technical, 30% financial based on lowest bid)
          const tenderBidsInput = tender.bids.map((b) => ({
            id: b.id,
            amountKes: b.amount_kes.toString(),
            durationWeeks: b.duration_weeks,
            technicalScore: toDecimal(b.technical_score.toString()).toNumber(),
          }));

          const evaluated = evaluateTenderBids(tenderBidsInput, tender.budget_kes.toString());
          const evalMap = new Map(evaluated.map((e) => [e.id, e]));

          const rankedBids = tender.bids.map((b) => {
            const ev = evalMap.get(b.id);
            return {
              id: b.id,
              tenderId: b.tender_id,
              contractorName: b.contractor_name,
              contractorNcaCategory: b.contractor_nca_category,
              amountKes: toDecimal(b.amount_kes.toString()).toFixed(2),
              durationWeeks: b.duration_weeks,
              technicalScore: ev?.technicalScore ?? toDecimal(b.technical_score.toString()).toNumber(),
              financialScore: ev?.financialScore ?? 0,
              combinedScore: ev?.combinedScore ?? 0,
              rank: ev?.rank ?? 0,
              isLowestBid: ev?.isLowestBid ?? false,
              budgetVarianceKes: ev?.budgetVarianceKes ? ev.budgetVarianceKes.toFixed(2) : '0.00',
              bidStatus: b.bid_status,
              proposalNotes: b.proposal_notes,
              easmmTradeBreakdown: b.easmm_trade_breakdown,
              submittedAt: b.submitted_at.toISOString(),
            };
          });

          rankedBids.sort((a, b) => a.rank - b.rank);

          return {
            tenderId: tender.id,
            tenderCode: tender.tender_code,
            title: tender.title,
            tradeCategory: tender.trade_category,
            budgetKes: toDecimal(tender.budget_kes.toString()).toFixed(2),
            durationWeeks: tender.duration_weeks,
            submissionDeadline: tender.submission_deadline.toISOString(),
            status: tender.status,
            awardedBidId: tender.awarded_bid_id,
            totalBidsCount: tender.bids.length,
            bids: rankedBids,
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );

  // 11.10 Award Tender Bid to Winning Contractor (403 for CLIENT)
  server.patch(
    '/api/v1/projects/:projectId/tenders/:tenderId/bids/:bidId/award',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub, role } = request.user;
      const { projectId, tenderId, bidId } = request.params as {
        projectId: string;
        tenderId: string;
        bidId: string;
      };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(tenderId) || !UUID_REGEX.test(bidId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found' });
      }

      if (role === 'CLIENT') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Client users cannot award tenders; PM/Admin approval required',
        });
      }

      const parseResult = AwardTenderBidSchema.safeParse(request.body ?? {});
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid award payload',
          details: parseResult.error.flatten(),
        });
      }

      const { awardReason } = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const tender = await tx.projectTender.findFirst({
            where: { id: tenderId, tenant_id: tenantId, project_id: projectId },
            include: { bids: true },
          });

          if (!tender) {
            throw { status: 404, message: 'Project tender not found' };
          }

          if (tender.status === 'AWARDED') {
            throw { status: 400, message: 'Tender has already been awarded' };
          }

          const winningBid = tender.bids.find((b) => b.id === bidId);
          if (!winningBid) {
            throw { status: 404, message: 'Tender bid not found for this tender' };
          }

          // Mark winning bid as AWARDED
          await tx.tenderBid.update({
            where: { id: bidId },
            data: { bid_status: 'AWARDED' },
          });

          // Mark other bids as REJECTED
          await tx.tenderBid.updateMany({
            where: {
              tender_id: tenderId,
              id: { not: bidId },
            },
            data: { bid_status: 'REJECTED' },
          });

          // Update tender status to AWARDED
          const updatedTender = await tx.projectTender.update({
            where: { id: tenderId },
            data: {
              status: 'AWARDED',
              awarded_bid_id: bidId,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'AWARD_TENDER_BID',
            entityType: 'ProjectTender',
            entityId: tender.id,
            changes: {
              awardedBidId: bidId,
              contractorName: winningBid.contractor_name,
              awardedAmountKes: toDecimal(winningBid.amount_kes.toString()).toFixed(2),
              awardReason: awardReason ?? null,
            },
          });

          return {
            tenderId: updatedTender.id,
            tenderCode: updatedTender.tender_code,
            title: updatedTender.title,
            status: updatedTender.status,
            awardedBidId: updatedTender.awarded_bid_id,
            winningContractor: {
              id: winningBid.id,
              contractorName: winningBid.contractor_name,
              amountKes: toDecimal(winningBid.amount_kes.toString()).toFixed(2),
              durationWeeks: winningBid.duration_weeks,
              bidStatus: 'AWARDED',
            },
            awardReason: awardReason ?? null,
            updatedAt: updatedTender.updated_at.toISOString(),
          };
        });

        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(err.status || 500).send({
          statusCode: err.status || 500,
          error: err.status === 404 ? 'Not Found' : err.status === 400 ? 'Bad Request' : 'Internal Server Error',
          message: err.message,
        });
      }
    }
  );
};

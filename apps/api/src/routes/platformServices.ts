import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
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
} from '@construction/money';
import {
  InitiateMpesaStkPushSchema,
  ProcessMpesaCallbackSchema,
  CreateProjectGeofenceSchema,
  RecordWorkerClockInSchema,
  RegisterTelematicsDeviceSchema,
  IngestTelematicsPingSchema,
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

  // 1.3 Inbound Daraja M-Pesa Callback Webhook
  server.post(
    '/api/v1/billing/mpesa-callback',
    async (request, reply) => {
      const parseResult = ProcessMpesaCallbackSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid M-Pesa callback payload',
          details: parseResult.error.flatten(),
        });
      }

      const { CheckoutRequestID, ResultCode, ResultDesc, MpesaReceiptNumber } = parseResult.data;

      try {
        // Resolve tenant context under PostgreSQL 18 RLS
        let tenantId = (request.query as any)?.tenantId || (request.headers['x-tenant-id'] as string);
        let existingTx: any = null;

        if (tenantId && UUID_REGEX.test(tenantId)) {
          existingTx = await withTenantTx(prisma, tenantId, (tx) =>
            tx.mpesaSubscriptionTransaction.findUnique({
              where: { checkout_request_id: CheckoutRequestID },
            })
          );
        } else {
          const tenants = await prisma.tenant.findMany({ select: { id: true } });
          for (const t of tenants) {
            const found = await withTenantTx(prisma, t.id, (tx) =>
              tx.mpesaSubscriptionTransaction.findUnique({
                where: { checkout_request_id: CheckoutRequestID },
              })
            );
            if (found) {
              existingTx = found;
              tenantId = t.id;
              break;
            }
          }
        }

        if (!existingTx) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: `CheckoutRequestID ${CheckoutRequestID} not found`,
          });
        }

        const isSuccess = ResultCode === 0;
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 86400000);

        const updated = await withTenantTx(prisma, existingTx.tenant_id, async (tx) => {
          const res = await tx.mpesaSubscriptionTransaction.update({
            where: { id: existingTx.id },
            data: {
              transaction_status: isSuccess ? 'SUCCESS' : 'FAILED',
              result_code: ResultCode,
              result_desc: ResultDesc,
              mpesa_receipt_number: isSuccess ? MpesaReceiptNumber || `MPESA-${Date.now().toString().slice(-6)}` : null,
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
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
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

          const device = await tx.plantTelematicsDevice.create({
            data: {
              tenant_id: tenantId,
              equipment_id: data.equipmentId,
              device_imei: data.deviceImei,
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

  // 3.2 Inbound IoT Webhook: Telematics & Fuel Ping
  server.post(
    '/api/v1/telematics/ping',
    async (request, reply) => {
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
        // Resolve tenant context under PostgreSQL 18 RLS
        let tenantId = (request.query as any)?.tenantId || (request.headers['x-tenant-id'] as string);
        let device: any = null;

        if (tenantId && UUID_REGEX.test(tenantId)) {
          device = await withTenantTx(prisma, tenantId, (tx) =>
            tx.plantTelematicsDevice.findUnique({
              where: { device_imei: deviceImei },
              include: { equipment: true },
            })
          );
        } else {
          const tenants = await prisma.tenant.findMany({ select: { id: true } });
          for (const t of tenants) {
            const found = await withTenantTx(prisma, t.id, (tx) =>
              tx.plantTelematicsDevice.findUnique({
                where: { device_imei: deviceImei },
                include: { equipment: true },
              })
            );
            if (found) {
              device = found;
              tenantId = t.id;
              break;
            }
          }
        }

        if (!device) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: `Telematics device with IMEI ${deviceImei} not found`,
          });
        }

        const tankCap = parseFloat(device.calibration_tank_capacity_liters.toString());
        const fuelPct = parseFloat(fuelLevelPercent);
        const fuelLiters = (fuelPct / 100) * tankCap;

        const result = await withTenantTx(prisma, device.tenant_id, async (tx) => {
          // Check for sudden diesel siphoning anomaly inside tenant transaction
          const lastPing = await tx.plantTelematicsPing.findFirst({
            where: { device_id: device.id },
            orderBy: { ping_timestamp: 'desc' },
          });

          let isSiphoning = false;
          if (lastPing) {
            const prevLiters = parseFloat(lastPing.calculated_fuel_liters.toString());
            const dropLiters = prevLiters - fuelLiters;
            // If drop is >= 30 liters with engine stopped or idle, trigger siphoning flag!
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

          // If siphoning anomaly detected, automatically dispatch an emergency SiteAlertNotification
          if (isSiphoning) {
            await tx.siteAlertNotification.create({
              data: {
                tenant_id: device.tenant_id,
                project_id: device.equipment.project_id,
                recipient_phone: '+254700000000',
                recipient_name: 'Fleet Manager / Security',
                recipient_role: 'SITE_SUPERVISOR',
                alert_type: 'DIESEL_SIPHONING_FLAG',
                message_body: `TELEMATICS ALERT: Rapid fuel drop of ${((lastPing ? parseFloat(lastPing.calculated_fuel_liters.toString()) : 0) - fuelLiters).toFixed(1)}L detected on ${device.equipment.name} (${device.equipment.equipment_code}) while engine ${engineStatus}. Possible diesel theft.`,
                delivery_channel: 'WHATSAPP',
                delivery_status: 'SENT',
                sent_at: new Date(),
              },
            });
          }

          return {
            pingId: ping.id,
            equipmentCode: device.equipment.equipment_code,
            equipmentName: device.equipment.name,
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
              fuelLevelPercent: toDecimal(p.fuel_level_percent.toString()).toFixed(2),
              calculatedFuelLiters: toDecimal(p.calculated_fuel_liters.toString()).toFixed(2),
              isSiphoningEvent: p.is_siphoning_event,
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
          const mpesaTransactionId = `SKL${Math.floor(10000000 + Math.random() * 90000000)}`;

          // Create B2C transaction record
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
              mpesa_transaction_id: mpesaTransactionId,
              transaction_status: 'COMPLETED', // Auto-completed in simulated Daraja integration
              result_code: 0,
              result_desc: 'The service request is processed successfully.',
              transaction_completed_at: new Date(),
              idempotency_key: idempotencyKey,
            },
          });

          // Cascade status to linked business documents
          if (referenceId) {
            if (disbursementType === 'CASUAL_LABOR_WAGE') {
              await tx.laborMusterRoll.updateMany({
                where: { id: referenceId, project_id: projectId },
                data: {
                  status: 'DISBURSED',
                  disbursement_reference: mpesaTransactionId,
                  disbursed_at: new Date(),
                },
              });
            } else if (disbursementType === 'SUBCONTRACTOR_RETENTION') {
              await tx.subcontractorRetentionRelease.updateMany({
                where: { id: referenceId, project_id: projectId },
                data: {
                  status: 'PAID',
                  disbursement_ref: mpesaTransactionId,
                  disbursed_at: new Date(),
                },
              });
            }
          }

          await recordAuditLog(tx, {
            tenantId,
            projectId,
            actorId: sub,
            action: 'B2C_DISBURSEMENT_COMPLETED',
            entityType: 'MpesaDisbursementTransaction',
            entityId: disbursement.id,
            changes: {
              disbursementType,
              recipientName,
              recipientPhone,
              amount: toDecimal(amount).toFixed(2),
              mpesaTransactionId,
              remarks,
            },
          });

          return {
            disbursementId: disbursement.id,
            status: disbursement.transaction_status,
            mpesaTransactionId,
            conversationId,
            originatorConversationId,
            recipientPhone,
            recipientName,
            amount: toDecimal(amount).toFixed(2),
            completedAt: disbursement.transaction_completed_at?.toISOString(),
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

  // 5.2 Inbound Daraja B2C Callback Webhook
  server.post(
    '/api/v1/billing/mpesa-b2c-callback',
    async (request, reply) => {
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

      try {
        // Resolve tenant context via system scan across tenants
        let updated = false;
        const tenants = await prisma.tenant.findMany({ select: { id: true } });

        for (const t of tenants) {
          const match = await withTenantTx(prisma, t.id, async (tx) => {
            const txRecord = await tx.mpesaDisbursementTransaction.findFirst({
              where: {
                OR: [
                  { conversation_id: ConversationID },
                  { originator_conversation_id: OriginatorConversationID },
                ],
              },
            });

            if (txRecord) {
              await tx.mpesaDisbursementTransaction.update({
                where: { id: txRecord.id },
                data: {
                  transaction_status: ResultCode === 0 ? 'COMPLETED' : 'FAILED',
                  result_code: ResultCode,
                  result_desc: ResultDesc,
                  mpesa_transaction_id: TransactionID || txRecord.mpesa_transaction_id,
                  transaction_completed_at: new Date(),
                },
              });
              return true;
            }
            return false;
          });

          if (match) {
            updated = true;
            break;
          }
        }

        if (!updated) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'No matching B2C disbursement found for provided conversation ID',
          });
        }

        return reply.status(200).send({ ResultCode: 0, ResultDesc: 'Accepted' });
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
};

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { toDecimal, getRebarUnitWeight, calculateRebarCutLengthMeters } from '@construction/money';
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
};

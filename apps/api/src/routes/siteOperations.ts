import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { toDecimal } from '@construction/money';
import {
  CreatePlantEquipmentSchema,
  CreateEquipmentDailyLogSchema,
  CreateSiteLaborerSchema,
  CreateLaborMusterRollSchema,
  ReviewLaborMusterRollSchema,
  CreateSafetyAuditSchema,
} from '@construction/validation';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const siteOperationsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // ===========================================================================
  // MODULE 1: PLANT, MACHINERY & FUEL LOGS (SIPHONING AUDITING)
  // ===========================================================================

  // 1.1 List Plant & Equipment
  server.get(
    '/api/v1/projects/:projectId/equipment',
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

          const items = await tx.plantEquipment.findMany({
            where: { project_id: projectId },
            include: { daily_logs: { take: 5, orderBy: { log_date: 'desc' } } },
            orderBy: { equipment_code: 'asc' },
          });

          const totalEquipment = items.length;
          const operationalCount = items.filter((i) => i.status === 'OPERATIONAL').length;
          const totalHoursLogged = items.reduce(
            (sum, i) => sum.plus(toDecimal(i.current_hours_meter.toString())),
            toDecimal('0.00')
          );

          return {
            projectId,
            summary: {
              totalEquipment,
              operationalCount,
              totalHoursLogged: totalHoursLogged.toFixed(2),
            },
            equipment: items.map((i) => ({
              id: i.id,
              equipmentCode: i.equipment_code,
              name: i.name,
              equipmentType: i.equipment_type,
              ownershipType: i.ownership_type,
              ratePerUnitKes: toDecimal(i.rate_per_unit_kes.toString()).toFixed(2),
              rateUnit: i.rate_unit,
              registrationNo: i.registration_no,
              supplierName: i.supplier_name,
              currentHoursMeter: toDecimal(i.current_hours_meter.toString()).toFixed(2),
              status: i.status,
              createdAt: i.created_at.toISOString(),
              dailyLogs: i.daily_logs.map((l) => ({
                id: l.id,
                logDate: l.log_date.toISOString().split('T')[0],
                operatingHours: toDecimal(l.operating_hours.toString()).toFixed(2),
                idleHours: toDecimal(l.idle_or_breakdown_hours.toString()).toFixed(2),
                fuelLitersIssued: toDecimal(l.fuel_liters_issued.toString()).toFixed(2),
                fuelCostKes: toDecimal(l.total_fuel_cost_kes.toString()).toFixed(2),
                operatorName: l.operator_name,
                activities: l.activities_performed,
              })),
            })),
          };
        });

        return reply.send(result);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list equipment' });
      }
    }
  );

  // 1.2 Register New Plant / Equipment
  server.post(
    '/api/v1/projects/:projectId/equipment',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreatePlantEquipmentSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid plant equipment payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const created = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const item = await tx.plantEquipment.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              equipment_code: data.equipmentCode,
              name: data.name,
              equipment_type: data.equipmentType,
              ownership_type: data.ownershipType,
              rate_per_unit_kes: toDecimal(data.ratePerUnitKes).toFixed(2),
              rate_unit: data.rateUnit,
              registration_no: data.registrationNo || null,
              supplier_name: data.supplierName || null,
              current_hours_meter: toDecimal(data.currentHoursMeter).toFixed(2),
              status: 'OPERATIONAL',
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'PLANT_EQUIPMENT',
            entityId: item.id,
            projectId,
            changes: { equipmentCode: item.equipment_code, name: item.name },
          });

          return item;
        });

        return reply.status(201).send({
          message: 'Plant & equipment registered successfully',
          equipment: {
            id: created.id,
            equipmentCode: created.equipment_code,
            name: created.name,
            equipmentType: created.equipment_type,
            status: created.status,
          },
        });
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to register equipment' });
      }
    }
  );

  // 1.3 Record Equipment Daily Hours & Fuel Utilization Log
  server.post(
    '/api/v1/projects/:projectId/equipment-logs',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateEquipmentDailyLogSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid equipment daily log payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;
      const openHours = toDecimal(data.openingHoursMeter);
      const closeHours = toDecimal(data.closingHoursMeter);
      const operatingHours = toDecimal(data.operatingHours);
      const idleHours = toDecimal(data.idleOrBreakdownHours || '0.00');
      const fuelLiters = toDecimal(data.fuelLitersIssued || '0.00');
      const fuelPrice = toDecimal(data.fuelCostPerLiterKes || '180.00');
      const totalFuelCost = fuelLiters.times(fuelPrice);

      // Fuel burn rate = Liters / Operating Hours
      let burnRate = toDecimal('0.00');
      if (operatingHours.gt(0)) {
        burnRate = fuelLiters.dividedBy(operatingHours);
      }

      // Siphoning / Abnormal Burn Detection
      let efficiencyStatus: 'NORMAL' | 'ELEVATED_BURN' | 'SUSPECTED_SIPHONING' = 'NORMAL';
      if (operatingHours.eq(0) && fuelLiters.gt(0)) {
        efficiencyStatus = 'SUSPECTED_SIPHONING';
      } else if (burnRate.gt(25.0)) {
        efficiencyStatus = 'SUSPECTED_SIPHONING';
      } else if (burnRate.gt(18.0)) {
        efficiencyStatus = 'ELEVATED_BURN';
      }

      try {
        const createdLog = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const equipment = await tx.plantEquipment.findFirst({
            where: { id: data.equipmentId, project_id: projectId },
          });
          if (!equipment) throw { status: 404, message: 'Equipment not found' };

          const log = await tx.plantEquipmentDailyLog.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              equipment_id: data.equipmentId,
              log_date: new Date(data.logDate),
              operator_name: data.operatorName,
              opening_hours_meter: openHours.toFixed(2),
              closing_hours_meter: closeHours.toFixed(2),
              operating_hours: operatingHours.toFixed(2),
              idle_or_breakdown_hours: idleHours.toFixed(2),
              fuel_liters_issued: fuelLiters.toFixed(2),
              fuel_cost_per_liter_kes: fuelPrice.toFixed(2),
              total_fuel_cost_kes: totalFuelCost.toFixed(2),
              fuel_burn_liters_per_hour: burnRate.toFixed(2),
              fuel_efficiency_status: efficiencyStatus,
              activities_performed: data.activitiesPerformed || null,
              verified_by_supervisor: data.verifiedBySupervisor,
            },
          });

          // Update current hours on the machine
          await tx.plantEquipment.update({
            where: { id: data.equipmentId },
            data: { current_hours_meter: closeHours.toFixed(2) },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'PLANT_EQUIPMENT_LOG',
            entityId: log.id,
            projectId,
            changes: {
              equipmentId: data.equipmentId,
              operatingHours: operatingHours.toFixed(2),
              fuelLiters: fuelLiters.toFixed(2),
              burnRate: burnRate.toFixed(2),
              efficiencyStatus,
            },
          });

          return log;
        });

        return reply.status(201).send({
          message: 'Equipment daily log and fuel audit recorded successfully',
          log: {
            id: createdLog.id,
            operatingHours: toDecimal(createdLog.operating_hours.toString()).toFixed(2),
            fuelLitersIssued: toDecimal(createdLog.fuel_liters_issued.toString()).toFixed(2),
            totalFuelCostKes: toDecimal(createdLog.total_fuel_cost_kes.toString()).toFixed(2),
            fuelBurnLitersPerHour: toDecimal(createdLog.fuel_burn_liters_per_hour.toString()).toFixed(2),
            fuelEfficiencyStatus: createdLog.fuel_efficiency_status,
          },
        });
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to record equipment log' });
      }
    }
  );

  // ===========================================================================
  // MODULE 2: SITE CASUAL LABOR MUSTER ROLL & ARTISAN WAGE PAYROLL
  // ===========================================================================

  // 2.1 List Site Laborers
  server.get(
    '/api/v1/projects/:projectId/laborers',
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

          const laborers = await tx.siteLaborer.findMany({
            where: { project_id: projectId },
            orderBy: [{ trade_category: 'asc' }, { full_name: 'asc' }],
          });

          const totalWorkers = laborers.length;
          const activeWorkers = laborers.filter((l) => l.is_active).length;
          const fundisCount = laborers.filter((l) => l.skill_level === 'ARTISAN_FUNDI' || l.skill_level === 'CHARGEHAND_FOREMAN').length;
          const casualsCount = laborers.filter((l) => l.skill_level === 'CASUAL_MTU_WA_MKONO' || l.skill_level === 'SEMI_SKILLED').length;

          return {
            projectId,
            summary: {
              totalWorkers,
              activeWorkers,
              fundisCount,
              casualsCount,
            },
            laborers: laborers.map((l) => ({
              id: l.id,
              workerCode: l.worker_code,
              fullName: l.full_name,
              nationalIdNo: l.national_id_no,
              phoneNumber: l.phone_number,
              tradeCategory: l.trade_category,
              skillLevel: l.skill_level,
              dailyRateKes: toDecimal(l.daily_rate_kes.toString()).toFixed(2),
              isActive: l.is_active,
              createdAt: l.created_at.toISOString(),
            })),
          };
        });

        return reply.send(result);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list laborers' });
      }
    }
  );

  // 2.2 Register Artisan / Casual Laborer
  server.post(
    '/api/v1/projects/:projectId/laborers',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateSiteLaborerSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid laborer payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const created = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const laborer = await tx.siteLaborer.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              worker_code: data.workerCode,
              full_name: data.fullName,
              national_id_no: data.nationalIdNo,
              phone_number: data.phoneNumber,
              trade_category: data.tradeCategory,
              skill_level: data.skillLevel,
              daily_rate_kes: toDecimal(data.dailyRateKes).toFixed(2),
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'SITE_LABORER',
            entityId: laborer.id,
            projectId,
            changes: { workerCode: laborer.worker_code, fullName: laborer.full_name, trade: laborer.trade_category },
          });

          return laborer;
        });

        return reply.status(201).send({
          message: 'Site laborer registered successfully',
          laborer: {
            id: created.id,
            workerCode: created.worker_code,
            fullName: created.full_name,
            tradeCategory: created.trade_category,
            dailyRateKes: toDecimal(created.daily_rate_kes.toString()).toFixed(2),
          },
        });
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to register laborer' });
      }
    }
  );

  // 2.3 List Weekly Muster Rolls
  server.get(
    '/api/v1/projects/:projectId/muster-rolls',
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

          const rolls = await tx.laborMusterRoll.findMany({
            where: { project_id: projectId },
            include: { attendance_records: { include: { laborer: true } } },
            orderBy: { week_ending_date: 'desc' },
          });

          let totalDisbursed = toDecimal('0.00');
          let pendingCount = 0;

          for (const r of rolls) {
            if (r.status === 'DISBURSED') {
              totalDisbursed = totalDisbursed.plus(toDecimal(r.net_wages_payable_kes.toString()));
            } else if (r.status === 'PENDING_VERIFICATION') {
              pendingCount++;
            }
          }

          return {
            projectId,
            summary: {
              totalMusterRolls: rolls.length,
              pendingVerificationCount: pendingCount,
              totalDisbursedKes: totalDisbursed.toFixed(2),
            },
            musterRolls: rolls.map((r) => ({
              id: r.id,
              payrollNo: r.payroll_no,
              weekEndingDate: r.week_ending_date.toISOString().split('T')[0],
              totalWorkers: r.total_workers,
              totalManDays: toDecimal(r.total_man_days.toString()).toFixed(2),
              grossWagesKes: toDecimal(r.gross_wages_kes.toString()).toFixed(2),
              statutoryDeductionsKes: toDecimal(r.statutory_deductions_kes.toString()).toFixed(2),
              netWagesPayableKes: toDecimal(r.net_wages_payable_kes.toString()).toFixed(2),
              status: r.status,
              disbursementReference: r.disbursement_reference,
              disbursedAt: r.disbursed_at?.toISOString() || null,
              approvedBy: r.approved_by,
              createdAt: r.created_at.toISOString(),
            })),
          };
        });

        return reply.send(result);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list muster rolls' });
      }
    }
  );

  // 2.4 Create Weekly Muster Roll with Attendances
  server.post(
    '/api/v1/projects/:projectId/muster-rolls',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateLaborMusterRollSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid muster roll payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const createdRoll = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          // Preload laborers to calculate wages
          const laborerIds = [...new Set(data.attendances.map((a) => a.laborerId))];
          const laborers = await tx.siteLaborer.findMany({
            where: { id: { in: laborerIds }, project_id: projectId },
          });
          const laborerMap = new Map(laborers.map((l) => [l.id, l]));

          let grossWages = toDecimal('0.00');
          let totalManDays = toDecimal('0.00');

          const attendanceData = data.attendances.map((att) => {
            const lab = laborerMap.get(att.laborerId);
            if (!lab) throw { status: 400, message: `Laborer ${att.laborerId} not found in project` };

            const days = toDecimal(att.daysWorked);
            const rate = toDecimal(lab.daily_rate_kes.toString());
            const otHours = toDecimal(att.overtimeHours);

            // Overtime = (Daily Rate / 8 hrs) * 1.5 * OT Hours
            const otEarnings = otHours.gt(0)
              ? rate.dividedBy(8).times(1.5).times(otHours)
              : toDecimal('0.00');

            const dayEarnings = days.times(rate).plus(otEarnings);
            grossWages = grossWages.plus(dayEarnings);
            totalManDays = totalManDays.plus(days);

            return {
              tenant_id: tenantId,
              project_id: projectId,
              laborer_id: att.laborerId,
              attendance_date: new Date(att.attendanceDate),
              days_worked: days.toFixed(2),
              overtime_hours: otHours.toFixed(2),
              daily_earnings_kes: dayEarnings.toFixed(2),
              task_assigned: att.taskAssigned || null,
              verified_by: att.verifiedBy,
            };
          });

          // Create Master Roll
          const musterRoll = await tx.laborMusterRoll.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              payroll_no: data.payrollNo,
              week_ending_date: new Date(data.weekEndingDate),
              total_workers: laborerIds.length,
              total_man_days: totalManDays.toFixed(2),
              gross_wages_kes: grossWages.toFixed(2),
              statutory_deductions_kes: '0.00',
              net_wages_payable_kes: grossWages.toFixed(2),
              status: 'PENDING_VERIFICATION',
              notes: data.notes || null,
              attendance_records: {
                create: attendanceData.map((d) => ({
                  tenant_id: d.tenant_id,
                  project_id: d.project_id,
                  laborer_id: d.laborer_id,
                  attendance_date: d.attendance_date,
                  days_worked: d.days_worked,
                  overtime_hours: d.overtime_hours,
                  daily_earnings_kes: d.daily_earnings_kes,
                  task_assigned: d.task_assigned,
                  verified_by: d.verified_by,
                })),
              },
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'LABOR_MUSTER_ROLL',
            entityId: musterRoll.id,
            projectId,
            changes: {
              payrollNo: musterRoll.payroll_no,
              totalWorkers: musterRoll.total_workers,
              netWagesKes: grossWages.toFixed(2),
            },
          });

          return musterRoll;
        });

        return reply.status(201).send({
          message: 'Weekly labor muster roll compiled and saved',
          musterRoll: {
            id: createdRoll.id,
            payrollNo: createdRoll.payroll_no,
            totalWorkers: createdRoll.total_workers,
            totalManDays: toDecimal(createdRoll.total_man_days.toString()).toFixed(2),
            netWagesPayableKes: toDecimal(createdRoll.net_wages_payable_kes.toString()).toFixed(2),
            status: createdRoll.status,
          },
        });
      } catch (err: any) {
        if (err.status === 404 || err.status === 400) {
          return reply.status(err.status).send({ statusCode: err.status, error: 'Error', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to create muster roll' });
      }
    }
  );

  // 2.5 Review & Disburse Muster Roll (QS Approval & M-Pesa B2C Paybill)
  server.patch(
    '/api/v1/projects/:projectId/muster-rolls/:musterRollId',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, musterRollId } = request.params as { projectId: string; musterRollId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(musterRollId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found' });
      }

      const parseResult = ReviewLaborMusterRollSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid muster roll review payload',
          details: parseResult.error.flatten(),
        });
      }

      const { status, disbursementReference, approvedBy } = parseResult.data;

      try {
        const updated = await withTenantTx(prisma, tenantId, async (tx) => {
          const roll = await tx.laborMusterRoll.findFirst({
            where: { id: musterRollId, project_id: projectId },
          });
          if (!roll) throw { status: 404, message: 'Muster roll not found' };

          const res = await tx.laborMusterRoll.update({
            where: { id: musterRollId },
            data: {
              status,
              disbursement_reference: disbursementReference || roll.disbursement_reference,
              disbursed_at: status === 'DISBURSED' ? new Date() : roll.disbursed_at,
              approved_by: approvedBy || (status === 'QS_APPROVED' ? sub : roll.approved_by),
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'REVIEW',
            entityType: 'LABOR_MUSTER_ROLL',
            entityId: res.id,
            projectId,
            changes: { status, disbursementReference: res.disbursement_reference },
          });

          return res;
        });

        return reply.send({
          message: `Muster roll status updated to ${status}`,
          musterRoll: {
            id: updated.id,
            status: updated.status,
            disbursementReference: updated.disbursement_reference,
            disbursedAt: updated.disbursed_at?.toISOString() || null,
          },
        });
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to update muster roll' });
      }
    }
  );

  // ===========================================================================
  // MODULE 3: FIELD SAFETY AUDITS & DOSHS/NCA COMPLIANCE SCORECARDS
  // ===========================================================================

  // 3.1 List Safety Audits
  server.get(
    '/api/v1/projects/:projectId/safety-audits',
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

          const audits = await tx.safetyAuditRecord.findMany({
            where: { project_id: projectId },
            orderBy: { audit_date: 'desc' },
          });

          const totalAudits = audits.length;
          const passCount = audits.filter((a) => a.audit_outcome === 'SATISFACTORY').length;
          const stopOrdersCount = audits.filter((a) => a.audit_outcome === 'STOP_ORDER_ISSUED').length;
          const averageScore = totalAudits > 0
            ? (audits.reduce((sum, a) => sum + Number(a.overall_compliance_score), 0) / totalAudits).toFixed(1)
            : '100.0';

          return {
            projectId,
            summary: {
              totalAudits,
              passCount,
              stopOrdersCount,
              averageComplianceScorePct: averageScore,
            },
            audits: audits.map((a) => ({
              id: a.id,
              auditNo: a.audit_no,
              auditDate: a.audit_date.toISOString().split('T')[0],
              auditorName: a.auditor_name,
              auditorType: a.auditor_type,
              ppeComplianceScore: toDecimal(a.ppe_compliance_score.toString()).toFixed(2),
              scaffoldingAndEdgeProtectionStatus: a.scaffolding_and_edge_protection_status,
              excavationAndShoringStatus: a.excavation_and_shoring_status,
              firstAidAndFireStationStatus: a.first_aid_and_fire_station_status,
              electricalSafetyAndCablesStatus: a.electrical_safety_and_cables_status,
              overallComplianceScore: toDecimal(a.overall_compliance_score.toString()).toFixed(2),
              auditOutcome: a.audit_outcome,
              correctiveActionPlan: a.corrective_action_plan,
              reinspectionDueDate: a.reinspection_due_date ? a.reinspection_due_date.toISOString().split('T')[0] : null,
              status: a.status,
              createdAt: a.created_at.toISOString(),
            })),
          };
        });

        return reply.send(result);
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to list safety audits' });
      }
    }
  );

  // 3.2 Record Field Safety Audit
  server.post(
    '/api/v1/projects/:projectId/safety-audits',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateSafetyAuditSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid safety audit payload',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;
      const ppeScore = toDecimal(data.ppeComplianceScore);

      // Weights: PPE (40%), Scaffolding (20%), Excavation (20%), First Aid/Fire (10%), Electrical (10%)
      let scaffoldScore = data.scaffoldingAndEdgeProtectionStatus === 'PASS' ? 20 : (data.scaffoldingAndEdgeProtectionStatus === 'MINOR_DEFECTS' ? 12 : 0);
      let excavationScore = data.excavationAndShoringStatus === 'PASS' ? 20 : (data.excavationAndShoringStatus === 'NOT_APPLICABLE' ? 20 : (data.excavationAndShoringStatus === 'MINOR_DEFECTS' ? 10 : 0));
      let firstAidScore = data.firstAidAndFireStationStatus === 'PASS' ? 10 : (data.firstAidAndFireStationStatus === 'DEFICIENT' ? 5 : 0);
      let electricalScore = data.electricalSafetyAndCablesStatus === 'PASS' ? 10 : 0;

      const ppeWeighted = ppeScore.times(0.40);
      const overallScore = ppeWeighted.plus(scaffoldScore).plus(excavationScore).plus(firstAidScore).plus(electricalScore);

      let auditOutcome: 'SATISFACTORY' | 'CORRECTIVE_ACTION_REQUIRED' | 'STOP_ORDER_ISSUED' = 'SATISFACTORY';
      if (
        data.scaffoldingAndEdgeProtectionStatus === 'FAIL_STOP_WORK' ||
        data.excavationAndShoringStatus === 'FAIL_STOP_WORK' ||
        data.electricalSafetyAndCablesStatus === 'HAZARDOUS'
      ) {
        auditOutcome = 'STOP_ORDER_ISSUED';
      } else if (overallScore.lt(80.0) || data.scaffoldingAndEdgeProtectionStatus === 'MINOR_DEFECTS' || data.excavationAndShoringStatus === 'MINOR_DEFECTS') {
        auditOutcome = 'CORRECTIVE_ACTION_REQUIRED';
      }

      try {
        const createdAudit = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const audit = await tx.safetyAuditRecord.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              audit_no: data.auditNo,
              audit_date: new Date(data.auditDate),
              auditor_name: data.auditorName,
              auditor_type: data.auditorType,
              ppe_compliance_score: ppeScore.toFixed(2),
              scaffolding_and_edge_protection_status: data.scaffoldingAndEdgeProtectionStatus,
              excavation_and_shoring_status: data.excavationAndShoringStatus,
              first_aid_and_fire_station_status: data.firstAidAndFireStationStatus,
              electrical_safety_and_cables_status: data.electricalSafetyAndCablesStatus,
              overall_compliance_score: overallScore.toFixed(2),
              audit_outcome: auditOutcome,
              corrective_action_plan: data.correctiveActionPlan || null,
              reinspection_due_date: data.reinspectionDueDate ? new Date(data.reinspectionDueDate) : null,
              status: auditOutcome === 'SATISFACTORY' ? 'CLOSED' : 'OPEN',
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'SAFETY_AUDIT',
            entityId: audit.id,
            projectId,
            changes: {
              auditNo: audit.audit_no,
              score: overallScore.toFixed(2),
              outcome: auditOutcome,
            },
          });

          return audit;
        });

        return reply.status(201).send({
          message: 'Field safety audit and compliance scorecard saved',
          audit: {
            id: createdAudit.id,
            auditNo: createdAudit.audit_no,
            overallComplianceScore: toDecimal(createdAudit.overall_compliance_score.toString()).toFixed(2),
            auditOutcome: createdAudit.audit_outcome,
            status: createdAudit.status,
          },
        });
      } catch (err: any) {
        if (err.status === 404) {
          return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: err.message });
        }
        request.log.error(err);
        return reply.status(500).send({ statusCode: 500, error: 'Internal Server Error', message: 'Failed to record safety audit' });
      }
    }
  );
};

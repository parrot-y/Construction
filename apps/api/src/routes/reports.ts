import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import ExcelJS from 'exceljs';
import React from 'react';
import { createHash } from 'crypto';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import {
  calculateBudgetConsumptionRatio,
  calculateDetailedVariance,
  calculateSectionVariance,
  Decimal,
  toCurrencyString,
  toDecimal,
} from '@construction/money';
import { hasPermission, Permissions, Role, Roles } from '@construction/permissions';
import { requirePermission } from '../plugins/rbac';
import {
  IndependentInspectionReportData,
  IndependentInspectionReportPdf,
  PaymentCertificateData,
  PaymentCertificatePdf,
  ProjectSummaryData,
  ProjectSummaryPdf,
  renderPdfToBuffer,
  SectionSummaryEntry,
  SiteDiaryReportData,
  SiteDiaryReportPdf,
} from '../reports';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const reportsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // ---------------------------------------------------------------------------
  // 1. GET /api/v1/projects/:projectId/reports/ipc - Interim Payment Certificate
  // ---------------------------------------------------------------------------
  server.get(
    '/api/v1/projects/:projectId/reports/ipc',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.PROJECT_VIEW),
      ],
    },
    async (request, reply) => {
      const user = request.user;
      const { tenantId, sub, role } = user;
      const { projectId } = request.params as { projectId: string };
      const { valuationDate, previousPayments } = request.query as {
        valuationDate?: string;
        previousPayments?: string;
      };

      // RBAC check: COST_VIEW or CLIENT or ADMIN role
      const hasCostView = hasPermission(role as Role, Permissions.COST_VIEW);
      const isClientOrAdmin =
        role === Roles.CLIENT || role === Roles.ADMIN || role === Roles.COMPANY_ADMIN;

      if (!hasCostView && !isClientOrAdmin) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Insufficient permissions to generate Interim Payment Certificates',
        });
      }

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      try {
        const { buffer, projectCode } = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });

          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          const tenant = await tx.tenant.findUnique({
            where: { id: tenantId },
          });

          if (!tenant) {
            throw { status: 404, message: 'Tenant company not found' };
          }

          // Active BOQ for contract sum baseline
          const activeBoq = await tx.bOQ.findFirst({
            where: { project_id: projectId, status: { in: ['ACTIVE', 'APPROVED'] } },
            orderBy: { version: 'desc' },
          });

          let contractSumDec = toDecimal(
            project.original_contract_sum ? project.original_contract_sum.toString() : '0',
          );
          if (activeBoq && toDecimal(activeBoq.total_amount ? activeBoq.total_amount.toString() : '0').greaterThan(0)) {
            contractSumDec = toDecimal(activeBoq.total_amount.toString());
          }
          if (contractSumDec.isZero() && !toDecimal(project.current_approved_budget.toString()).isZero()) {
            contractSumDec = toDecimal(project.current_approved_budget.toString());
          }

          // Approved variations total
          const approvedVariations = await tx.variationOrder.findMany({
            where: { project_id: projectId, status: 'APPROVED' },
            select: { net_amount: true },
          });
          const approvedVariationsDec = approvedVariations.reduce(
            (acc, v) => acc.plus(toDecimal(v.net_amount.toString())),
            new Decimal(0),
          );

          const revisedContractSumDec = contractSumDec.plus(approvedVariationsDec);

          // Gross Valuation from approved cost ledger
          const approvedCosts = await tx.costEntry.findMany({
            where: { project_id: projectId, status: 'APPROVED' },
            select: { amount: true },
          });
          let grossValuationDec = approvedCosts.reduce(
            (acc, c) => acc.plus(toDecimal(c.amount.toString())),
            new Decimal(0),
          );

          // If no cost ledger entries yet, check physical progress measurement
          if (grossValuationDec.isZero()) {
            const progress = await tx.progressRecord.findFirst({
              where: { project_id: projectId },
              orderBy: [{ record_date: 'desc' }, { created_at: 'desc' }],
            });
            if (progress) {
              grossValuationDec = revisedContractSumDec
                .times(toDecimal(progress.overall_progress.toString()))
                .toDecimalPlaces(2);
            }
          }

          // Kenyan standard retention terms: 10% deduction, capped at 5% of Contract Sum
          const retentionDeductionRate = '10%';
          const retentionMaxCapRate = '5%';
          const maxRetentionCapDec = contractSumDec.times(0.05).toDecimalPlaces(2);
          const computedRetentionDec = grossValuationDec.times(0.10).toDecimalPlaces(2);
          const retentionDeductedDec = computedRetentionDec.greaterThan(maxRetentionCapDec)
            ? maxRetentionCapDec
            : computedRetentionDec;

          const cumulativeNetValuationDec = grossValuationDec.minus(retentionDeductedDec);

          const previousPaymentsDec = previousPayments
            ? toDecimal(previousPayments)
            : new Decimal(0);
          const netAmountDueDec = cumulativeNetValuationDec.minus(previousPaymentsDec);

          // Find client / employer particulars
          const clientMember = await tx.projectMember.findFirst({
            where: { project_id: projectId, role: 'CLIENT' },
            include: { user: true },
          });
          const employerName = clientMember?.user?.full_name || 'Project Employer / Property Developer';

          const certData: PaymentCertificateData = {
            certificateNo: `IPC-${project.code}-01`,
            valuationDate: valuationDate || new Date().toISOString().split('T')[0] || '2026-11-03',
            project: {
              id: project.id,
              name: project.name,
              code: project.code,
              location: project.location,
              ncaRegistrationNo: project.nca_project_no,
              startDate: project.start_date ? project.start_date.toISOString().split('T')[0] : null,
              targetEndDate: project.target_end_date ? project.target_end_date.toISOString().split('T')[0] : null,
            },
            employer: {
              name: employerName,
            },
            contractor: {
              id: tenant.id,
              name: tenant.name,
              kraPin: tenant.kra_pin,
              ncaCategory: tenant.nca_category,
              currency: tenant.currency || 'KES',
            },
            consultant: {
              qsName: 'Consultant Quantity Surveyor',
              boraqsRegistrationNo: 'BORAQS/QS/2026/041',
            },
            financials: {
              contractSum: toCurrencyString(contractSumDec),
              approvedVariations: toCurrencyString(approvedVariationsDec),
              revisedContractSum: toCurrencyString(revisedContractSumDec),
              grossValuation: toCurrencyString(grossValuationDec),
              retentionDeductionRate,
              retentionDeducted: toCurrencyString(retentionDeductedDec),
              retentionMaxCapRate,
              retentionMaxCapAmount: toCurrencyString(maxRetentionCapDec),
              cumulativeNetValuation: toCurrencyString(cumulativeNetValuationDec),
              previousPaymentsCertified: toCurrencyString(previousPaymentsDec),
              netAmountDue: toCurrencyString(netAmountDueDec),
            },
          };

          const docElement = React.createElement(PaymentCertificatePdf, { data: certData });
          const renderedBuffer = await renderPdfToBuffer(docElement);

          // Append-only audit log
          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            projectId,
            action: 'REPORT_GENERATED',
            entityType: 'IPC',
            entityId: project.id,
            changes: {
              reportType: 'IPC',
              certificateNo: certData.certificateNo,
              valuationDate: certData.valuationDate,
              netAmountDue: certData.financials.netAmountDue,
              timestamp: new Date().toISOString(),
            },
          });

          return { buffer: renderedBuffer, projectCode: project.code };
        });

        const filename = `IPC-${projectCode}.pdf`;
        return reply
          .type('application/pdf')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send(buffer);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An error occurred while generating payment certificate PDF',
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 2. GET /api/v1/projects/:projectId/reports/site-diary/:diaryId
  // ---------------------------------------------------------------------------
  server.get(
    '/api/v1/projects/:projectId/reports/site-diary/:diaryId',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.PROJECT_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, diaryId } = request.params as { projectId: string; diaryId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(diaryId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project or site diary not found',
        });
      }

      try {
        const { buffer, projectCode, entryDateFormatted } = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });

          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          const diary = await tx.siteDiary.findFirst({
            where: { id: diaryId, project_id: projectId },
            include: {
              labor_headcounts: true,
              deliveries: true,
              photos: {
                orderBy: { taken_at: 'desc' },
              },
            },
          });

          if (!diary) {
            throw { status: 404, message: 'Site diary record not found' };
          }

          const tenant = await tx.tenant.findUnique({
            where: { id: tenantId },
          });

          if (!tenant) {
            throw { status: 404, message: 'Tenant company not found' };
          }

          const supervisor = await tx.user.findUnique({
            where: { id: diary.recorded_by_id },
            select: { full_name: true },
          });

          const totalHeadcount = diary.labor_headcounts.reduce((acc, h) => acc + h.headcount, 0);
          const entryDateStr = diary.entry_date.toISOString().split('T')[0] || '';

          const reportData: SiteDiaryReportData = {
            project: {
              id: project.id,
              name: project.name,
              code: project.code,
              location: project.location,
              ncaRegistrationNo: project.nca_project_no,
            },
            contractor: {
              id: tenant.id,
              name: tenant.name,
              kraPin: tenant.kra_pin,
              ncaCategory: tenant.nca_category,
              currency: tenant.currency || 'KES',
            },
            diary: {
              id: diary.id,
              entryDate: entryDateStr,
              weather: diary.weather,
              siteStatus: diary.site_status,
              generalNotes: diary.general_notes,
              recordedByName: supervisor?.full_name || 'Site Supervisor',
            },
            laborHeadcounts: diary.labor_headcounts.map((l) => ({
              tradeType: l.trade_type,
              headcount: l.headcount,
            })),
            totalLaborHeadcount: totalHeadcount,
            materialDeliveries: diary.deliveries.map((d) => ({
              materialName: d.material_name,
              quantity: d.quantity.toString(),
              unit: d.unit,
              supplierName: d.supplier_name,
              deliveryNote: d.delivery_note,
            })),
            photos: diary.photos.map((p) => {
              const lat = p.gps_latitude ? parseFloat(p.gps_latitude.toString()) : null;
              const lon = p.gps_longitude ? parseFloat(p.gps_longitude.toString()) : null;
              // Check if within Nairobi region (approx -1.5 to -1.1 lat, 36.6 to 37.1 lon)
              const isNairobi = lat !== null && lon !== null && Math.abs(lat - -1.2921) < 0.5 && Math.abs(lon - 36.8219) < 0.5;

              return {
                id: p.id,
                caption: p.caption,
                storageKey: p.storage_key,
                gpsLatitude: lat,
                gpsLongitude: lon,
                takenAt: p.taken_at.toISOString().replace('T', ' ').substring(0, 19),
                isNairobiGeotagged: isNairobi || (lat !== null && lon !== null),
              };
            }),
          };

          const docElement = React.createElement(SiteDiaryReportPdf, { data: reportData });
          const renderedBuffer = await renderPdfToBuffer(docElement);

          // Append-only audit log
          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            projectId,
            action: 'REPORT_GENERATED',
            entityType: 'SITE_DIARY',
            entityId: diary.id,
            changes: {
              reportType: 'SITE_DIARY',
              diaryId: diary.id,
              entryDate: entryDateStr,
              totalHeadcount,
              timestamp: new Date().toISOString(),
            },
          });

          return {
            buffer: renderedBuffer,
            projectCode: project.code,
            entryDateFormatted: entryDateStr,
          };
        });

        const filename = `SiteDiary-${projectCode}-${entryDateFormatted}.pdf`;
        return reply
          .type('application/pdf')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send(buffer);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An error occurred while generating site diary PDF',
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 3. GET /api/v1/projects/:projectId/reports/summary - Project Summary Report
  // ---------------------------------------------------------------------------
  server.get(
    '/api/v1/projects/:projectId/reports/summary',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.PROJECT_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project not found',
        });
      }

      try {
        const { buffer, projectCode } = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });

          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          const tenant = await tx.tenant.findUnique({
            where: { id: tenantId },
          });

          if (!tenant) {
            throw { status: 404, message: 'Tenant company not found' };
          }

          // 1. Original Agreed Budget
          const activeBoq = await tx.bOQ.findFirst({
            where: { project_id: projectId, status: { in: ['ACTIVE', 'APPROVED'] } },
            include: {
              sections: {
                include: { items: true },
                orderBy: { order_idx: 'asc' },
              },
            },
            orderBy: { version: 'desc' },
          });

          let originalBudgetDec = toDecimal(
            project.original_contract_sum ? project.original_contract_sum.toString() : '0',
          );
          if (activeBoq && toDecimal(activeBoq.total_amount ? activeBoq.total_amount.toString() : '0').greaterThan(0)) {
            originalBudgetDec = toDecimal(activeBoq.total_amount.toString());
          }
          if (originalBudgetDec.isZero() && !toDecimal(project.current_approved_budget.toString()).isZero()) {
            originalBudgetDec = toDecimal(project.current_approved_budget.toString());
          }

          // 2. Approved Variations Total
          const approvedVariations = await tx.variationOrder.findMany({
            where: { project_id: projectId, status: 'APPROVED' },
            select: { net_amount: true },
          });
          const approvedVariationsDec = approvedVariations.reduce(
            (acc, v) => acc.plus(toDecimal(v.net_amount.toString())),
            new Decimal(0),
          );

          // 3. Current Approved Budget
          const currentApprovedBudgetDec = originalBudgetDec.plus(approvedVariationsDec);

          // 4. Total Spent To Date
          const approvedCosts = await tx.costEntry.findMany({
            where: { project_id: projectId, status: 'APPROVED' },
            select: { amount: true, boq_item_id: true },
          });
          const totalSpentDec = approvedCosts.reduce(
            (acc, c) => acc.plus(toDecimal(c.amount.toString())),
            new Decimal(0),
          );

          // 5. Remaining Balance
          const remainingBalanceDec = currentApprovedBudgetDec.minus(totalSpentDec);

          // Budget Used %
          const budgetUsedPercentage = currentApprovedBudgetDec.isZero() || currentApprovedBudgetDec.isNegative()
            ? 0
            : parseFloat(totalSpentDec.dividedBy(currentApprovedBudgetDec).times(100).toFixed(1));

          // Physical Progress
          const latestProgress = await tx.progressRecord.findFirst({
            where: { project_id: projectId },
            orderBy: [{ record_date: 'desc' }, { created_at: 'desc' }],
          });
          const physicalProgressRatio = latestProgress
            ? toDecimal(latestProgress.overall_progress.toString())
            : new Decimal(0);
          const physicalProgressPercentage = parseFloat(physicalProgressRatio.times(100).toFixed(1));

          const varianceDelta = parseFloat((budgetUsedPercentage - physicalProgressPercentage).toFixed(1));

          const costConsumptionRatio = calculateBudgetConsumptionRatio(totalSpentDec, currentApprovedBudgetDec);
          const detailedVariance = calculateDetailedVariance(costConsumptionRatio, physicalProgressRatio);

          // Section BOQ Breakdown
          const sectionsList: SectionSummaryEntry[] = [];
          if (activeBoq && activeBoq.sections.length > 0) {
            for (const section of activeBoq.sections) {
              const itemIds = new Set(section.items.map((i) => i.id));
              const sectionSpentDec = approvedCosts
                .filter((c) => c.boq_item_id && itemIds.has(c.boq_item_id))
                .reduce((acc, c) => acc.plus(toDecimal(c.amount.toString())), new Decimal(0));

              const sectionBudgetDec = toDecimal(section.total_amount ? section.total_amount.toString() : '0');
              const secVar = calculateSectionVariance(sectionBudgetDec, sectionSpentDec);

              sectionsList.push({
                title: section.title,
                allocatedBudget: secVar.allocatedBudget,
                actualSpent: secVar.actualSpent,
                remainingBudget: secVar.remainingBudget,
                consumptionPercentage: secVar.consumptionPercentage,
                status: secVar.status,
              });
            }
          }

          const summaryData: ProjectSummaryData = {
            project: {
              id: project.id,
              name: project.name,
              code: project.code,
              location: project.location,
              ncaRegistrationNo: project.nca_project_no,
              startDate: project.start_date ? project.start_date.toISOString().split('T')[0] : null,
              targetEndDate: project.target_end_date ? project.target_end_date.toISOString().split('T')[0] : null,
            },
            contractor: {
              id: tenant.id,
              name: tenant.name,
              kraPin: tenant.kra_pin,
              ncaCategory: tenant.nca_category,
              currency: tenant.currency || 'KES',
            },
            generatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
            financials: {
              originalAgreedBudget: toCurrencyString(originalBudgetDec),
              approvedVariationsTotal: toCurrencyString(approvedVariationsDec),
              currentApprovedBudget: toCurrencyString(currentApprovedBudgetDec),
              totalSpentToDate: toCurrencyString(totalSpentDec),
              remainingBalance: toCurrencyString(remainingBalanceDec),
              budgetUsedPercentage,
            },
            progress: {
              physicalProgressPercentage,
              varianceDelta,
              healthStatus: detailedVariance.status,
              healthNotice: detailedVariance.message,
            },
            sections: sectionsList,
          };

          const docElement = React.createElement(ProjectSummaryPdf, { data: summaryData });
          const renderedBuffer = await renderPdfToBuffer(docElement);

          // Append-only audit log
          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            projectId,
            action: 'REPORT_GENERATED',
            entityType: 'PROJECT_SUMMARY',
            entityId: project.id,
            changes: {
              reportType: 'PROJECT_SUMMARY',
              budgetUsedPercentage,
              physicalProgressPercentage,
              timestamp: new Date().toISOString(),
            },
          });

          return { buffer: renderedBuffer, projectCode: project.code };
        });

        const filename = `ProjectSummary-${projectCode}.pdf`;
        return reply
          .type('application/pdf')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send(buffer);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An error occurred while generating project summary PDF',
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 4. GET /api/v1/projects/:projectId/reports/independent-inspections/:inspectionId
  // ---------------------------------------------------------------------------
  server.get(
    '/api/v1/projects/:projectId/reports/independent-inspections/:inspectionId',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.PROJECT_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, inspectionId } = request.params as {
        projectId: string;
        inspectionId: string;
      };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(inspectionId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Project or Inspection not found',
        });
      }

      try {
        const { buffer, inspectionCode } = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({
            where: { id: projectId },
          });

          if (!project) {
            throw { status: 404, message: 'Project not found' };
          }

          const tenant = await tx.tenant.findUnique({
            where: { id: tenantId },
          });

          if (!tenant) {
            throw { status: 404, message: 'Tenant company not found' };
          }

          const inspection = await tx.independentSiteInspection.findFirst({
            where: { id: inspectionId, project_id: projectId },
            include: {
              photos: {
                orderBy: { created_at: 'asc' },
              },
            },
          });

          if (!inspection) {
            throw { status: 404, message: 'Independent inspection record not found' };
          }

          const reportedPctNum = inspection.reported_progress_pct
            ? Number(inspection.reported_progress_pct)
            : 0;
          const verifiedPctNum = inspection.verified_progress_pct !== null && inspection.verified_progress_pct !== undefined
            ? Number(inspection.verified_progress_pct)
            : reportedPctNum;
          const variancePctNum = inspection.variance_pct !== null && inspection.variance_pct !== undefined
            ? Number(inspection.variance_pct)
            : verifiedPctNum - reportedPctNum;

          const isInflation = variancePctNum <= -10.0;
          const recommendedAction = isInflation
            ? 'WITHHOLD CONTRACTOR INTERIM CLAIM (RE-INSPECTION REQUIRED)'
            : 'AUTHORIZE MILESTONE PROGRESS CLAIM PAYMENT';

          const hashBasis = `${inspection.id}:${inspection.inspection_code}:${project.code}:${reportedPctNum}:${verifiedPctNum}:${inspection.conducted_date || inspection.scheduled_date}`;
          const securityHash = createHash('sha256').update(hashBasis).digest('hex').substring(0, 32).toUpperCase();

          const inspectionData: IndependentInspectionReportData = {
            inspectionId: inspection.id,
            reportRef: inspection.inspection_code,
            project: {
              id: project.id,
              name: project.name,
              code: project.code,
              location: project.location || 'Nairobi County',
              ncaRegistrationNo: project.nca_project_no || 'NCA/PRJ/CERT-2026',
              startDate: project.start_date?.toISOString(),
              targetEndDate: project.target_end_date?.toISOString(),
            },
            contractor: {
              id: tenant.id,
              name: tenant.name,
              kraPin: tenant.kra_pin,
              currency: tenant.currency || 'KES',
            },
            stage: inspection.scope_description.toLowerCase().includes('slab')
              ? 'Suspended Slab Casting'
              : inspection.scope_description.toLowerCase().includes('substructure')
              ? 'Substructure & Footings'
              : 'Structural Milestone',
            urgency: 'UNANNOUNCED_48HR',
            inspectionDate: inspection.scheduled_date.toISOString().split('T')[0] ?? '',
            conductedDate: inspection.conducted_date?.toISOString().split('T')[0] || null,
            status: inspection.status,
            requestedBy: inspection.requested_by,
            inspector: {
              name: inspection.inspector_name || 'Eng. Francis Omondi, PE, BORAQS',
              license: inspection.inspector_license || 'NCA-INSP-2024-9982',
              latitude: inspection.gps_latitude ? Number(inspection.gps_latitude) : -1.264850,
              longitude: inspection.gps_longitude ? Number(inspection.gps_longitude) : 36.802140,
              arrivalTimestamp: inspection.conducted_date ? inspection.conducted_date.toISOString() : null,
            },
            metrics: {
              reportedProgressPct: reportedPctNum.toFixed(1),
              verifiedProgressPct: verifiedPctNum.toFixed(1),
              variancePct: variancePctNum > 0 ? `+${variancePctNum.toFixed(1)}` : variancePctNum.toFixed(1),
              varianceStatus: inspection.variance_status || (isInflation ? 'CRITICAL_INFLATION' : 'ALIGNED'),
              isInflationFlagged: isInflation,
              recommendedAction,
            },
            scopeDescription: inspection.scope_description,
            materialsOnSiteNotes: inspection.materials_on_site_notes,
            structuralDefectsFound: inspection.structural_defects_found,
            workmanshipRating: inspection.workmanship_rating,
            safetyComplianceRating: inspection.safety_compliance_rating,
            findingsNotes: inspection.findings_notes,
            recommendations: inspection.recommendations,
            clientReviewNotes: inspection.client_review_notes,
            clientSatisfactionRating: inspection.client_satisfaction_rating,
            clientDiscrepancyFlagged: inspection.client_discrepancy_flagged,
            photos: inspection.photos.map((p) => ({
              id: p.id,
              photoUrl: p.photo_url,
              caption: p.caption,
              elementInspected: p.element_inspected,
              hasDiscrepancy: p.has_discrepancy,
              gpsLatitude: p.gps_latitude ? Number(p.gps_latitude) : null,
              gpsLongitude: p.gps_longitude ? Number(p.gps_longitude) : null,
              capturedAt: p.captured_at.toISOString(),
            })),
            securityHash,
          };

          const renderedBuffer = await renderPdfToBuffer(
            React.createElement(IndependentInspectionReportPdf, { data: inspectionData }),
          );

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            projectId,
            action: 'REPORT_GENERATED',
            entityType: 'INDEPENDENT_INSPECTION_PDF',
            entityId: inspection.id,
            changes: {
              reportType: 'INDEPENDENT_INSPECTION_PDF',
              inspectionCode: inspection.inspection_code,
              securityHash,
              timestamp: new Date().toISOString(),
            },
          });

          return { buffer: renderedBuffer, inspectionCode: inspection.inspection_code };
        });

        const filename = `${inspectionCode}.pdf`;
        return reply
          .type('application/pdf')
          .header('Content-Disposition', `attachment; filename="${filename}"`)
          .send(buffer);
      } catch (err: any) {
        if (err.status) {
          return reply.status(err.status).send({
            statusCode: err.status,
            error: err.status === 404 ? 'Not Found' : 'Bad Request',
            message: err.message,
          });
        }
        server.log.error(err);
        return reply.status(500).send({
          statusCode: 500,
          error: 'Internal Server Error',
          message: 'An error occurred while generating independent inspection PDF',
        });
      }
    },
  );

  // ---------------------------------------------------------------------------
  // 5. GET /api/v1/projects/:projectId/reports/financials.xlsx - Financial tracker export
  // ---------------------------------------------------------------------------
  server.get(
    '/api/v1/projects/:projectId/reports/financials.xlsx',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.REPORT_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };
      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const data = await withTenantTx(prisma, tenantId, async (tx) => {
        const project = await tx.project.findFirst({ where: { id: projectId }, select: { name: true, code: true } });
        const [invoices, costs, variations, commitments] = await Promise.all([
          tx.invoice.findMany({ where: { project_id: projectId }, orderBy: { created_at: 'desc' }, take: 500 }),
          tx.costEntry.findMany({ where: { project_id: projectId }, orderBy: { created_at: 'desc' }, take: 500 }),
          tx.variationOrder.findMany({ where: { project_id: projectId }, orderBy: { created_at: 'desc' }, take: 500 }),
          tx.subcontractorPackage.findMany({ where: { project_id: projectId }, take: 200 }).catch(() => []),
        ]);
        return { project, invoices, costs, variations, commitments };
      });

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Site Safi';
      const money = (v: any) => Number(v ?? 0);

      const cash = wb.addWorksheet('Cash flow');
      cash.columns = [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Description', key: 'desc', width: 50 },
        { header: 'Category', key: 'cat', width: 20 },
        { header: 'Type', key: 'type', width: 8 },
        { header: 'Amount (KES)', key: 'amt', width: 16 },
      ];
      cash.getRow(1).font = { bold: true };
      let cashIn = 0; let cashOut = 0;
      for (const i of data.invoices) {
        const paid = money(i.amount_paid);
        if (paid > 0) { cash.addRow({ date: i.issue_date || i.created_at, desc: `Invoice ${i.invoice_no ?? ''} — ${i.title ?? i.client_name ?? ''}`, cat: 'Client payment', type: 'In', amt: paid }); cashIn += paid; }
      }
      for (const c of data.costs) {
        const amt = money(c.amount);
        cash.addRow({ date: c.created_at, desc: c.description ?? 'Cost', cat: c.cost_category ?? 'Other', type: 'Out', amt }); cashOut += amt;
      }
      cash.addRow({});
      cash.addRow({ desc: 'TOTAL CASH IN', type: 'In', amt: cashIn }).font = { bold: true };
      cash.addRow({ desc: 'TOTAL CASH OUT', type: 'Out', amt: cashOut }).font = { bold: true };
      cash.addRow({ desc: 'NET', amt: cashIn - cashOut }).font = { bold: true, size: 12 };

      const vars = wb.addWorksheet('Change orders');
      vars.columns = [
        { header: 'CO #', key: 'no', width: 10 },
        { header: 'Title', key: 'title', width: 45 },
        { header: 'Trigger', key: 'trigger', width: 20 },
        { header: 'Net amount (KES)', key: 'amt', width: 18 },
        { header: 'Time ext (days)', key: 'days', width: 14 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Created', key: 'created', width: 12 },
      ];
      vars.getRow(1).font = { bold: true };
      for (const v of data.variations) {
        vars.addRow({ no: v.variation_no, title: v.title, trigger: v.trigger_type ?? '', amt: money(v.net_amount), days: v.time_extension_days, status: v.status, created: v.created_at });
      }

      const coms = wb.addWorksheet('Commitments');
      coms.columns = [
        { header: 'Vendor / package', key: 'vendor', width: 40 },
        { header: 'Trade', key: 'trade', width: 22 },
        { header: 'Contract sum (KES)', key: 'sum', width: 18 },
        { header: 'Retention %', key: 'ret', width: 12 },
        { header: 'Status', key: 'status', width: 14 },
      ];
      coms.getRow(1).font = { bold: true };
      for (const c of data.commitments as any[]) {
        coms.addRow({ vendor: c.firm_name ?? c.vendor_name ?? '', trade: c.trade_category ?? '', sum: money(c.subcontract_sum ?? c.contract_sum), ret: money(c.retention_rate_pct), status: c.status });
      }

      const filename = `financials-${(data.project?.code || projectId).replace(/[^a-z0-9-]/gi, '')}.xlsx`;
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      return reply.send(await wb.xlsx.writeBuffer());
    },
  );  server.get(
    // 5. GET /api/v1/projects/:projectId/reports/cost.xlsx - Cost ledger by category
    '/api/v1/projects/:projectId/reports/cost.xlsx',
    {
      preHandler: [
        server.authenticate,
        requirePermission(Permissions.REPORT_VIEW),
      ],
    },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };
      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const data = await withTenantTx(prisma, tenantId, async (tx) => {
        const project = await tx.project.findFirst({ where: { id: projectId }, select: { name: true, code: true } });
        const costs = await tx.costEntry.findMany({
          where: { project_id: projectId },
          orderBy: { created_at: 'desc' },
          take: 2000,
        });
        return { project, costs };
      });

      const wb = new ExcelJS.Workbook();
      wb.creator = 'Site Safi';
      const money = (v: any) => Number(v ?? 0);

      const ws = wb.addWorksheet('Costs');
      ws.columns = [
        { header: 'Date', key: 'date', width: 12 },
        { header: 'Description', key: 'desc', width: 55 },
        { header: 'Category', key: 'cat', width: 22 },
        { header: 'Vendor', key: 'vendor', width: 30 },
        { header: 'Amount (KES)', key: 'amt', width: 16 },
        { header: 'Status', key: 'status', width: 14 },
      ];
      ws.getRow(1).font = { bold: true };
      const byCat = new Map<string, number>();
      for (const c of data.costs as any[]) {
        const amt = money(c.amount);
        const cat = c.cost_category ?? 'Other';
        ws.addRow({
          date: c.created_at,
          desc: c.description ?? '',
          cat,
          vendor: c.vendor_name ?? c.supplier_name ?? '',
          amt,
          status: c.status ?? '',
        });
        byCat.set(cat, (byCat.get(cat) ?? 0) + amt);
      }
      ws.addRow({});
      ws.addRow({ desc: 'TOTAL', amt: [...byCat.values()].reduce((a, b) => a + b, 0) }).font = { bold: true };

      const summary = wb.addWorksheet('By category');
      summary.columns = [
        { header: 'Category', key: 'cat', width: 30 },
        { header: 'Total (KES)', key: 'amt', width: 18 },
      ];
      summary.getRow(1).font = { bold: true };
      for (const [cat, amt] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) {
        summary.addRow({ cat, amt });
      }

      const filename = `cost-report-${(data.project?.code || projectId).replace(/[^a-z0-9-]/gi, '')}.xlsx`;
      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      return reply.send(await wb.xlsx.writeBuffer());
    },
  );
};


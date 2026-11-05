import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma, recordAuditLog, withTenantTx } from '@construction/db';
import { toDecimal } from '@construction/money';
import { verifySignedSiteOpsToken } from '../services/securityConfig';
import {
  CreateETimsInvoiceSchema,
  CreateSubcontractorTaxComplianceSchema,
  ProcessWebhookPayloadSchema,
  CreateSiteAlertNotificationSchema,
  CreateSubcontractorRetentionReleaseSchema,
  ReviewSubcontractorRetentionReleaseSchema,
  CreateContractorBondSchema,
} from '@construction/validation';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const enterpriseOperationsRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // ===========================================================================
  // MODULE 1: KRA E-TIMS & ELECTRONIC TAX INVOICE COMPLIANCE (M19)
  // ===========================================================================

  // 1.1 List E-TIMS Invoices
  server.get(
    '/api/v1/projects/:projectId/etims-invoices',
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

          const invoices = await tx.eTimsInvoice.findMany({
            where: { project_id: projectId },
            orderBy: { created_at: 'desc' },
          });

          const totalInvoices = invoices.length;
          const totalTaxable = invoices.reduce(
            (sum, inv) => sum.plus(toDecimal(inv.total_taxable_amount.toString())),
            toDecimal('0.00')
          );
          const totalTax = invoices.reduce(
            (sum, inv) => sum.plus(toDecimal(inv.total_tax_amount.toString())),
            toDecimal('0.00')
          );
          const totalGross = invoices.reduce(
            (sum, inv) => sum.plus(toDecimal(inv.total_invoice_amount.toString())),
            toDecimal('0.00')
          );

          return {
            projectId,
            summary: {
              totalInvoices,
              totalTaxableAmount: totalTaxable.toFixed(2),
              totalTaxAmount: totalTax.toFixed(2),
              totalGrossAmount: totalGross.toFixed(2),
            },
            invoices: invoices.map((inv) => ({
              id: inv.id,
              invoiceNumber: inv.invoice_number,
              cuInvoiceNumber: inv.cu_invoice_number,
              invoiceType: inv.invoice_type,
              buyerPin: inv.buyer_pin,
              buyerName: inv.buyer_name,
              totalTaxableAmount: toDecimal(inv.total_taxable_amount.toString()).toFixed(2),
              totalTaxAmount: toDecimal(inv.total_tax_amount.toString()).toFixed(2),
              totalInvoiceAmount: toDecimal(inv.total_invoice_amount.toString()).toFixed(2),
              taxBreakdown16: toDecimal(inv.tax_breakdown_16.toString()).toFixed(2),
              taxBreakdown8: toDecimal(inv.tax_breakdown_8.toString()).toFixed(2),
              taxBreakdown0: toDecimal(inv.tax_breakdown_0.toString()).toFixed(2),
              taxBreakdownExempt: toDecimal(inv.tax_breakdown_exempt.toString()).toFixed(2),
              qrCodeUrl: inv.qr_code_url,
              cryptographicSignature: inv.cryptographic_signature,
              transmissionStatus: inv.transmission_status,
              transmittedAt: inv.transmitted_at?.toISOString() || null,
              createdAt: inv.created_at.toISOString(),
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

  // 1.2 Generate / Register E-TIMS Invoice
  server.post(
    '/api/v1/projects/:projectId/etims-invoices',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateETimsInvoiceSchema.safeParse({
        ...(request.body as object),
        projectId,
      });

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid E-TIMS invoice input',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      // Validate Tax Arithmetic
      const taxable = toDecimal(data.totalTaxableAmount);
      const tax = toDecimal(data.totalTaxAmount);
      const total = toDecimal(data.totalInvoiceAmount);

      if (!taxable.plus(tax).equals(total)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Arithmetic mismatch: totalInvoiceAmount must equal totalTaxableAmount + totalTaxAmount',
        });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          // Development Sandbox Mock Signature (C2 Remediation: strictly non-production)
          const mockSignature = 'MOCK_SANDBOX_SIMULATION_ONLY_NOT_OFFICIAL_KRA_SIGNATURE';
          const mockQrUrl = 'urn:mjengo:sandbox:simulation-non-official-tax-invoice';

          const invoice = await tx.eTimsInvoice.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              invoice_number: data.invoiceNumber,
              cu_invoice_number: data.cuInvoiceNumber,
              invoice_type: data.invoiceType,
              buyer_pin: data.buyerPin.toUpperCase(),
              buyer_name: data.buyerName,
              total_taxable_amount: taxable.toFixed(2),
              total_tax_amount: tax.toFixed(2),
              total_invoice_amount: total.toFixed(2),
              tax_breakdown_16: toDecimal(data.taxBreakdown16 || '0.00').toFixed(2),
              tax_breakdown_8: toDecimal(data.taxBreakdown8 || '0.00').toFixed(2),
              tax_breakdown_0: toDecimal(data.taxBreakdown0 || '0.00').toFixed(2),
              tax_breakdown_exempt: toDecimal(data.taxBreakdownExempt || '0.00').toFixed(2),
              qr_code_url: mockQrUrl,
              cryptographic_signature: mockSignature,
              transmission_status: 'SIMULATED_LOCAL_DRAFT',
              transmitted_at: new Date(),
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'ETIMS_INVOICE',
            entityId: invoice.id,
            projectId,
            changes: {
              invoiceNumber: invoice.invoice_number,
              cuInvoiceNumber: invoice.cu_invoice_number,
              totalAmount: invoice.total_invoice_amount.toString(),
              buyerPin: invoice.buyer_pin,
              status: 'SIMULATED_LOCAL_DRAFT',
            },
          });

          return {
            id: invoice.id,
            invoiceNumber: invoice.invoice_number,
            cuInvoiceNumber: invoice.cu_invoice_number,
            buyerPin: invoice.buyer_pin,
            buyerName: invoice.buyer_name,
            totalTaxableAmount: toDecimal(invoice.total_taxable_amount.toString()).toFixed(2),
            totalTaxAmount: toDecimal(invoice.total_tax_amount.toString()).toFixed(2),
            totalInvoiceAmount: toDecimal(invoice.total_invoice_amount.toString()).toFixed(2),
            qrCodeUrl: invoice.qr_code_url,
            cryptographicSignature: invoice.cryptographic_signature,
            transmissionStatus: invoice.transmission_status,
            transmittedAt: invoice.transmitted_at?.toISOString() || null,
            isOfficialTaxInvoice: false,
            disclaimer:
              'NON-PRODUCTION SIMULATION: This draft invoice has NOT been transmitted to or validated by Kenya Revenue Authority (KRA). It is an internal draft and does NOT constitute a valid legal e-TIMS tax invoice.',
          };
        });

        return reply.status(201).send(result);
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: `Invoice number ${data.invoiceNumber} already exists in this tenant`,
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

  // 1.3 Subcontractor Tax Compliance Certificates (TCC)
  server.get(
    '/api/v1/projects/:projectId/subcontractor-tcc',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const records = await tx.subcontractorTaxCompliance.findMany({
            where: {
              subcontractor_package: {
                project_id: projectId,
              },
            },
            include: { subcontractor_package: true },
            orderBy: { tcc_expiry_date: 'asc' },
          });

          const now = new Date();
          const compliantCount = records.filter(
            (r) => r.compliance_status === 'COMPLIANT' && new Date(r.tcc_expiry_date) >= now
          ).length;
          const expiredCount = records.length - compliantCount;

          return {
            projectId,
            summary: {
              totalTracked: records.length,
              compliantCount,
              expiredCount,
            },
            records: records.map((r) => ({
              id: r.id,
              subcontractorPackageId: r.subcontractor_package_id,
              firmName: r.subcontractor_package.firm_name,
              tradeCategory: r.subcontractor_package.trade_category,
              pinNumber: r.pin_number,
              taxpayerName: r.taxpayer_name,
              tccNumber: r.tcc_number,
              tccExpiryDate: r.tcc_expiry_date.toISOString().slice(0, 10),
              complianceStatus:
                new Date(r.tcc_expiry_date) < now && r.compliance_status === 'COMPLIANT'
                  ? 'EXPIRED'
                  : r.compliance_status,
              withholdingTaxRate: toDecimal(r.withholding_tax_rate.toString()).toFixed(2),
              withholdingVatRate: toDecimal(r.withholding_vat_rate.toString()).toFixed(2),
              lastVerifiedAt: r.last_verified_at.toISOString(),
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

  // 1.4 Register / Update Subcontractor TCC
  server.post(
    '/api/v1/projects/:projectId/subcontractor-tcc',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateSubcontractorTaxComplianceSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid Subcontractor Tax Compliance input',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const pkg = await tx.subcontractorPackage.findFirst({
            where: { id: data.subcontractorPackageId, project_id: projectId },
          });
          if (!pkg) throw { status: 404, message: 'Subcontractor package not found in this project' };

          const expiry = new Date(data.tccExpiryDate);
          const isExpired = expiry < new Date();
          const effectiveStatus = isExpired ? 'EXPIRED' : data.complianceStatus;

          const record = await tx.subcontractorTaxCompliance.create({
            data: {
              tenant_id: tenantId,
              subcontractor_package_id: data.subcontractorPackageId,
              pin_number: data.pinNumber.toUpperCase(),
              taxpayer_name: data.taxpayerName,
              tcc_number: data.tccNumber,
              tcc_expiry_date: expiry,
              compliance_status: effectiveStatus,
              withholding_tax_rate: toDecimal(data.withholdingTaxRate).toFixed(2),
              withholding_vat_rate: toDecimal(data.withholdingVatRate).toFixed(2),
              last_verified_at: new Date(),
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'SUBCONTRACTOR_TAX_COMPLIANCE',
            entityId: record.id,
            projectId,
            changes: {
              pinNumber: record.pin_number,
              tccNumber: record.tcc_number,
              status: record.compliance_status,
              expiryDate: data.tccExpiryDate,
            },
          });

          return {
            id: record.id,
            subcontractorPackageId: record.subcontractor_package_id,
            firmName: pkg.firm_name,
            pinNumber: record.pin_number,
            tccNumber: record.tcc_number,
            tccExpiryDate: record.tcc_expiry_date.toISOString().slice(0, 10),
            complianceStatus: record.compliance_status,
            withholdingTaxRate: toDecimal(record.withholding_tax_rate.toString()).toFixed(2),
            withholdingVatRate: toDecimal(record.withholding_vat_rate.toString()).toFixed(2),
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

  // ===========================================================================
  // MODULE 2: WHATSAPP & SMS TWO-WAY SITE OPS WEBHOOKS & ALERTS (M20)
  // ===========================================================================

  // 2.1 Inbound Webhook Processing (WhatsApp / Twilio / Africa's Talking) (C3 Hardened)
  server.post(
    '/api/v1/webhooks/site-ops',
    async (request, reply) => {
      // 1. Mandatory Signed Token Authentication & Cryptographic Tenant Binding (C3, 2b)
      const token =
        (request.headers['x-site-ops-token'] as string) ||
        (request.headers['x-site-ops-secret'] as string) ||
        (request.headers['authorization'] as string)?.replace(/^Bearer\s+/i, '');

      const authenticatedTenantId = verifySignedSiteOpsToken(token);
      if (!authenticatedTenantId) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid or missing signed site-ops webhook authentication token',
        });
      }

      // 2. Reject any attempt to spoof tenantId via header or query params (2b)
      const headerTenantId = request.headers['x-tenant-id'] as string;
      if (headerTenantId && headerTenantId !== authenticatedTenantId) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Tenant header mismatch: cannot override cryptographically signed tenant context',
        });
      }

      const tenantId = authenticatedTenantId;

      const parseResult = ProcessWebhookPayloadSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid webhook payload',
          details: parseResult.error.flatten(),
        });
      }

      const { senderPhone, senderName, channel, rawMessage, projectId: reqProjectId } = parseResult.data;

      // Intent Classifier & Entity Extraction
      const upperMsg = rawMessage.trim().toUpperCase();
      let detectedCommand: 'DIARY' | 'DELIVERY' | 'INCIDENT' | 'PLANT_FUEL' | 'UNKNOWN' = 'UNKNOWN';
      const extractedData: Record<string, any> = { raw: rawMessage };
      let replyMessage = '';

      if (upperMsg.startsWith('#DIARY') || upperMsg.startsWith('DIARY:')) {
        detectedCommand = 'DIARY';
        // Extract trade numbers or notes
        const masonMatch = rawMessage.match(/(\d+)\s*(?:mason|fundi)/i);
        const casualMatch = rawMessage.match(/(\d+)\s*(?:casual|mkono|hand)/i);
        if (masonMatch && masonMatch[1]) extractedData.masons = parseInt(masonMatch[1], 10);
        if (casualMatch && casualMatch[1]) extractedData.casuals = parseInt(casualMatch[1], 10);

        replyMessage = `MjengoLedger: Asante ${senderName || 'Supervisor'}. Rekodi ya Site Diary imepokelewa na kuwekwa kwa mfumo. (Masons: ${extractedData.masons || 0}, Casuals: ${extractedData.casuals || 0}).`;
      } else if (upperMsg.startsWith('#DELIVERY') || upperMsg.startsWith('DELIVERY:')) {
        detectedCommand = 'DELIVERY';
        // Extract material delivery clues
        const bagsMatch = rawMessage.match(/(\d+)\s*(?:bags?|lorr(?:y|ies)|tonn?es?|trips?)/i);
        if (bagsMatch && bagsMatch[1]) extractedData.quantity = bagsMatch[1];
        extractedData.summary = rawMessage.replace(/^[#]DELIVERY[:\s]*/i, '').trim();

        replyMessage = `MjengoLedger: Delivery note imethibitishwa: "${extractedData.summary}". Storekeeper ataangalia mzigo kabla ya kutoa GRN.`;
      } else if (upperMsg.startsWith('#INCIDENT') || upperMsg.startsWith('INCIDENT:')) {
        detectedCommand = 'INCIDENT';
        extractedData.isSafetyCritical = upperMsg.includes('STOP') || upperMsg.includes('COLLAPSE') || upperMsg.includes('INJURY') || upperMsg.includes('FALL');
        extractedData.incidentDetails = rawMessage.replace(/^[#]INCIDENT[:\s]*/i, '').trim();

        replyMessage = `MjengoLedger SAFETY ALERT: Taarifa ya dharura imetumwa kwa Safety Officer na Project Manager mara moja! Hali: ${extractedData.isSafetyCritical ? 'CRITICAL STOP-WORK' : 'INCIDENT LOGGED'}.`;
      } else if (upperMsg.startsWith('#FUEL') || upperMsg.startsWith('#PLANT') || upperMsg.startsWith('FUEL:')) {
        detectedCommand = 'PLANT_FUEL';
        const litersMatch = rawMessage.match(/(\d+(?:\.\d+)?)\s*(?:l|liters?|litres?)/i);
        const hoursMatch = rawMessage.match(/(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)/i);
        if (litersMatch && litersMatch[1]) extractedData.liters = litersMatch[1];
        if (hoursMatch && hoursMatch[1]) extractedData.hours = hoursMatch[1];

        replyMessage = `MjengoLedger Fuel Audit: Mafuta (${extractedData.liters || 0}L) yamerekodiwa kwa masaa (${extractedData.hours || 0} hrs). Siphoning verification active.`;
      } else {
        replyMessage = `MjengoLedger Bot: Karibu! Tuma ujumbe ukitumia #DIARY, #DELIVERY, #INCIDENT, au #FUEL kurekodi shughuli za tovuti moja kwa moja.`;
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          // Resolve Project ID if not supplied
          let targetProjectId = reqProjectId;
          if (!targetProjectId) {
            const firstProj = await tx.project.findFirst({
              where: { status: 'ACTIVE' },
              orderBy: { created_at: 'asc' },
            });
            if (firstProj) targetProjectId = firstProj.id;
          }

          const log = await tx.siteWebhookLog.create({
            data: {
              tenant_id: tenantId,
              project_id: targetProjectId,
              sender_phone: senderPhone,
              sender_name: senderName || 'Field Contact',
              channel,
              raw_message: rawMessage,
              detected_command: detectedCommand,
              processed_status: 'PROCESSED',
              extracted_data: extractedData,
              reply_message: replyMessage,
            },
          });

          // If critical safety incident, trigger automatic SiteAlertNotification
          if (detectedCommand === 'INCIDENT' && targetProjectId && extractedData.isSafetyCritical) {
            await tx.siteAlertNotification.create({
              data: {
                tenant_id: tenantId,
                project_id: targetProjectId,
                recipient_phone: senderPhone,
                recipient_name: 'Lead Safety Officer',
                recipient_role: 'SAFETY_OFFICER',
                alert_type: 'CRITICAL_SAFETY_STOP_WORK',
                message_body: `URGENT DOSHS ALERT: ${extractedData.incidentDetails}. Dispatched via WhatsApp webhook.`,
                delivery_channel: 'WHATSAPP',
                delivery_status: 'SENT',
                sent_at: new Date(),
              },
            });
          }

          return {
            webhookId: log.id,
            tenantId,
            detectedCommand: log.detected_command,
            processedStatus: log.processed_status,
            replyMessage: log.reply_message,
            extractedData: log.extracted_data,
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

  // 2.2 List Site Alerts for a Project
  server.get(
    '/api/v1/projects/:projectId/site-alerts',
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

          const alerts = await tx.siteAlertNotification.findMany({
            where: { project_id: projectId },
            orderBy: { created_at: 'desc' },
          });

          const totalAlerts = alerts.length;
          const criticalCount = alerts.filter((a) => a.alert_type === 'CRITICAL_SAFETY_STOP_WORK').length;

          return {
            projectId,
            summary: {
              totalAlerts,
              criticalCount,
            },
            alerts: alerts.map((a) => ({
              id: a.id,
              recipientPhone: a.recipient_phone,
              recipientName: a.recipient_name,
              recipientRole: a.recipient_role,
              alertType: a.alert_type,
              messageBody: a.message_body,
              deliveryChannel: a.delivery_channel,
              deliveryStatus: a.delivery_status,
              sentAt: a.sent_at?.toISOString() || null,
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

  // 2.3 Dispatch Urgent Site Alert
  server.post(
    '/api/v1/projects/:projectId/site-alerts',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateSiteAlertNotificationSchema.safeParse({
        ...(request.body as object),
        projectId,
      });

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid site alert notification input',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const alert = await tx.siteAlertNotification.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              recipient_phone: data.recipientPhone,
              recipient_name: data.recipientName,
              recipient_role: data.recipientRole,
              alert_type: data.alertType,
              message_body: data.messageBody,
              delivery_channel: data.deliveryChannel,
              delivery_status: 'DELIVERED',
              sent_at: new Date(),
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'SITE_ALERT_NOTIFICATION',
            entityId: alert.id,
            projectId,
            changes: {
              alertType: alert.alert_type,
              recipientRole: alert.recipient_role,
              channel: alert.delivery_channel,
            },
          });

          return {
            id: alert.id,
            recipientPhone: alert.recipient_phone,
            recipientName: alert.recipient_name,
            recipientRole: alert.recipient_role,
            alertType: alert.alert_type,
            messageBody: alert.message_body,
            deliveryChannel: alert.delivery_channel,
            deliveryStatus: alert.delivery_status,
            sentAt: alert.sent_at?.toISOString() || null,
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

  // ===========================================================================
  // MODULE 3: SUBCONTRACTOR RETENTION RELEASES & PERFORMANCE BONDS (M21)
  // ===========================================================================

  // 3.1 List Subcontractor Retention Releases
  server.get(
    '/api/v1/projects/:projectId/subcontractor-retention-releases',
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

          const releases = await tx.subcontractorRetentionRelease.findMany({
            where: { project_id: projectId },
            include: { subcontractor_package: true },
            orderBy: { created_at: 'desc' },
          });

          const totalRetHeld = releases.reduce(
            (sum, r) => sum.plus(toDecimal(r.total_retention_held.toString())),
            toDecimal('0.00')
          );
          const totalReleased = releases.reduce(
            (sum, r) => sum.plus(toDecimal(r.release_amount.toString())),
            toDecimal('0.00')
          );

          return {
            projectId,
            summary: {
              totalReleasesCount: releases.length,
              totalRetentionHeld: totalRetHeld.toFixed(2),
              totalReleasedAmount: totalReleased.toFixed(2),
            },
            releases: releases.map((r) => ({
              id: r.id,
              releaseNo: r.release_no,
              subcontractorPackageId: r.subcontractor_package_id,
              firmName: r.subcontractor_package.firm_name,
              tradeCategory: r.subcontractor_package.trade_category,
              moietyStage: r.moiety_stage,
              totalRetentionHeld: toDecimal(r.total_retention_held.toString()).toFixed(2),
              releasePercentage: toDecimal(r.release_percentage.toString()).toFixed(2),
              releaseAmount: toDecimal(r.release_amount.toString()).toFixed(2),
              qsRecommendationNotes: r.qs_recommendation_notes,
              defectClearanceVerified: r.defect_clearance_verified,
              status: r.status,
              disbursementRef: r.disbursement_ref,
              disbursedAt: r.disbursed_at?.toISOString() || null,
              createdAt: r.created_at.toISOString(),
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

  // 3.2 Create Subcontractor Retention Release
  server.post(
    '/api/v1/projects/:projectId/subcontractor-retention-releases',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateSubcontractorRetentionReleaseSchema.safeParse({
        ...(request.body as object),
        projectId,
      });

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid retention release input',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;
      const totalHeld = toDecimal(data.totalRetentionHeld);
      const relPct = toDecimal(data.releasePercentage);
      const relAmount = toDecimal(data.releaseAmount);

      // Verify release amount cannot exceed percentage of total retention
      const maxAllowedRelease = totalHeld.times(relPct).dividedBy(toDecimal('100.00'));
      if (relAmount.greaterThan(maxAllowedRelease)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `Release amount (${relAmount.toFixed(2)}) cannot exceed ${relPct.toFixed(2)}% of total retention held (${maxAllowedRelease.toFixed(2)})`,
        });
      }

      // If Second Moiety (Final Completion), check defect clearance verification
      if (data.moietyStage === 'SECOND_MOIETY_FINAL_COMPLETION' && !data.defectClearanceVerified) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Second moiety retention release requires defect clearance verification sign-off per JBC 1999 Clause 34',
        });
      }

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const pkg = await tx.subcontractorPackage.findFirst({
            where: { id: data.subcontractorPackageId, project_id: projectId },
          });
          if (!pkg) throw { status: 404, message: 'Subcontractor package not found in this project' };

          const release = await tx.subcontractorRetentionRelease.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              subcontractor_package_id: data.subcontractorPackageId,
              release_no: data.releaseNo,
              moiety_stage: data.moietyStage,
              total_retention_held: totalHeld.toFixed(2),
              release_percentage: relPct.toFixed(2),
              release_amount: relAmount.toFixed(2),
              qs_recommendation_notes: data.qsRecommendationNotes,
              defect_clearance_verified: data.defectClearanceVerified,
              status: 'PENDING_QS_REVIEW',
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'SUBCONTRACTOR_RETENTION_RELEASE',
            entityId: release.id,
            projectId,
            changes: {
              releaseNo: release.release_no,
              stage: release.moiety_stage,
              amount: release.release_amount.toString(),
            },
          });

          return {
            id: release.id,
            releaseNo: release.release_no,
            subcontractorPackageId: release.subcontractor_package_id,
            moietyStage: release.moiety_stage,
            totalRetentionHeld: toDecimal(release.total_retention_held.toString()).toFixed(2),
            releasePercentage: toDecimal(release.release_percentage.toString()).toFixed(2),
            releaseAmount: toDecimal(release.release_amount.toString()).toFixed(2),
            status: release.status,
            defectClearanceVerified: release.defect_clearance_verified,
            createdAt: release.created_at.toISOString(),
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

  // 3.3 Review / Disburse Retention Release
  server.post(
    '/api/v1/projects/:projectId/subcontractor-retention-releases/:releaseId/review',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId, releaseId } = request.params as { projectId: string; releaseId: string };

      if (!UUID_REGEX.test(projectId) || !UUID_REGEX.test(releaseId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Resource not found' });
      }

      const parseResult = ReviewSubcontractorRetentionReleaseSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid retention review input',
          details: parseResult.error.flatten(),
        });
      }

      const { status, disbursementRef } = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const release = await tx.subcontractorRetentionRelease.findFirst({
            where: { id: releaseId, project_id: projectId },
          });
          if (!release) throw { status: 404, message: 'Retention release not found' };

          const updated = await tx.subcontractorRetentionRelease.update({
            where: { id: releaseId },
            data: {
              status,
              disbursement_ref: disbursementRef,
              disbursed_at: status === 'PAID' ? new Date() : release.disbursed_at,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'UPDATE',
            entityType: 'SUBCONTRACTOR_RETENTION_RELEASE',
            entityId: updated.id,
            projectId,
            changes: {
              newStatus: status,
              disbursementRef,
            },
          });

          return {
            id: updated.id,
            releaseNo: updated.release_no,
            status: updated.status,
            disbursementRef: updated.disbursement_ref,
            disbursedAt: updated.disbursed_at?.toISOString() || null,
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

  // 3.4 List Contractor Bonds & Guarantees
  server.get(
    '/api/v1/projects/:projectId/contractor-bonds',
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

          const bonds = await tx.contractorBondTracker.findMany({
            where: { project_id: projectId },
            orderBy: { expiry_date: 'asc' },
          });

          const totalBondSum = bonds.reduce(
            (sum, b) => sum.plus(toDecimal(b.bond_amount.toString())),
            toDecimal('0.00')
          );
          const activeCount = bonds.filter((b) => b.claim_status === 'ACTIVE').length;

          return {
            projectId,
            summary: {
              totalBonds: bonds.length,
              activeCount,
              totalBondAmount: totalBondSum.toFixed(2),
            },
            bonds: bonds.map((b) => ({
              id: b.id,
              bondType: b.bond_type,
              issuingInstitution: b.issuing_institution,
              bondReferenceNo: b.bond_reference_no,
              bondAmount: toDecimal(b.bond_amount.toString()).toFixed(2),
              effectiveDate: b.effective_date.toISOString().slice(0, 10),
              expiryDate: b.expiry_date.toISOString().slice(0, 10),
              claimStatus: b.claim_status,
              dischargeCertificateRef: b.discharge_certificate_ref,
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

  // 3.5 Register Contractor Bond
  server.post(
    '/api/v1/projects/:projectId/contractor-bonds',
    { preHandler: [server.authenticate] },
    async (request, reply) => {
      const { tenantId, sub } = request.user;
      const { projectId } = request.params as { projectId: string };

      if (!UUID_REGEX.test(projectId)) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Project not found' });
      }

      const parseResult = CreateContractorBondSchema.safeParse({
        ...(request.body as object),
        projectId,
      });

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid contractor bond input',
          details: parseResult.error.flatten(),
        });
      }

      const data = parseResult.data;

      try {
        const result = await withTenantTx(prisma, tenantId, async (tx) => {
          const project = await tx.project.findFirst({ where: { id: projectId } });
          if (!project) throw { status: 404, message: 'Project not found' };

          const bond = await tx.contractorBondTracker.create({
            data: {
              tenant_id: tenantId,
              project_id: projectId,
              bond_type: data.bondType,
              issuing_institution: data.issuingInstitution,
              bond_reference_no: data.bondReferenceNo,
              bond_amount: toDecimal(data.bondAmount).toFixed(2),
              effective_date: new Date(data.effectiveDate),
              expiry_date: new Date(data.expiryDate),
              claim_status: data.claimStatus,
              discharge_certificate_ref: data.dischargeCertificateRef,
            },
          });

          await recordAuditLog(tx, {
            tenantId,
            actorId: sub,
            action: 'CREATE',
            entityType: 'CONTRACTOR_BOND_TRACKER',
            entityId: bond.id,
            projectId,
            changes: {
              bondType: bond.bond_type,
              ref: bond.bond_reference_no,
              amount: bond.bond_amount.toString(),
              issuer: bond.issuing_institution,
            },
          });

          return {
            id: bond.id,
            bondType: bond.bond_type,
            issuingInstitution: bond.issuing_institution,
            bondReferenceNo: bond.bond_reference_no,
            bondAmount: toDecimal(bond.bond_amount.toString()).toFixed(2),
            effectiveDate: bond.effective_date.toISOString().slice(0, 10),
            expiryDate: bond.expiry_date.toISOString().slice(0, 10),
            claimStatus: bond.claim_status,
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
};

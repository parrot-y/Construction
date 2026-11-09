# Route Authorization Matrix (audit P1.1 evidence)

Generated 2026-11-09 — regenerated after Phase-3 portal routes.
Guard sources: inline requirePermission/requireAnyPermission preHandler, ROUTE_PERMISSIONS map (enforced centrally via plugins/routeAuthorization.ts onRoute hook), IN_HANDLER_GUARDED, SELF_SERVICE_ALLOWLIST, UNAUTHENTICATED_ALLOWLIST.

Counts: {"map":112,"inline":116,"self-service":9,"PUBLIC (allowlisted)":22,"in-handler":16}

| Method | Path | File | Guard |
|---|---|---|---|
| GET | `/api/v1/announcements` | announcements.ts | map: perm:REPORT_VIEW |
| POST | `/api/v1/announcements` | announcements.ts | inline: requirePermission/… |
| PATCH | `/api/v1/announcements/:id` | announcements.ts | inline: requirePermission/… |
| POST | `/api/v1/announcements/:id/read` | announcements.ts | self-service |
| GET | `/api/v1/announcements/:id/readers` | announcements.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/attendance` | attendance.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/attendance` | attendance.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/attendance/check-in` | attendance.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/attendance/check-out` | attendance.ts | inline: requirePermission/… |
| POST | `/api/v1/auth/login` | auth.ts | PUBLIC (allowlisted) |
| POST | `/api/v1/auth/logout` | auth.ts | PUBLIC (allowlisted) |
| GET | `/api/v1/auth/me` | auth.ts | self-service |
| PATCH | `/api/v1/auth/me` | auth.ts | self-service |
| POST | `/api/v1/auth/refresh` | auth.ts | PUBLIC (allowlisted) |
| GET | `/api/v1/auth/sessions` | auth.ts | in-handler |
| DELETE | `/api/v1/auth/sessions/:id` | auth.ts | in-handler |
| GET | `/api/v1/projects/:projectId/boq` | boq.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/boq/confirm` | boq.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/boq/export` | boq.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/boq/items` | boq.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/boq/preview` | boq.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/closeout` | certificates.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/closeout/transition` | certificates.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/payment-certificates` | certificates.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/payment-certificates` | certificates.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/payment-certificates/:certId/action` | certificates.ts | inline: requirePermission/… |
| GET | `/api/v1/checklists/templates` | checklists.ts | inline: requirePermission/… |
| POST | `/api/v1/checklists/templates` | checklists.ts | inline: requirePermission/… |
| PATCH | `/api/v1/checklists/templates/:id` | checklists.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/checklist-assignments` | checklists.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/checklist-assignments` | checklists.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/checklist-assignments/:id` | checklists.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/checklist-assignments/:id/review` | checklists.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/checklist-assignments/:id/start` | checklists.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/checklist-assignments/:id/submit` | checklists.ts | inline: requirePermission/… |
| POST | `/api/v1/client/project-requests` | clientPortal.ts | self-service |
| GET | `/api/v1/client/project-requests` | clientPortal.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/client-portal` | clientPortal.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/cash-flow` | commercialOperations.ts | map: perm:COST_VIEW |
| POST | `/api/v1/projects/:projectId/cash-flow` | commercialOperations.ts | map: perm:COST_CREATE |
| GET | `/api/v1/projects/:projectId/material-requisitions` | commercialOperations.ts | map: perm:COST_VIEW |
| POST | `/api/v1/projects/:projectId/material-requisitions` | commercialOperations.ts | map: perm:COST_CREATE |
| PATCH | `/api/v1/projects/:projectId/material-requisitions/:requisitionId` | commercialOperations.ts | map: perm:COST_APPROVE |
| GET | `/api/v1/projects/:projectId/material-wastage` | commercialOperations.ts | map: perm:COST_VIEW |
| POST | `/api/v1/projects/:projectId/material-wastage` | commercialOperations.ts | map: perm:COST_CREATE |
| GET | `/api/v1/projects/:projectId/subcontractor-valuations` | commercialOperations.ts | map: perm:COST_VIEW |
| POST | `/api/v1/projects/:projectId/subcontractor-valuations` | commercialOperations.ts | map: perm:COST_CREATE |
| PATCH | `/api/v1/projects/:projectId/subcontractor-valuations/:valuationId` | commercialOperations.ts | map: perm:COST_APPROVE |
| GET | `/api/v1/projects/:projectId/commitments` | commitments.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/commitments` | commitments.ts | inline: requirePermission/… |
| PATCH | `/api/v1/projects/:projectId/commitments/:commitmentId` | commitments.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/commitments/:commitmentId/applications` | commitments.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/commitments/:commitmentId/applications/:applicationId/action` | commitments.ts | in-handler |
| GET | `/api/v1/company` | company.ts | self-service |
| PATCH | `/api/v1/company` | company.ts | inline: requirePermission/… |
| GET | `/api/v1/company/members` | company.ts | map: perm:COMPANY_INVITE |
| DELETE | `/api/v1/company/members/:membershipId` | company.ts | inline: requirePermission/… |
| PATCH | `/api/v1/company/members/:membershipId/co-approval-limit` | company.ts | inline: requirePermission/… |
| PATCH | `/api/v1/company/members/:membershipId/role` | company.ts | inline: requirePermission/… |
| GET | `/api/v1/company/settings` | company.ts | inline: requirePermission/… |
| GET | `/api/v1/company/documents` | companyDocuments.ts | inline: requirePermission/… |
| POST | `/api/v1/company/documents` | companyDocuments.ts | inline: requirePermission/… |
| PATCH | `/api/v1/company/documents/:id` | companyDocuments.ts | inline: requirePermission/… |
| GET | `/api/v1/company/documents/expiring` | companyDocuments.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/delay-events` | contractClaims.ts | map: perm:PROGRESS_RECORD |
| GET | `/api/v1/projects/:projectId/delay-events` | contractClaims.ts | map: perm:COST_VIEW |
| PUT | `/api/v1/projects/:projectId/delay-events/:id/review` | contractClaims.ts | map: perm:COST_APPROVE |
| POST | `/api/v1/projects/:projectId/tax-certificates` | contractClaims.ts | map: perm:COST_CREATE |
| GET | `/api/v1/projects/:projectId/tax-certificates` | contractClaims.ts | map: perm:COST_VIEW |
| PUT | `/api/v1/projects/:projectId/tax-certificates/:id/remit` | contractClaims.ts | map: perm:COST_APPROVE |
| GET | `/api/v1/projects/:projectId/correspondence` | correspondence.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/correspondence` | correspondence.ts | inline: requirePermission/… |
| PATCH | `/api/v1/projects/:projectId/correspondence/:itemId` | correspondence.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/budget/summary` | costs.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/costs` | costs.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/costs` | costs.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/costs/:costId` | costs.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/costs/:costId/approve` | costs.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/costs/:costId/receipts` | costs.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/costs/:costId/void` | costs.ts | inline: requirePermission/… |
| GET | `/api/v1/crews` | crews.ts | inline: requirePermission/… |
| POST | `/api/v1/crews` | crews.ts | inline: requirePermission/… |
| PATCH | `/api/v1/crews/:id` | crews.ts | inline: requirePermission/… |
| DELETE | `/api/v1/crews/:id` | crews.ts | inline: requirePermission/… |
| POST | `/api/v1/crews/:id/members` | crews.ts | inline: requirePermission/… |
| DELETE | `/api/v1/crews/:id/members/:memberId` | crews.ts | inline: requirePermission/… |
| GET | `/api/v1/dashboard` | dashboard.ts | self-service |
| GET | `/api/v1/projects/:projectId/contractor-bonds` | enterpriseOperations.ts | map: perm:COST_VIEW |
| POST | `/api/v1/projects/:projectId/contractor-bonds` | enterpriseOperations.ts | map: perm:COST_CREATE |
| GET | `/api/v1/projects/:projectId/etims-invoices` | enterpriseOperations.ts | map: perm:INVOICE_VIEW |
| POST | `/api/v1/projects/:projectId/etims-invoices` | enterpriseOperations.ts | map: perm:INVOICE_CREATE |
| GET | `/api/v1/projects/:projectId/site-alerts` | enterpriseOperations.ts | map: perm:REPORT_VIEW |
| POST | `/api/v1/projects/:projectId/site-alerts` | enterpriseOperations.ts | map: perm:ANNOUNCEMENT_MANAGE |
| GET | `/api/v1/projects/:projectId/site-webhook-logs` | enterpriseOperations.ts | map: perm:REPORT_VIEW |
| GET | `/api/v1/projects/:projectId/subcontractor-retention-releases` | enterpriseOperations.ts | map: perm:COST_VIEW |
| POST | `/api/v1/projects/:projectId/subcontractor-retention-releases` | enterpriseOperations.ts | map: perm:COST_CREATE |
| POST | `/api/v1/projects/:projectId/subcontractor-retention-releases/:releaseId/review` | enterpriseOperations.ts | map: perm:COST_APPROVE |
| GET | `/api/v1/projects/:projectId/subcontractor-tcc` | enterpriseOperations.ts | map: perm:COST_VIEW |
| POST | `/api/v1/projects/:projectId/subcontractor-tcc` | enterpriseOperations.ts | map: perm:COST_CREATE |
| POST | `/api/v1/webhooks/site-ops` | enterpriseOperations.ts | PUBLIC (allowlisted) |
| GET | `/api/v1/portals/client/:token/change-orders` | externalPortals.ts | PUBLIC (allowlisted) |
| POST | `/api/v1/portals/client/:token/change-orders/:coId/respond` | externalPortals.ts | PUBLIC (allowlisted) |
| GET | `/api/v1/portals/compliance/:token` | externalPortals.ts | PUBLIC (allowlisted) |
| GET | `/api/v1/portals/consultant/:token` | externalPortals.ts | PUBLIC (allowlisted) |
| POST | `/api/v1/portals/consultant/:token/rfis/:rfiId/reply` | externalPortals.ts | PUBLIC (allowlisted) |
| GET | `/api/v1/portals/subcontractor/:token` | externalPortals.ts | PUBLIC (allowlisted) |
| POST | `/api/v1/portals/subcontractor/:token/snags/:snagId/rectify` | externalPortals.ts | PUBLIC (allowlisted) |
| POST | `/api/v1/portals/subcontractor/:token/valuations` | externalPortals.ts | PUBLIC (allowlisted) |
| GET | `/api/v1/portals/supplier/:token` | externalPortals.ts | PUBLIC (allowlisted) |
| POST | `/api/v1/portals/supplier/:token/deliveries/:deliveryId/confirm` | externalPortals.ts | PUBLIC (allowlisted) |
| GET | `/api/v1/portals/validate/:token` | externalPortals.ts | PUBLIC (allowlisted) |
| POST | `/api/v1/projects/:projectId/portals/links` | externalPortals.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/portals/links` | externalPortals.ts | inline: requirePermission/… |
| GET | `/uploads/*` | files.ts | in-handler |
| GET | `/api/v1/inbox` | inbox.ts | inline: requirePermission/… |
| POST | `/api/v1/inbox` | inbox.ts | inline: requirePermission/… |
| POST | `/api/v1/inbox/:id/read` | inbox.ts | inline: requirePermission/… |
| GET | `/api/v1/inbox/unread-count` | inbox.ts | inline: requirePermission/… |
| GET | `/api/v1/integrations/status` | integrations.ts | in-handler |
| POST | `/api/v1/integrations/test` | integrations.ts | in-handler |
| POST | `/api/v1/invitations` | invitations.ts | inline: requirePermission/… |
| GET | `/api/v1/invitations` | invitations.ts | inline: requirePermission/… |
| POST | `/api/v1/invitations/accept` | invitations.ts | PUBLIC (allowlisted) |
| GET | `/api/v1/invoices` | invoices.ts | inline: requirePermission/… |
| POST | `/api/v1/invoices` | invoices.ts | inline: requirePermission/… |
| GET | `/api/v1/invoices/:id` | invoices.ts | inline: requirePermission/… |
| PATCH | `/api/v1/invoices/:id` | invoices.ts | inline: requirePermission/… |
| POST | `/api/v1/invoices/:id/payments` | invoices.ts | inline: requirePermission/… |
| GET | `/api/v1/invoices/:id/pdf` | invoices.ts | inline: requirePermission/… |
| POST | `/api/v1/invoices/:id/send` | invoices.ts | inline: requirePermission/… |
| POST | `/api/v1/invoices/:id/void` | invoices.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/certificates` | lifecycle.ts | map: perm:REPORT_VIEW |
| POST | `/api/v1/projects/:projectId/certificates` | lifecycle.ts | map: perm:CERTIFICATE_MANAGE |
| GET | `/api/v1/projects/:projectId/cube-tests` | lifecycle.ts | map: perm:INSPECTION_VIEW |
| POST | `/api/v1/projects/:projectId/cube-tests` | lifecycle.ts | map: perm:INSPECTION_SUBMIT |
| POST | `/api/v1/projects/:projectId/cube-tests/:id/breaks` | lifecycle.ts | map: perm:INSPECTION_SUBMIT |
| GET | `/api/v1/projects/:projectId/inspections` | lifecycle.ts | map: perm:INSPECTION_VIEW |
| POST | `/api/v1/projects/:projectId/inspections` | lifecycle.ts | map: perm:INSPECTION_REQUEST |
| POST | `/api/v1/projects/:projectId/inspections/:id/consultant-review` | lifecycle.ts | inline: requirePermission/… |
| PUT | `/api/v1/projects/:projectId/inspections/:id/items/:itemId` | lifecycle.ts | map: perm:INSPECTION_SUBMIT |
| GET | `/api/v1/projects/:projectId/rfis` | lifecycle.ts | map: perm:PROJECT_VIEW |
| POST | `/api/v1/projects/:projectId/rfis` | lifecycle.ts | map: perm:PROGRESS_RECORD |
| POST | `/api/v1/projects/:projectId/rfis/:rfiId/close` | lifecycle.ts | map: perm:PROGRESS_RECORD |
| POST | `/api/v1/projects/:projectId/rfis/:rfiId/responses` | lifecycle.ts | map: perm:PROGRESS_RECORD |
| GET | `/api/v1/projects/:projectId/snags` | lifecycle.ts | map: perm:SITE_DIARY_VIEW |
| POST | `/api/v1/projects/:projectId/snags` | lifecycle.ts | map: perm:SITE_DIARY_CREATE |
| GET | `/api/v1/projects/:projectId/snags/:snagId` | lifecycle.ts | map: perm:SITE_DIARY_VIEW |
| POST | `/api/v1/projects/:projectId/snags/:snagId/comments` | lifecycle.ts | map: perm:SITE_DIARY_CREATE |
| POST | `/api/v1/projects/:projectId/snags/:snagId/distributions` | lifecycle.ts | map: perm:PROGRESS_RECORD |
| PUT | `/api/v1/projects/:projectId/snags/:snagId/status` | lifecycle.ts | map: perm:PROGRESS_RECORD |
| GET | `/api/v1/projects/:projectId/snags/export` | lifecycle.ts | map: perm:REPORT_VIEW |
| GET | `/api/v1/projects/:projectId/corrective-actions` | observations.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/corrective-actions` | observations.ts | inline: requirePermission/… |
| PATCH | `/api/v1/projects/:projectId/corrective-actions/:actionId` | observations.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/observations` | observations.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/observations` | observations.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/observations/:obsId` | observations.ts | inline: requirePermission/… |
| PATCH | `/api/v1/projects/:projectId/observations/:obsId/status` | observations.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/documents` | operations.ts | map: perm:REPORT_VIEW |
| POST | `/api/v1/projects/:projectId/documents` | operations.ts | map: perm:DOCUMENT_MANAGE |
| GET | `/api/v1/projects/:projectId/documents/:documentId/annotations` | operations.ts | map: perm:REPORT_VIEW |
| POST | `/api/v1/projects/:projectId/documents/:documentId/annotations` | operations.ts | map: perm:DOCUMENT_MANAGE |
| PATCH | `/api/v1/projects/:projectId/documents/:documentId/annotations/:annotationId` | operations.ts | map: perm:DOCUMENT_MANAGE |
| GET | `/api/v1/projects/:projectId/inventory` | operations.ts | map: perm:COST_VIEW |
| POST | `/api/v1/projects/:projectId/inventory/items` | operations.ts | map: perm:COST_CREATE |
| POST | `/api/v1/projects/:projectId/inventory/movements` | operations.ts | map: perm:COST_CREATE |
| GET | `/api/v1/projects/:projectId/safety-incidents` | operations.ts | map: perm:SITE_DIARY_VIEW |
| POST | `/api/v1/projects/:projectId/safety-incidents` | operations.ts | map: perm:SITE_DIARY_CREATE |
| GET | `/api/v1/projects/:projectId/subcontractors` | operations.ts | map: perm:PROJECT_VIEW |
| POST | `/api/v1/projects/:projectId/subcontractors` | operations.ts | map: perm:COST_CREATE |
| PATCH | `/api/v1/projects/:projectId/subcontractors/:packageId` | operations.ts | map: perm:COST_APPROVE |
| GET | `/api/v1/projects/:projectId/tasks` | operations.ts | map: perm:SITE_DIARY_VIEW |
| POST | `/api/v1/projects/:projectId/tasks` | operations.ts | map: perm:PROGRESS_RECORD |
| PUT | `/api/v1/projects/:projectId/tasks/:taskId` | operations.ts | map: perm:PROGRESS_RECORD |
| POST | `/api/v1/billing/mpesa-b2c-callback` | platformServices.ts | PUBLIC (allowlisted) |
| POST | `/api/v1/billing/mpesa-callback` | platformServices.ts | PUBLIC (allowlisted) |
| POST | `/api/v1/billing/mpesa-express` | platformServices.ts | map: perm:COMPANY_MANAGE |
| GET | `/api/v1/billing/subscription-status` | platformServices.ts | self-service |
| GET | `/api/v1/billing/transactions` | platformServices.ts | map: perm:COMPANY_MANAGE |
| POST | `/api/v1/projects/:projectId/asphalt-batches` | platformServices.ts | in-handler |
| GET | `/api/v1/projects/:projectId/asphalt-batches` | platformServices.ts | map: perm:PROGRESS_VIEW |
| PATCH | `/api/v1/projects/:projectId/asphalt-batches/:batchId/core-test` | platformServices.ts | in-handler |
| POST | `/api/v1/projects/:projectId/b2c-disburse` | platformServices.ts | map: perm:COST_APPROVE |
| GET | `/api/v1/projects/:projectId/b2c-disbursements` | platformServices.ts | map: perm:COST_VIEW |
| POST | `/api/v1/projects/:projectId/b2c-disbursements/:id/approve` | platformServices.ts | map: perm:COST_APPROVE |
| POST | `/api/v1/projects/:projectId/b2c-disbursements/:id/reject` | platformServices.ts | map: perm:COST_APPROVE |
| POST | `/api/v1/projects/:projectId/bar-bending-schedules` | platformServices.ts | map: perm:BOQ_EDIT |
| GET | `/api/v1/projects/:projectId/bar-bending-schedules` | platformServices.ts | map: perm:BOQ_VIEW |
| GET | `/api/v1/projects/:projectId/bar-bending-schedules/:scheduleId` | platformServices.ts | map: perm:BOQ_VIEW |
| PATCH | `/api/v1/projects/:projectId/bar-bending-schedules/:scheduleId/status` | platformServices.ts | map: perm:BOQ_EDIT |
| POST | `/api/v1/projects/:projectId/canbus-devices` | platformServices.ts | in-handler |
| GET | `/api/v1/projects/:projectId/clock-events` | platformServices.ts | map: perm:SITE_DIARY_VIEW |
| POST | `/api/v1/projects/:projectId/clock-in` | platformServices.ts | map: perm:SITE_DIARY_CREATE |
| GET | `/api/v1/projects/:projectId/geofences` | platformServices.ts | map: perm:SITE_DIARY_VIEW |
| POST | `/api/v1/projects/:projectId/geofences` | platformServices.ts | map: perm:SITE_DIARY_CREATE |
| POST | `/api/v1/projects/:projectId/independent-inspections` | platformServices.ts | map: perm:INSPECTION_REQUEST |
| GET | `/api/v1/projects/:projectId/independent-inspections` | platformServices.ts | map: perm:INSPECTION_VIEW |
| GET | `/api/v1/projects/:projectId/independent-inspections/:inspectionId` | platformServices.ts | map: perm:INSPECTION_VIEW |
| PATCH | `/api/v1/projects/:projectId/independent-inspections/:inspectionId/client-review` | platformServices.ts | map: perm:INSPECTION_REVIEW |
| POST | `/api/v1/projects/:projectId/independent-inspections/:inspectionId/notify-client` | platformServices.ts | map: perm:INSPECTION_REVIEW |
| PATCH | `/api/v1/projects/:projectId/independent-inspections/:inspectionId/submit` | platformServices.ts | in-handler |
| GET | `/api/v1/projects/:projectId/maintenance-alerts` | platformServices.ts | map: perm:COST_VIEW |
| PATCH | `/api/v1/projects/:projectId/maintenance-alerts/:alertId/acknowledge` | platformServices.ts | in-handler |
| POST | `/api/v1/projects/:projectId/rmc-deliveries` | platformServices.ts | map: perm:PROGRESS_RECORD |
| GET | `/api/v1/projects/:projectId/rmc-deliveries` | platformServices.ts | map: perm:PROGRESS_VIEW |
| PATCH | `/api/v1/projects/:projectId/rmc-deliveries/:deliveryId/discharge` | platformServices.ts | map: perm:PROGRESS_RECORD |
| POST | `/api/v1/projects/:projectId/rmc-deliveries/:deliveryId/slump-tests` | platformServices.ts | map: perm:PROGRESS_RECORD |
| POST | `/api/v1/projects/:projectId/soil-tests` | platformServices.ts | in-handler |
| GET | `/api/v1/projects/:projectId/soil-tests` | platformServices.ts | map: perm:PROGRESS_VIEW |
| POST | `/api/v1/projects/:projectId/structural-steel-takeoffs` | platformServices.ts | map: perm:BOQ_EDIT |
| GET | `/api/v1/projects/:projectId/structural-steel-takeoffs` | platformServices.ts | map: perm:BOQ_VIEW |
| GET | `/api/v1/projects/:projectId/structural-steel-takeoffs/:takeoffId` | platformServices.ts | map: perm:BOQ_VIEW |
| PATCH | `/api/v1/projects/:projectId/structural-steel-takeoffs/:takeoffId/status` | platformServices.ts | map: perm:BOQ_EDIT |
| GET | `/api/v1/projects/:projectId/telematics-devices` | platformServices.ts | map: perm:COST_VIEW |
| POST | `/api/v1/projects/:projectId/telematics-devices` | platformServices.ts | in-handler |
| GET | `/api/v1/projects/:projectId/telematics-pings` | platformServices.ts | map: perm:COST_VIEW |
| POST | `/api/v1/projects/:projectId/tenders` | platformServices.ts | in-handler |
| GET | `/api/v1/projects/:projectId/tenders` | platformServices.ts | map: perm:TENDER_VIEW |
| POST | `/api/v1/projects/:projectId/tenders/:tenderId/bids` | platformServices.ts | map: perm:TENDER_BID |
| GET | `/api/v1/projects/:projectId/tenders/:tenderId/bids` | platformServices.ts | map: perm:TENDER_VIEW |
| PATCH | `/api/v1/projects/:projectId/tenders/:tenderId/bids/:bidId/award` | platformServices.ts | in-handler |
| POST | `/api/v1/projects/:projectId/topographic-surveys` | platformServices.ts | in-handler |
| GET | `/api/v1/projects/:projectId/topographic-surveys` | platformServices.ts | map: perm:PROGRESS_VIEW |
| GET | `/api/v1/projects/:projectId/topographic-surveys/:surveyId` | platformServices.ts | map: perm:PROGRESS_VIEW |
| POST | `/api/v1/telematics/canbus-ping` | platformServices.ts | PUBLIC (allowlisted) |
| POST | `/api/v1/telematics/ping` | platformServices.ts | PUBLIC (allowlisted) |
| GET | `/api/v1/projects` | projects.ts | inline: requirePermission/… |
| POST | `/api/v1/projects` | projects.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:id` | projects.ts | inline: requirePermission/… |
| PATCH | `/api/v1/projects/:id` | projects.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:id/members` | projects.ts | inline: requirePermission/… |
| DELETE | `/api/v1/projects/:id/members/:userId` | projects.ts | inline: requirePermission/… |
| GET | `/api/public/quotes/:token` | quotes.ts | PUBLIC (allowlisted) |
| POST | `/api/public/quotes/:token/respond` | quotes.ts | PUBLIC (allowlisted) |
| GET | `/api/v1/client/quotes` | quotes.ts | self-service |
| POST | `/api/v1/client/quotes/:id/respond` | quotes.ts | self-service |
| GET | `/api/v1/quotes` | quotes.ts | inline: requirePermission/… |
| POST | `/api/v1/quotes` | quotes.ts | inline: requirePermission/… |
| GET | `/api/v1/quotes/:id` | quotes.ts | inline: requirePermission/… |
| PATCH | `/api/v1/quotes/:id` | quotes.ts | inline: requirePermission/… |
| POST | `/api/v1/quotes/:id/convert` | quotes.ts | inline: requirePermission/… |
| POST | `/api/v1/quotes/:id/send` | quotes.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/reports/financials.xlsx` | reports.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/reports/independent-inspections/:inspectionId` | reports.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/reports/ipc` | reports.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/reports/site-diary/:diaryId` | reports.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/reports/summary` | reports.ts | inline: requirePermission/… |
| GET | `/api/v1/reports/scheduled` | scheduledReports.ts | inline: requirePermission/… |
| POST | `/api/v1/reports/scheduled` | scheduledReports.ts | inline: requirePermission/… |
| PATCH | `/api/v1/reports/scheduled/:id` | scheduledReports.ts | inline: requirePermission/… |
| POST | `/api/v1/reports/scheduled/:id/run` | scheduledReports.ts | inline: requirePermission/… |
| GET | `/api/v1/reports/scheduled/:id/runs` | scheduledReports.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/progress` | site.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/progress` | site.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/site-diaries` | site.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/site-diaries` | site.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/site-diaries/:diaryId` | site.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/site-diaries/:diaryId/photos` | site.ts | inline: requirePermission/… |
| PATCH | `/api/v1/projects/:projectId/site-diaries/:diaryId/photos/:photoId/visibility` | site.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/uploads` | site.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/equipment` | siteOperations.ts | map: perm:SITE_DIARY_VIEW |
| POST | `/api/v1/projects/:projectId/equipment` | siteOperations.ts | map: perm:SITE_DIARY_CREATE |
| POST | `/api/v1/projects/:projectId/equipment-logs` | siteOperations.ts | map: perm:SITE_DIARY_CREATE |
| GET | `/api/v1/projects/:projectId/laborers` | siteOperations.ts | map: perm:SITE_DIARY_VIEW |
| POST | `/api/v1/projects/:projectId/laborers` | siteOperations.ts | map: perm:SITE_DIARY_CREATE |
| GET | `/api/v1/projects/:projectId/muster-rolls` | siteOperations.ts | map: perm:SITE_DIARY_VIEW |
| POST | `/api/v1/projects/:projectId/muster-rolls` | siteOperations.ts | map: perm:SITE_DIARY_CREATE |
| PATCH | `/api/v1/projects/:projectId/muster-rolls/:musterRollId` | siteOperations.ts | map: perm:PROGRESS_RECORD |
| GET | `/api/v1/projects/:projectId/safety-audits` | siteOperations.ts | map: perm:SITE_DIARY_VIEW |
| POST | `/api/v1/projects/:projectId/safety-audits` | siteOperations.ts | map: perm:SITE_DIARY_CREATE |
| GET | `/api/v1/projects/:projectId/variations` | variations.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/variations` | variations.ts | inline: requirePermission/… |
| GET | `/api/v1/projects/:projectId/variations/:variationId` | variations.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/variations/:variationId/review` | variations.ts | inline: requirePermission/… |
| POST | `/api/v1/projects/:projectId/variations/:variationId/submit` | variations.ts | inline: requirePermission/… |

Total routes: 275. Unguarded: 0.


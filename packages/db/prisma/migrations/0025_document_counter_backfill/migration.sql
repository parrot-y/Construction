-- Backfill document_counters so seeded/legacy invoice_no and
-- certificate_no values never collide with API-allocated numbers.
-- nextDocumentNumber() hands out last_value+1 per (tenant_id, scope);
-- environments seeded before counters existed (or seeded with explicit
-- numbers) would otherwise P2002 on the next create.
-- Rollback: DELETE FROM document_counters WHERE scope LIKE 'CERT:%' OR scope = 'INVOICE';

-- INVOICE scope is per tenant.
INSERT INTO document_counters (tenant_id, scope, last_value, updated_at)
SELECT tenant_id, 'INVOICE', MAX(invoice_no), now()
FROM invoices
GROUP BY tenant_id
ON CONFLICT (tenant_id, scope)
DO UPDATE SET last_value = GREATEST(document_counters.last_value, EXCLUDED.last_value),
              updated_at = now();

-- CERT scope is per project: 'CERT:<project_id>'.
INSERT INTO document_counters (tenant_id, scope, last_value, updated_at)
SELECT tenant_id, 'CERT:' || project_id::text, MAX(certificate_no), now()
FROM payment_certificates
GROUP BY tenant_id, project_id
ON CONFLICT (tenant_id, scope)
DO UPDATE SET last_value = GREATEST(document_counters.last_value, EXCLUDED.last_value),
              updated_at = now();

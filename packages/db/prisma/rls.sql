-- ==============================================================================
-- DOCUMENTED EXCEPTION — users & tenants are intentionally NOT under RLS:
--   * `users` is a global identity table (no tenant_id): a user may hold
--     Memberships in several tenants, and the login flow must resolve the user
--     BEFORE any tenant context (app.current_tenant_id) exists. Fail-closed
--     RLS here would make authentication impossible.
--   * `tenants` is the root tenancy row resolved during login/tenant-slug
--     lookup, again before tenant context is established.
--   All tenant-owned data — including `memberships`, which carries tenant_id
--   and IS covered by the loop below — is isolated. Access to users/tenants
--   is further restricted at the application layer (never exposed cross-tenant
--   via API; password hashes never serialized).
-- ==============================================================================
-- POSTGRESQL ROW-LEVEL SECURITY & LEDGER IMMUTABILITY ENFORCEMENT SCRIPT
-- (ADR-001, C4, H4, R-014, R-024)
-- Enables and FORCE-enforces RLS on all tables carrying a tenant_id column.
-- Ensures zero cross-tenant leakage even if application queries omit where clauses.
-- Enforces database-level immutability on audit_logs and financial cost_entries.
-- ==============================================================================

DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND column_name = 'tenant_id'
    LOOP
        -- 1. Enable RLS
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl.table_name);
        
        -- 2. Force RLS (applies to table owner as well, closing bypass loopholes)
        EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tbl.table_name);
        
        -- 3. Drop existing policy if present for clean idempotency
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I', tbl.table_name);
        
        -- 4. Create single permissive policy with USING and WITH CHECK
        -- NULLIF ensures empty string does not throw cast error and fails closed (evaluates to NULL)
        -- Pure fail-closed tenant isolation without any auth_context bypasses (H4, 2c)
        EXECUTE format(
            'CREATE POLICY tenant_isolation_policy ON %I FOR ALL ' ||
            'USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid) ' ||
            'WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)',
            tbl.table_name
        );
    END LOOP;
END
$$;

-- ==============================================================================
-- LEDGER IMMUTABILITY & ANTI-TAMPER CONTROLS (C4, R-024)
-- ==============================================================================

-- 1. Database-level immutability for audit_logs: revoke UPDATE, DELETE, TRUNCATE from application role
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'db_app') THEN
        REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM db_app;
    END IF;
END $$;

-- 2. Cost entries financial immutability trigger
CREATE OR REPLACE FUNCTION enforce_cost_entry_immutability()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow administrative purge only by postgres/db_migrator with explicit session setting
    IF current_user IN ('postgres', 'db_migrator') AND current_setting('app.admin_purge', true) = 'true' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Block any DELETE on cost_entries
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'cost_entries are append-only: deletion is prohibited by database ledger invariant';
    END IF;

    -- On UPDATE, only non-financial status changes (e.g. PENDING -> APPROVED / REJECTED / VOIDED) are permitted.
    -- Financial amounts, cost categories, boq item links, tenant, and project are strictly immutable once created.
    IF TG_OP = 'UPDATE' THEN
        IF NEW.amount <> OLD.amount THEN
            RAISE EXCEPTION 'Financial immutability violation: cost_entries.amount cannot be updated once created';
        END IF;
        IF NEW.cost_category <> OLD.cost_category THEN
            RAISE EXCEPTION 'Financial immutability violation: cost_entries.cost_category cannot be updated once created';
        END IF;
        IF NEW.boq_item_id IS DISTINCT FROM OLD.boq_item_id THEN
            RAISE EXCEPTION 'Financial immutability violation: cost_entries.boq_item_id cannot be updated once created';
        END IF;
        IF NEW.tenant_id <> OLD.tenant_id THEN
            RAISE EXCEPTION 'Tenancy immutability violation: cost_entries.tenant_id cannot be updated once created';
        END IF;
        IF NEW.project_id <> OLD.project_id THEN
            RAISE EXCEPTION 'Project immutability violation: cost_entries.project_id cannot be updated once created';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cost_entry_immutability ON cost_entries;
CREATE TRIGGER trg_cost_entry_immutability
BEFORE UPDATE OR DELETE ON cost_entries
FOR EACH ROW
EXECUTE FUNCTION enforce_cost_entry_immutability();

-- 3. Variations financial immutability trigger
CREATE OR REPLACE FUNCTION enforce_variation_order_immutability()
RETURNS TRIGGER AS $$
BEGIN
    -- Allow administrative purge only by postgres/db_migrator with explicit session setting
    IF current_user IN ('postgres', 'db_migrator') AND current_setting('app.admin_purge', true) = 'true' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'variation_orders are immutable: deletion is prohibited by database ledger invariant';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.status IN ('APPROVED', 'REJECTED', 'VOID') THEN
            IF NEW.net_amount <> OLD.net_amount THEN
                RAISE EXCEPTION 'Financial immutability violation: decided variation net_amount cannot be modified';
            END IF;
        END IF;
        IF NEW.tenant_id <> OLD.tenant_id OR NEW.project_id <> OLD.project_id THEN
            RAISE EXCEPTION 'Tenancy immutability violation: variation tenant_id or project_id cannot be modified';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_variation_order_immutability ON variation_orders;
CREATE TRIGGER trg_variation_order_immutability
BEFORE UPDATE OR DELETE ON variation_orders
FOR EACH ROW
EXECUTE FUNCTION enforce_variation_order_immutability();

-- Narrow SECURITY DEFINER lookup function for IoT telematics device resolution (H4 / C3)
DROP FUNCTION IF EXISTS lookup_telematics_device(TEXT);
CREATE OR REPLACE FUNCTION lookup_telematics_device(p_imei TEXT)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  project_id UUID,
  equipment_id UUID,
  device_imei VARCHAR,
  device_token VARCHAR,
  calibration_tank_capacity_liters NUMERIC,
  max_engine_burn_rate_lph NUMERIC,
  status VARCHAR
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT id, tenant_id, project_id, equipment_id, device_imei, device_token, calibration_tank_capacity_liters, max_engine_burn_rate_lph, status
  FROM public.plant_telematics_devices
  WHERE device_imei = p_imei
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION lookup_telematics_device(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_telematics_device(TEXT) TO db_app;

-- Narrow SECURITY DEFINER lookup function for User Memberships during Login (H4, 2c)
DROP FUNCTION IF EXISTS lookup_user_memberships_for_login(UUID);
CREATE OR REPLACE FUNCTION lookup_user_memberships_for_login(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  user_id UUID,
  role VARCHAR,
  created_at TIMESTAMPTZ,
  tenant_name VARCHAR,
  tenant_slug VARCHAR,
  tenant_currency VARCHAR
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT m.id, m.tenant_id, m.user_id, m.role, m.created_at,
         t.name AS tenant_name, t.slug AS tenant_slug, t.currency AS tenant_currency
  FROM public.memberships m
  JOIN public.tenants t ON t.id = m.tenant_id
  WHERE m.user_id = p_user_id;
$$;
REVOKE ALL ON FUNCTION lookup_user_memberships_for_login(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_user_memberships_for_login(UUID) TO db_app;

-- Narrow SECURITY DEFINER lookup function for Invitation Acceptance (H4, 2c)
DROP FUNCTION IF EXISTS lookup_invitation_by_token(TEXT);
CREATE OR REPLACE FUNCTION lookup_invitation_by_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  email VARCHAR,
  phone VARCHAR,
  role VARCHAR,
  status VARCHAR,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT id, tenant_id, email, phone, role, status, expires_at, created_at
  FROM public.invitations
  WHERE token = p_token
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION lookup_invitation_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_invitation_by_token(TEXT) TO db_app;

-- Narrow SECURITY DEFINER lookup function for Stakeholder Portal by SHA-256 Hash (H4, H5, 2c, 2d)
DROP FUNCTION IF EXISTS lookup_portal_link_by_hash(TEXT);
CREATE OR REPLACE FUNCTION lookup_portal_link_by_hash(p_token_hash TEXT)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  project_id UUID,
  portal_type VARCHAR,
  stakeholder_name VARCHAR,
  stakeholder_role VARCHAR,
  subcontractor_package_id UUID,
  is_active BOOLEAN,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT id, tenant_id, project_id, portal_type, stakeholder_name, stakeholder_role, subcontractor_package_id, is_active, expires_at, created_at
  FROM public.portal_access_links
  WHERE token_hash = p_token_hash
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION lookup_portal_link_by_hash(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_portal_link_by_hash(TEXT) TO db_app;

-- Narrow SECURITY DEFINER lookup for public quote share links (ADR-007)
-- Resolves tenant_id from a SHA-256 share-token hash without an auth context,
-- then all quote reads/writes proceed inside withTenantTx under RLS.
DROP FUNCTION IF EXISTS lookup_quote_by_share_hash(TEXT);
CREATE OR REPLACE FUNCTION lookup_quote_by_share_hash(p_token_hash TEXT)
RETURNS TABLE (
  id UUID,
  tenant_id UUID
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT id, tenant_id
  FROM public.quotes
  WHERE share_token_hash = p_token_hash
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION lookup_quote_by_share_hash(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_quote_by_share_hash(TEXT) TO db_app;

-- Quote expiry job (ADR-007): flips SENT quotes past valid_until to EXPIRED
-- across all tenants. SECURITY DEFINER because the job has no tenant context;
-- it writes the same EXPIRED event trail the respond endpoints produce.
DROP FUNCTION IF EXISTS expire_quotes_batch();
CREATE OR REPLACE FUNCTION expire_quotes_batch()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  r RECORD;
  n INTEGER := 0;
BEGIN
  FOR r IN
    SELECT id, tenant_id, quote_no FROM public.quotes
    WHERE status = 'SENT'
      AND valid_until IS NOT NULL
      AND valid_until < now()
  LOOP
    UPDATE public.quotes SET status = 'EXPIRED', updated_at = now() WHERE id = r.id;
    INSERT INTO public.quote_events (id, tenant_id, quote_id, actor_type, actor_name, event, note)
    VALUES (gen_random_uuid(), r.tenant_id, r.id, 'SYSTEM', 'expiry-job', 'EXPIRED',
            'Quote validity period elapsed (Q-' || lpad(r.quote_no::text, 4, '0') || ')');
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION expire_quotes_batch() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION expire_quotes_batch() TO db_app;

-- Narrow SECURITY DEFINER lookup function for Inbound M-Pesa STK Callback (C1, 2b)
DROP FUNCTION IF EXISTS lookup_mpesa_stk_transaction(TEXT);
CREATE OR REPLACE FUNCTION lookup_mpesa_stk_transaction(p_checkout_request_id TEXT)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  checkout_request_id VARCHAR,
  amount NUMERIC,
  transaction_status VARCHAR
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT id, tenant_id, checkout_request_id, amount, transaction_status
  FROM public.mpesa_subscription_transactions
  WHERE checkout_request_id = p_checkout_request_id
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION lookup_mpesa_stk_transaction(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_mpesa_stk_transaction(TEXT) TO db_app;

-- Narrow SECURITY DEFINER lookup function for Inbound M-Pesa B2C Callback (C1, 2b)
DROP FUNCTION IF EXISTS lookup_mpesa_b2c_transaction(TEXT);
CREATE OR REPLACE FUNCTION lookup_mpesa_b2c_transaction(p_conversation_id TEXT)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  conversation_id VARCHAR,
  originator_conversation_id VARCHAR,
  transaction_status VARCHAR
)
SECURITY DEFINER
SET search_path = public
LANGUAGE sql AS $$
  SELECT id, tenant_id, conversation_id, originator_conversation_id, transaction_status
  FROM public.mpesa_disbursement_transactions
  WHERE conversation_id = p_conversation_id OR originator_conversation_id = p_conversation_id
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION lookup_mpesa_b2c_transaction(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_mpesa_b2c_transaction(TEXT) TO db_app;

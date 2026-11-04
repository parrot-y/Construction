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
        IF tbl.table_name = 'memberships' THEN
            EXECUTE 'CREATE POLICY tenant_isolation_policy ON memberships FOR ALL ' ||
                    'USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid ' ||
                    '       OR current_setting(''app.auth_context'', true) = ''login'') ' ||
                    'WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)';
        ELSIF tbl.table_name = 'invitations' THEN
            EXECUTE 'CREATE POLICY tenant_isolation_policy ON invitations FOR ALL ' ||
                    'USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid ' ||
                    '       OR current_setting(''app.auth_context'', true) = ''invite'') ' ||
                    'WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)';
        ELSIF tbl.table_name = 'portal_access_links' THEN
            EXECUTE 'CREATE POLICY tenant_isolation_policy ON portal_access_links FOR ALL ' ||
                    'USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid ' ||
                    '       OR current_setting(''app.auth_context'', true) = ''portal'') ' ||
                    'WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)';
        ELSE
            EXECUTE format(
                'CREATE POLICY tenant_isolation_policy ON %I FOR ALL ' ||
                'USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid) ' ||
                'WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)',
                tbl.table_name
            );
        END IF;
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
        IF OLD.status IN ('APPROVED', 'REJECTED') THEN
            IF NEW.net_amount <> OLD.net_amount THEN
                RAISE EXCEPTION 'Financial immutability violation: approved or rejected variation net_amount cannot be modified';
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

-- ==============================================================================
-- POSTGRESQL ROW-LEVEL SECURITY ENFORCEMENT SCRIPT (ADR-001, A4, A5)
-- Enables and FORCE-enforces RLS on all tables carrying a tenant_id column.
-- Ensures zero cross-tenant leakage even if application queries omit where clauses.
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
            -- Memberships allows reading under auth_context = 'login' during credential verification
            EXECUTE 'CREATE POLICY tenant_isolation_policy ON memberships FOR ALL ' ||
                    'USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid ' ||
                    '       OR current_setting(''app.auth_context'', true) = ''login'') ' ||
                    'WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)';
        ELSIF tbl.table_name = 'invitations' THEN
            -- Invitations allows reading under auth_context = 'invite' during token redemption
            EXECUTE 'CREATE POLICY tenant_isolation_policy ON invitations FOR ALL ' ||
                    'USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid ' ||
                    '       OR current_setting(''app.auth_context'', true) = ''invite'') ' ||
                    'WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)';
        ELSIF tbl.table_name = 'portal_access_links' THEN
            -- portal_access_links allows reading under auth_context = 'portal' during external token redemption
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

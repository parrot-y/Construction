import { describe, expect, it } from 'vitest';
import { Permissions, Roles, hasPermission } from './index';

describe('packages/permissions suite', () => {
  it('correctly validates admin has all permissions', () => {
    expect(hasPermission(Roles.ADMIN, Permissions.PROJECT_CREATE)).toBe(true);
    expect(hasPermission(Roles.ADMIN, Permissions.BOQ_IMPORT)).toBe(true);
    expect(hasPermission(Roles.ADMIN, Permissions.COST_APPROVE)).toBe(true);
  });

  it('restricts cost approval from site supervisors and clients', () => {
    expect(hasPermission(Roles.SITE_SUPERVISOR, Permissions.COST_APPROVE)).toBe(false);
    expect(hasPermission(Roles.CLIENT, Permissions.COST_APPROVE)).toBe(false);
    expect(hasPermission(Roles.PM_QS, Permissions.COST_APPROVE)).toBe(true);
  });

  it('allows clients to approve variations but not create them', () => {
    expect(hasPermission(Roles.CLIENT, Permissions.VARIATION_APPROVE)).toBe(true);
    expect(hasPermission(Roles.CLIENT, Permissions.VARIATION_REQUEST)).toBe(false);
  });

  it('allows site supervisors to create site diaries and progress records', () => {
    expect(hasPermission(Roles.SITE_SUPERVISOR, Permissions.SITE_DIARY_CREATE)).toBe(true);
    expect(hasPermission(Roles.SITE_SUPERVISOR, Permissions.PROGRESS_RECORD)).toBe(true);
    expect(hasPermission(Roles.SITE_SUPERVISOR, Permissions.BOQ_IMPORT)).toBe(false);
  });
});

describe('Gate-5 role ladder (observed doc 15)', () => {
  it('EXECUTIVE has oversight + approve but not site diary create', () => {
    expect(hasPermission(Roles.EXECUTIVE, Permissions.COST_APPROVE)).toBe(true);
    expect(hasPermission(Roles.EXECUTIVE, Permissions.REPORT_GENERATE)).toBe(true);
    expect(hasPermission(Roles.EXECUTIVE, Permissions.COMPANY_INVITE)).toBe(true);
    expect(hasPermission(Roles.EXECUTIVE, Permissions.SITE_DIARY_CREATE)).toBe(false);
    expect(hasPermission(Roles.EXECUTIVE, Permissions.BOQ_IMPORT)).toBe(false);
  });

  it('SUPERINTENDENT has financial tracker + CO review, no billing admin', () => {
    expect(hasPermission(Roles.SUPERINTENDENT, Permissions.COST_VIEW)).toBe(true);
    expect(hasPermission(Roles.SUPERINTENDENT, Permissions.CERTIFICATE_MANAGE)).toBe(true);
    expect(hasPermission(Roles.SUPERINTENDENT, Permissions.VARIATION_REVIEW)).toBe(true);
    expect(hasPermission(Roles.SUPERINTENDENT, Permissions.COMPANY_MANAGE)).toBe(false);
  });

  it('SITE_ENGINEER is field-scoped: diary+progress yes, money no', () => {
    expect(hasPermission(Roles.SITE_ENGINEER, Permissions.SITE_DIARY_CREATE)).toBe(true);
    expect(hasPermission(Roles.SITE_ENGINEER, Permissions.PROGRESS_RECORD)).toBe(true);
    expect(hasPermission(Roles.SITE_ENGINEER, Permissions.COST_VIEW)).toBe(false);
    expect(hasPermission(Roles.SITE_ENGINEER, Permissions.INVOICE_CREATE)).toBe(false);
  });

  it('TRADE_LEAD can bid tenders and view invoices but not approve costs', () => {
    expect(hasPermission(Roles.TRADE_LEAD, Permissions.TENDER_BID)).toBe(true);
    expect(hasPermission(Roles.TRADE_LEAD, Permissions.INVOICE_VIEW)).toBe(true);
    expect(hasPermission(Roles.TRADE_LEAD, Permissions.COST_APPROVE)).toBe(false);
  });

  it('FOREMAN/WORKER are field-only; VIEWER is read-only', () => {
    expect(hasPermission(Roles.FOREMAN, Permissions.SITE_DIARY_CREATE)).toBe(true);
    expect(hasPermission(Roles.FOREMAN, Permissions.COST_VIEW)).toBe(false);
    expect(hasPermission(Roles.WORKER, Permissions.PROGRESS_RECORD)).toBe(false);
    expect(hasPermission(Roles.WORKER, Permissions.SITE_DIARY_VIEW)).toBe(true);
    for (const perm of [Permissions.PROJECT_VIEW, Permissions.SITE_DIARY_VIEW, Permissions.REPORT_VIEW]) {
      expect(hasPermission(Roles.VIEWER, perm)).toBe(true);
    }
    expect(hasPermission(Roles.VIEWER, Permissions.SITE_DIARY_CREATE)).toBe(false);
    expect(hasPermission(Roles.VIEWER, Permissions.COST_APPROVE)).toBe(false);
    expect(hasPermission(Roles.VIEWER, Permissions.COMPANY_MANAGE)).toBe(false);
  });
});

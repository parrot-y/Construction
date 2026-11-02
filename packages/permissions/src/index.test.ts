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

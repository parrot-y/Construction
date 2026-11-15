import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getRoleNav } from '../navConfig';
import type { AuthSession } from '../../../types/auth';

const setSection = vi.fn();
const setTab = vi.fn();
let mockTab = 'dashboard';

vi.mock('../ConsoleContext', () => ({
  useConsole: () => ({
    session: {
      user: { id: 'u-super', role: 'SITE_SUPERVISOR', fullName: 'Site Supervisor', email: 'sup@example.com' },
    } as AuthSession,
    nav: getRoleNav('SITE_SUPERVISOR'),
    projects: [{ id: 'p1', name: 'Kileleshwa Apartments', code: 'KLA' }],
    projectId: 'p1',
    tab: mockTab,
    setSection,
    setTab,
  }),
}));

import HomeSection from './HomeSection';

describe('Field-role console home (SITE_SUPERVISOR)', () => {
  it('leads with today\'s work before the team inbox', () => {
    mockTab = 'dashboard';
    const html = renderToString(<HomeSection />);
    // renderToString escapes apostrophes as &#x27;
    expect(html).toContain('Today&#x27;s work');
    expect(html).toContain('Log today&#x27;s diary');
    expect(html).toContain('Today&#x27;s headcount');
    expect(html).toContain('Open snags');
    expect(html).toContain('Report safety incident');
    // Today's work panel precedes the inbox (InboxView SSRs its loading state).
    expect(html.indexOf('Today&#x27;s work')).toBeLessThan(html.indexOf('Loading inbox'));
  });

  it('keeps announcements as its own tab without the today panel', () => {
    mockTab = 'announcements';
    const html = renderToString(<HomeSection />);
    expect(html).not.toContain("Today's work");
    mockTab = 'dashboard';
  });
});

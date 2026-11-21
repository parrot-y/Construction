import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { formatDate, formatDateTime, formatTime } from './format';
import SafetyIncidentLogView from '../components/SafetyIncidentLogView';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * J4 — dates render through the shared helpers everywhere: "16 Nov 2026",
 * "16 Nov 2026, 07:45", "07:45" — never the browser's M/D/YYYY default.
 */

describe('shared date helpers', () => {
  it('formats dates, date-times and times in one readable style', () => {
    expect(formatDate('2026-11-16')).toBe('16 Nov 2026');
    expect(formatDate('2026-11-16T00:00:00.000Z')).toBe('16 Nov 2026');
    expect(formatDateTime('2026-11-16T04:45:00.000Z')).toMatch(/^16 Nov 2026, \d{2}:\d{2}$/);
    expect(formatTime('2026-11-16T04:45:00.000Z')).toMatch(/^\d{2}:\d{2}$/);
    expect(formatDate(null)).toBe('—');
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('rendered screens never show M/D/YYYY', () => {
  it('safety incident log renders "16 Nov 2026, …" not "11/16/2026, 7:45:00 AM"', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <SafetyIncidentLogView
          projectId="proj-1"
          initialIncidents={[
            {
              id: 'inc-1',
              incident_date: '2026-11-16T04:45:00.000Z',
              location_on_site: 'Block B slab',
              incident_type: 'NEAR_MISS',
              severity: 'MEDIUM',
              description: 'Rebar stack shifted during lift',
              affected_person: '—',
              immediate_action: 'Area cordoned',
              corrective_action: 'Re-lash and re-train',
              is_osha_reportable: false,
              status: 'OPEN',
              recorded_by: { full_name: 'Site Foreman' },
              reported_at: '2026-11-16T05:00:00.000Z',
            } as any,
          ]}
        />,
      );
    });
    const html = container.innerHTML;
    expect(html).not.toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    expect(html).toContain('Nov 2026');
    await act(async () => { root.unmount(); });
    container.remove();
  });

  it('no component renders a locale date string that can produce M/D/YYYY', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) { walk(p); continue; }
        if (!p.endsWith('.tsx')) continue;
        const src = readFileSync(p, 'utf8');
        if (/\.toLocaleDateString\(|\.toLocaleTimeString\(/.test(src)) offenders.push(p);
        if (/new Date\([^)]*\)\.toLocaleString\(/.test(src)) offenders.push(p);
      }
    };
    walk(join(__dirname, '..', 'components'));
    expect(offenders, `locale date renders remain in: ${offenders.join(', ')}`).toEqual([]);
  });
});

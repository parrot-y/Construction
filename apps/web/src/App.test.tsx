import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from './App';

describe('Web App walking skeleton mount test', () => {
  it('renders the walking skeleton header and financial placeholder', () => {
    const html = renderToString(<App />);
    expect(html).toContain('Construction Project Operations');
    expect(html).toContain('KES');
    expect(html).toContain('12850000.50');
    expect(html).toContain('Milestone M0 • Walking Skeleton');
  });
});

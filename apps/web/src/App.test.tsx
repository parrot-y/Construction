import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from './App';
import Dashboard from './components/Dashboard';
import LoginForm from './components/LoginForm';
import { AuthSession } from './types/auth';

describe('Web App walking skeleton & login suite (Milestone M1)', () => {
  it('renders the login screen by default with demo accounts and title', () => {
    const html = renderToString(<LoginForm onLoginSuccess={() => {}} />);
    expect(html).toContain('Apex Builders Kenya');
    expect(html).toContain('Milestone M1 • Walking Skeleton');
    expect(html).toContain('admin@apexbuilders.co.ke');
    expect(html).toContain('COMPANY_ADMIN');
    expect(html).toContain('PM_QS');
    expect(html).toContain('SITE_SUPERVISOR');
    expect(html).toContain('CLIENT');
  });

  it('renders the App component root unauthenticated', () => {
    const html = renderToString(<App />);
    expect(html).toContain('Apex Builders Kenya');
    expect(html).toContain('Sign in to access your project workspace');
  });

  it('renders the role-scoped dashboard when session is active', () => {
    const mockSession: AuthSession = {
      user: {
        id: '9deec00e-ff90-4c1b-a5c2-dadc10991932',
        email: 'qs@apexbuilders.co.ke',
        fullName: 'Faith Achieng',
        role: 'PM_QS',
        tenant: {
          id: 'tenant-123',
          name: 'Apex Builders Kenya Ltd',
          slug: 'apex-builders',
          currency: 'KES',
        },
      },
      permissions: ['boq.import', 'cost.approve', 'project.view'],
      token: 'mock-jwt-token',
    };

    const html = renderToString(<Dashboard session={mockSession} onLogout={() => {}} />);
    expect(html).toContain('Apex Builders Kenya Ltd');
    expect(html).toContain('Faith Achieng');
    expect(html).toContain('PM_QS');
    expect(html).toContain('Riverside Commercial Plaza');
    expect(html).toContain('45000000.00');
    expect(html).toContain('boq.import');
    expect(html).toContain('cost.approve');
  });
});

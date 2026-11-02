import React from 'react';
import { toCurrencyString } from '@construction/money';
import { Roles } from '@construction/permissions';

export default function App(): React.JSX.Element {
  const sampleAmount = toCurrencyString('12850000.5');

  return (
    <main className="min-h-screen bg-slate-100 p-8 font-sans">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <header className="border-b border-slate-200 pb-4 mb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
            Milestone M0 • Walking Skeleton
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">
            Construction Project Operations
          </h1>
          <p className="text-sm text-slate-600">
            Kenya-first multi-tenant construction management platform.
          </p>
        </header>

        <section className="space-y-4">
          <div className="p-4 bg-slate-50 rounded border border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">Financial Engine Test</h2>
            <p className="text-xs text-slate-500 mt-1">Verified via @construction/money:</p>
            <p className="text-lg font-mono font-bold text-slate-900 mt-1">
              KES {sampleAmount}
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded border border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">RBAC Engine Test</h2>
            <p className="text-xs text-slate-500 mt-1">Verified via @construction/permissions:</p>
            <div className="flex gap-2 mt-2">
              <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded font-medium">
                {Roles.ADMIN}
              </span>
              <span className="text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded font-medium">
                {Roles.PM_QS}
              </span>
              <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded font-medium">
                {Roles.SITE_SUPERVISOR}
              </span>
              <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded font-medium">
                {Roles.CLIENT}
              </span>
            </div>
          </div>
        </section>

        <footer className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400">
          Core Product Loop: BOQ → Budget → Site Progress → Cost → Evidence → Approvals → Client Visibility
        </footer>
      </div>
    </main>
  );
}

import React, { useState } from 'react';
import { toCurrencyString } from '@construction/money';

export interface StatutoryTaxCertificate {
  id: string;
  certificate_no: string;
  payee_type: 'MAIN_CONTRACTOR' | 'TRADE_SUBCONTRACTOR' | 'CONSULTANT';
  payee_name: string;
  payee_kra_pin: string;
  invoice_or_ipc_ref: string;
  gross_amount: string | number;
  wht_rate_pct: string | number;
  wht_deducted: string | number;
  whvat_rate_pct: string | number;
  whvat_deducted: string | number;
  net_payable: string | number;
  status: 'GENERATED' | 'REMITTED_TO_KRA' | 'ACKNOWLEDGED';
  itax_acknowledgement_receipt?: string | null;
  created_at: string;
}

interface StatutoryTaxManagementViewProps {
  projectId: string;
  canIssue?: boolean;
  initialCertificates?: StatutoryTaxCertificate[];
  onCertificateIssued?: (cert: Partial<StatutoryTaxCertificate>) => void;
  onRemitted?: (id: string, receipt: string) => void;
}

export default function StatutoryTaxManagementView({
  projectId,
  canIssue = true,
  initialCertificates = [
    {
      id: 'tax-1',
      certificate_no: 'KRA-WHT-2026-0081',
      payee_type: 'MAIN_CONTRACTOR',
      payee_name: 'Apex Builders Kenya Ltd',
      payee_kra_pin: 'P051234567Z',
      invoice_or_ipc_ref: 'IPC-RCP-001',
      gross_amount: '4500000.00',
      wht_rate_pct: '3.00',
      wht_deducted: '135000.00',
      whvat_rate_pct: '2.00',
      whvat_deducted: '90000.00',
      net_payable: '4275000.00',
      status: 'ACKNOWLEDGED',
      itax_acknowledgement_receipt: 'ITAX-ACK-9021882',
      created_at: '2026-02-28T14:00:00Z',
    },
    {
      id: 'tax-2',
      certificate_no: 'KRA-WHT-2026-0094',
      payee_type: 'TRADE_SUBCONTRACTOR',
      payee_name: 'Simba Plumbing Works Ltd',
      payee_kra_pin: 'P058899112K',
      invoice_or_ipc_ref: 'SUB-INV-PLUMB-01',
      gross_amount: '850000.00',
      wht_rate_pct: '3.00',
      wht_deducted: '25500.00',
      whvat_rate_pct: '2.00',
      whvat_deducted: '17000.00',
      net_payable: '807500.00',
      status: 'GENERATED',
      itax_acknowledgement_receipt: null,
      created_at: '2026-03-05T09:30:00Z',
    },
  ],
  onCertificateIssued,
  onRemitted,
}: StatutoryTaxManagementViewProps) {
  const [certs, setCerts] = useState<StatutoryTaxCertificate[]>(initialCertificates);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [remitModalId, setRemitModalId] = useState<string | null>(null);
  const [receiptInput, setReceiptInput] = useState<string>('');

  // Form State
  const [payeeName, setPayeeName] = useState<string>('');
  const [payeePin, setPayeePin] = useState<string>('P05');
  const [payeeType, setPayeeType] = useState<StatutoryTaxCertificate['payee_type']>('TRADE_SUBCONTRACTOR');
  const [invoiceRef, setInvoiceRef] = useState<string>('');
  const [grossAmount, setGrossAmount] = useState<string>('500000.00');
  const [whtRate, setWhtRate] = useState<string>('3.00');
  const [whvatRate, setWhvatRate] = useState<string>('2.00');

  const filtered = certs.filter((c) => {
    return statusFilter === 'ALL' || c.status === statusFilter;
  });

  const totalGross = certs.reduce((sum, c) => sum + (Number(c.gross_amount) || 0), 0);
  const totalWht = certs.reduce((sum, c) => sum + (Number(c.wht_deducted) || 0), 0);
  const totalWhvat = certs.reduce((sum, c) => sum + (Number(c.whvat_deducted) || 0), 0);
  const totalNet = certs.reduce((sum, c) => sum + (Number(c.net_payable) || 0), 0);

  // Live preview calculation
  const grossNum = Number(grossAmount) || 0;
  const whtNum = grossNum * (Number(whtRate) / 100);
  const whvatNum = grossNum * (Number(whvatRate) / 100);
  const netNum = grossNum - whtNum - whvatNum;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payeeName.trim() || !payeePin.trim() || !invoiceRef.trim() || grossNum <= 0) return;

    const created: StatutoryTaxCertificate = {
      id: `tax-${Date.now()}`,
      certificate_no: `KRA-WHT-${Date.now().toString().slice(-6)}`,
      payee_type: payeeType,
      payee_name: payeeName.trim(),
      payee_kra_pin: payeePin.trim().toUpperCase(),
      invoice_or_ipc_ref: invoiceRef.trim(),
      gross_amount: grossNum.toFixed(2),
      wht_rate_pct: whtRate,
      wht_deducted: whtNum.toFixed(2),
      whvat_rate_pct: whvatRate,
      whvat_deducted: whvatNum.toFixed(2),
      net_payable: netNum.toFixed(2),
      status: 'GENERATED',
      created_at: new Date().toISOString(),
    };

    setCerts([created, ...certs]);
    if (onCertificateIssued) onCertificateIssued(created);
    setShowModal(false);
    setPayeeName('');
    setInvoiceRef('');
  };

  const handleRemit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remitModalId || !receiptInput.trim()) return;

    setCerts(
      certs.map((c) =>
        c.id === remitModalId
          ? { ...c, status: 'ACKNOWLEDGED', itax_acknowledgement_receipt: receiptInput.trim() }
          : c
      )
    );
    if (onRemitted) onRemitted(remitModalId, receiptInput.trim());
    setRemitModalId(null);
    setReceiptInput('');
  };

  const getStatusBadge = (status: StatutoryTaxCertificate['status']) => {
    switch (status) {
      case 'ACKNOWLEDGED':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">iTax Acknowledged</span>;
      case 'REMITTED_TO_KRA':
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 text-sky-800">Remitted to KRA</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">Generated (Pending Remit)</span>;
    }
  };

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
      data-testid="statutory-tax-management-view"
      data-project-id={projectId}
    >
      {/* Header & KPI Summary */}
      <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-red-100 text-red-800">
                KRA CAP 470 (WHT &amp; WHVAT)
              </span>
              <h2 className="text-xl font-bold text-slate-900">Statutory Tax &amp; Withholding Certificates</h2>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Kenyan Income Tax compliance: 3% contractual withholding, 2% WHVAT, and iTax payment advisory slips.
            </p>
          </div>
          {canIssue && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-red-700 hover:bg-red-800 shadow-sm"
            >
              📋 Generate Tax Withholding Slip
            </button>
          )}
        </div>

        {/* 4 Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Total Gross Certified</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-slate-900 font-mono">
                {toCurrencyString(totalGross)}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-2">Certified contract progress</div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">3% WHT Withheld</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-red-700 font-mono">
                {toCurrencyString(totalWht)}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-2">Remitted to KRA Account</div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">2% WHVAT Withheld</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-amber-700 font-mono">
                {toCurrencyString(totalWhvat)}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-2">VAT Withholding Agent</div>
          </div>

          <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-xs">
            <span className="text-xs text-slate-500 font-medium">Net Disbursed</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-emerald-700 font-mono">
                {toCurrencyString(totalNet)}
              </span>
            </div>
            <div className="text-xs text-emerald-700 mt-2 font-medium">Cleared for payee payout</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 uppercase">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-white text-slate-700"
          >
            <option value="ALL">All Certificates</option>
            <option value="GENERATED">Generated (Pending)</option>
            <option value="REMITTED_TO_KRA">Remitted to KRA</option>
            <option value="ACKNOWLEDGED">iTax Acknowledged</option>
          </select>
        </div>
      </div>

      {/* Certificates Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50 font-semibold text-slate-600">
            <tr>
              <th className="py-3 px-4 text-left">Certificate No.</th>
              <th className="py-3 px-4 text-left">Payee &amp; KRA PIN</th>
              <th className="py-3 px-4 text-left">Invoice / IPC</th>
              <th className="py-3 px-4 text-right">Gross Amount</th>
              <th className="py-3 px-4 text-right">3% WHT</th>
              <th className="py-3 px-4 text-right">2% WHVAT</th>
              <th className="py-3 px-4 text-right font-bold text-slate-900">Net Payable</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.map((cert) => (
              <tr key={cert.id} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-mono font-bold text-slate-900">
                  {cert.certificate_no}
                </td>
                <td className="py-3 px-4">
                  <span className="font-semibold text-slate-900 block">{cert.payee_name}</span>
                  <span className="font-mono text-slate-500 text-[11px]">PIN: {cert.payee_kra_pin}</span>
                </td>
                <td className="py-3 px-4 font-mono text-slate-700">
                  {cert.invoice_or_ipc_ref}
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-800">
                  {toCurrencyString(cert.gross_amount)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-red-700 font-medium">
                  -{toCurrencyString(cert.wht_deducted)}
                </td>
                <td className="py-3 px-4 text-right font-mono text-amber-700 font-medium">
                  -{toCurrencyString(cert.whvat_deducted)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-800">
                  {toCurrencyString(cert.net_payable)}
                </td>
                <td className="py-3 px-4 text-center">
                  {getStatusBadge(cert.status)}
                  {cert.itax_acknowledgement_receipt && (
                    <span className="block font-mono text-[10px] text-slate-500 mt-0.5">
                      {cert.itax_acknowledgement_receipt}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-right">
                  {cert.status !== 'ACKNOWLEDGED' ? (
                    <button
                      onClick={() => setRemitModalId(cert.id)}
                      className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-800 rounded font-semibold text-[11px]"
                    >
                      Remit iTax
                    </button>
                  ) : (
                    <span className="text-emerald-700 font-bold text-xs">✓ Cleared</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Generate Tax Certificate Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Generate KRA Withholding Certificate</h3>
            <p className="text-xs text-slate-500 mb-4">
              Calculates statutory 3% WHT (works) &amp; 2% WHVAT per KRA Income Tax Act.
            </p>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payee Category</label>
                  <select
                    value={payeeType}
                    onChange={(e) => setPayeeType(e.target.value as any)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2"
                  >
                    <option value="TRADE_SUBCONTRACTOR">Trade Subcontractor</option>
                    <option value="MAIN_CONTRACTOR">Main Contractor</option>
                    <option value="CONSULTANT">Consulting Professional</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payee KRA PIN</label>
                  <input
                    type="text"
                    required
                    placeholder="P051234567Z"
                    value={payeePin}
                    onChange={(e) => setPayeePin(e.target.value.toUpperCase())}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payee Firm / Individual Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Electrical Engineering Ltd"
                  value={payeeName}
                  onChange={(e) => setPayeeName(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">IPC / Invoice Reference</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. IPC-002 / INV-04"
                    value={invoiceRef}
                    onChange={(e) => setInvoiceRef(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gross Valued Amount (KES)</label>
                  <input
                    type="text"
                    required
                    value={grossAmount}
                    onChange={(e) => setGrossAmount(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">WHT Rate (%)</label>
                  <input
                    type="text"
                    value={whtRate}
                    onChange={(e) => setWhtRate(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">WHVAT Rate (%)</label>
                  <input
                    type="text"
                    value={whvatRate}
                    onChange={(e) => setWhvatRate(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              {/* Live Statutory Breakdown Card */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Valuation:</span>
                  <span className="font-mono font-bold text-slate-900">{toCurrencyString(grossNum)}</span>
                </div>
                <div className="flex justify-between text-red-700">
                  <span>Less 3% KRA Withholding Tax (WHT):</span>
                  <span className="font-mono font-bold">-{toCurrencyString(whtNum)}</span>
                </div>
                <div className="flex justify-between text-amber-700">
                  <span>Less 2% Withholding VAT (WHVAT):</span>
                  <span className="font-mono font-bold">-{toCurrencyString(whvatNum)}</span>
                </div>
                <div className="flex justify-between text-emerald-800 pt-1 border-t border-slate-200 font-bold text-sm">
                  <span>Net Payable Amount:</span>
                  <span className="font-mono">{toCurrencyString(netNum)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg shadow-sm"
                >
                  Generate Certificate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remit to iTax Modal */}
      {remitModalId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-100">
            <h3 className="text-base font-bold text-slate-900 mb-1">Record KRA iTax Remittance</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter official KRA Payment Registration Number (PRN) or iTax acknowledgement slip.
            </p>
            <form onSubmit={handleRemit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">iTax Receipt / PRN No.</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ITAX-PRN-2026-90432"
                  value={receiptInput}
                  onChange={(e) => setReceiptInput(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRemitModalId(null)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg shadow-sm"
                >
                  Confirm Remittance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

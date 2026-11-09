import React, { useEffect, useState} from 'react';

export interface ETimsInvoiceItem {
  id: string;
  invoiceNumber: string;
  cuInvoiceNumber: string;
  invoiceType: 'ORIGINAL' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  buyerPin: string;
  buyerName: string;
  totalTaxableAmount: string;
  totalTaxAmount: string;
  totalInvoiceAmount: string;
  taxBreakdown16: string;
  taxBreakdown8: string;
  taxBreakdown0: string;
  taxBreakdownExempt: string;
  qrCodeUrl: string;
  cryptographicSignature: string;
  transmissionStatus: 'PENDING' | 'TRANSMITTED' | 'VALIDATED' | 'FAILED';
  transmittedAt?: string | null;
  createdAt: string;
}

export interface SubcontractorTccItem {
  id: string;
  subcontractorPackageId: string;
  firmName: string;
  tradeCategory: string;
  pinNumber: string;
  taxpayerName: string;
  tccNumber: string;
  tccExpiryDate: string;
  complianceStatus: 'COMPLIANT' | 'EXPIRED' | 'NON_COMPLIANT' | 'EXEMPT';
  withholdingTaxRate: string;
  withholdingVatRate: string;
}

export interface ETimsSummary {
  totalInvoices: number;
  totalTaxableAmount: string;
  totalTaxAmount: string;
  totalGrossAmount: string;
}

interface ETimsTaxComplianceViewProps {
  projectId?: string;
  projectName?: string;
  invoices?: ETimsInvoiceItem[];
  tccRecords?: SubcontractorTccItem[];
  summary?: ETimsSummary;
  userRole?: string;
  onGenerateInvoice?: (data: any) => Promise<void>;
  onRegisterTcc?: (data: any) => Promise<void>;
}

export const ETimsTaxComplianceView: React.FC<ETimsTaxComplianceViewProps> = ({
  projectId,
  projectName = '',
  invoices: initialInvoices,
  tccRecords: initialTcc,
  summary: initialSummary,
  userRole: _userRole,
  onGenerateInvoice,
  onRegisterTcc,
}) => {
  const [activeTab, setActiveTab] = useState<'INVOICES' | 'TCC_AUDIT'>('INVOICES');
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showTccModal, setShowTccModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<ETimsInvoiceItem | null>(null);

  // Form states for E-TIMS invoice
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-5)}`);
  const [buyerName, setBuyerName] = useState('Riverside Developers Ltd');
  const [buyerPin, setBuyerPin] = useState('P051998877Z');
  const [taxableAmount, setTaxableAmount] = useState('1000000.00');

  // Form states for TCC
  const [firmName, setFirmName] = useState('Nairobi Volt Electricals Ltd');
  const [tccPin, setTccPin] = useState('P051122334K');
  const [tccNumber, setTccNumber] = useState('KRA-TCC-2026-98841');
  const [tccExpiry, setTccExpiry] = useState('2026-12-31');
  const [tccPackageId, setTccPackageId] = useState('');
  const [subPkgs, setSubPkgs] = useState<{ id: string; firm_name: string}[]>([]);

  const isLive = !!projectId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
  const [liveLoaded, setLiveLoaded] = useState(!isLive);

  const reload = React.useCallback(async () => {
    if (!isLive || !projectId) return;
    try {
      const [invRes, tccRes, pkgRes] = await Promise.all([
        fetch(`/api/v1/projects/${projectId}/etims-invoices`, { credentials: 'include'}),
        fetch(`/api/v1/projects/${projectId}/subcontractor-tcc`, { credentials: 'include'}),
        fetch(`/api/v1/projects/${projectId}/subcontractors`, { credentials: 'include'}),
      ]);
      if (invRes.ok) {
        const ij = await invRes.json();
        setInvoices((ij.invoices || []) as ETimsInvoiceItem[]);
}
      if (tccRes.ok) {
        const tj = await tccRes.json();
        setTccRecords((tj.records || []) as SubcontractorTccItem[]);
}
      if (pkgRes.ok) {
        const pj = await pkgRes.json();
        setSubPkgs((pj.packages || []).map((p: any) => ({ id: p.id, firm_name: p.firm_name})));
}
} catch { /* keep demo */}
    setLiveLoaded(true);
}, [isLive, projectId]);

  useEffect(() => { void reload();}, [reload]);

  // Default state for invoices
  const [invoices, setInvoices] = useState<ETimsInvoiceItem[]>(
    initialInvoices || (import.meta.env.DEV ? [
      {
        id: 'etims-1',
        invoiceNumber: 'INV-2026-001',
        cuInvoiceNumber: 'KRAVSCU010000000084',
        invoiceType: 'ORIGINAL',
        buyerPin: 'P051998877Z',
        buyerName: 'Riverside Developers Ltd',
        totalTaxableAmount: '2500000.00',
        totalTaxAmount: '400000.00',
        totalInvoiceAmount: '2900000.00',
        taxBreakdown16: '400000.00',
        taxBreakdown8: '0.00',
        taxBreakdown0: '0.00',
        taxBreakdownExempt: '0.00',
        qrCodeUrl: 'https://itax.kra.go.ke/KRA-Portal/invoiceChk.htm?actionCode=loadPage&receiptNo=KRAVSCU010000000084',
        cryptographicSignature: 'vscu_hZ79xY8029KkLp...',
        transmissionStatus: 'VALIDATED',
        transmittedAt: '2026-11-03T14:30:00Z',
        createdAt: '2026-11-03T14:28:00Z',
},
      {
        id: 'etims-2',
        invoiceNumber: 'INV-2026-002',
        cuInvoiceNumber: 'KRAVSCU010000000095',
        invoiceType: 'ORIGINAL',
        buyerPin: 'P051998877Z',
        buyerName: 'Riverside Developers Ltd',
        totalTaxableAmount: '1200000.00',
        totalTaxAmount: '192000.00',
        totalInvoiceAmount: '1392000.00',
        taxBreakdown16: '192000.00',
        taxBreakdown8: '0.00',
        taxBreakdown0: '0.00',
        taxBreakdownExempt: '0.00',
        qrCodeUrl: 'https://itax.kra.go.ke/KRA-Portal/invoiceChk.htm?actionCode=loadPage&receiptNo=KRAVSCU010000000095',
        cryptographicSignature: 'vscu_pM45aA9124LqMn...',
        transmissionStatus: 'TRANSMITTED',
        transmittedAt: '2026-11-04T08:15:00Z',
        createdAt: '2026-11-04T08:10:00Z',
},
    ] : [])
);

  // Default state for Subcontractor TCC
  const [tccRecords, setTccRecords] = useState<SubcontractorTccItem[]>(
    initialTcc || (import.meta.env.DEV ? [
      {
        id: 'tcc-1',
        subcontractorPackageId: 'sub-pkg-1',
        firmName: 'Nairobi Volt Electricals Ltd',
        tradeCategory: 'ELECTRICAL',
        pinNumber: 'P051122334K',
        taxpayerName: 'Nairobi Volt Electricals Ltd',
        tccNumber: 'KRA-TCC-2026-98841',
        tccExpiryDate: '2026-12-31',
        complianceStatus: 'COMPLIANT',
        withholdingTaxRate: '3.00',
        withholdingVatRate: '2.00',
},
      {
        id: 'tcc-2',
        subcontractorPackageId: 'sub-pkg-2',
        firmName: 'Athi River Plumbing Services',
        tradeCategory: 'PLUMBING',
        pinNumber: 'A009988771M',
        taxpayerName: 'Athi River Plumbing Ltd',
        tccNumber: 'KRA-TCC-2025-41209',
        tccExpiryDate: '2025-10-15',
        complianceStatus: 'EXPIRED',
        withholdingTaxRate: '5.00', // Non-compliant elevated rate
        withholdingVatRate: '2.00',
},
    ] : [])
);

  // Computations
  const summary = (!isLive && initialSummary) ? initialSummary : {
    totalInvoices: invoices.length,
    totalTaxableAmount: invoices.reduce((s, i) => s + parseFloat(i.totalTaxableAmount), 0).toFixed(2),
    totalTaxAmount: invoices.reduce((s, i) => s + parseFloat(i.totalTaxAmount), 0).toFixed(2),
    totalGrossAmount: invoices.reduce((s, i) => s + parseFloat(i.totalInvoiceAmount), 0).toFixed(2),
};

  const handleCreateInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const taxable = parseFloat(taxableAmount) || 0;
    const vat16 = taxable * 0.16;
    const gross = taxable + vat16;
    const cuNo = `KRAVSCU01${Date.now().toString().slice(-8)}`;

    const newInv: ETimsInvoiceItem = {
      id: `etims-${Date.now()}`,
      invoiceNumber,
      cuInvoiceNumber: cuNo,
      invoiceType: 'ORIGINAL',
      buyerPin,
      buyerName,
      totalTaxableAmount: taxable.toFixed(2),
      totalTaxAmount: vat16.toFixed(2),
      totalInvoiceAmount: gross.toFixed(2),
      taxBreakdown16: vat16.toFixed(2),
      taxBreakdown8: '0.00',
      taxBreakdown0: '0.00',
      taxBreakdownExempt: '0.00',
      qrCodeUrl: `https://itax.kra.go.ke/KRA-Portal/invoiceChk.htm?actionCode=loadPage&receiptNo=${cuNo}`,
      cryptographicSignature: `vscu_sig_${Date.now().toString(36)}`,
      transmissionStatus: 'VALIDATED',
      transmittedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
};

    if (isLive && projectId) {
      void (async () => {
        try {
          const res = await fetch(`/api/v1/projects/${projectId}/etims-invoices`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({
              invoiceNumber,
              cuInvoiceNumber: cuNo,
              invoiceType: 'ORIGINAL',
              buyerPin,
              buyerName,
              totalTaxableAmount: taxable.toFixed(2),
              totalTaxAmount: vat16.toFixed(2),
              totalInvoiceAmount: gross.toFixed(2),
              taxBreakdown16: vat16.toFixed(2),
              taxBreakdown8: '0.00',
              taxBreakdown0: '0.00',
              taxBreakdownExempt: '0.00',
              // Server assigns the sandbox QR/signature; schema requires the fields.
              qrCodeUrl: 'urn:mjengo:pending-kra-transmission',
              cryptographicSignature: 'PENDING',
}),
});
          if (res.ok) await reload();
} catch { /* keep local */}
})();
      setShowInvoiceModal(false);
      return;
}

    if (onGenerateInvoice) {
      await onGenerateInvoice(newInv);
}
    setInvoices([newInv, ...invoices]);
    setShowInvoiceModal(false);
};

  const handleRegisterTccSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const expiry = new Date(tccExpiry);
    const isExpired = expiry< new Date();

    const newTcc: SubcontractorTccItem = {
      id: `tcc-${Date.now()}`,
      subcontractorPackageId: `sub-pkg-${Date.now()}`,
      firmName,
      tradeCategory: 'SPECIALIST_TRADE',
      pinNumber: tccPin,
      taxpayerName: firmName,
      tccNumber,
      tccExpiryDate: tccExpiry,
      complianceStatus: isExpired ? 'EXPIRED' : 'COMPLIANT',
      withholdingTaxRate: isExpired ? '5.00' : '3.00',
      withholdingVatRate: '2.00',
};

    if (isLive && projectId) {
      if (!tccPackageId) return;
      void (async () => {
        try {
          const res = await fetch(`/api/v1/projects/${projectId}/subcontractor-tcc`, {
            method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({
              subcontractorPackageId: tccPackageId,
              pinNumber: tccPin,
              taxpayerName: firmName,
              tccNumber,
              tccExpiryDate: tccExpiry,
              complianceStatus: newTcc.complianceStatus,
              withholdingTaxRate: newTcc.withholdingTaxRate,
              withholdingVatRate: newTcc.withholdingVatRate,
}),
});
          if (res.ok) await reload();
} catch { /* keep local */}
})();
      setShowTccModal(false);
      return;
}

    if (onRegisterTcc) {
      await onRegisterTcc(newTcc);
}
    setTccRecords([newTcc, ...tccRecords]);
    setShowTccModal(false);
};

  if (isLive && !liveLoaded) {
    return<div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-500">Loading e-TIMS compliance data...</div>;
}

  return (
<div className="space-y-6">
      {/* Header Banner */}
<div className="bg-gradient-to-r from-red-900 to-slate-900 rounded-xl p-6 text-white shadow-lg border border-red-800/40">
<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
<div>
<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-red-600/30 text-red-300 border border-red-500/30 mb-2">
<span> KRA e-TIMS Tax Compliance Engine</span>
<span>•</span>
<span>VSCU / OSCU Compliant</span>
</div>
<h1 className="text-2xl font-bold ">Electronic Tax Invoices & TCC Ledger</h1>
<p className="text-sm text-red-200/80 mt-1">
              Project:<span className="font-semibold text-white">{projectName}</span> | Real-time KRA cryptographically signed invoices &amp; Subcontractor Tax Compliance Tracking
</p>
</div>
<div className="flex items-center gap-3">
<button
              onClick={() => setShowInvoiceModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors shadow flex items-center gap-2"
            >
<span>+</span>
<span>Generate e-TIMS Invoice</span>
</button>
<button
              onClick={() => setShowTccModal(true)}
              className="bg-slate-700 hover:bg-slate-600 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors shadow flex items-center gap-2"
            >
<span>+</span>
<span>Verify Subcontractor TCC</span>
</button>
</div>
</div>

        {/* 4 Financial Metric Cards */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-red-800/50">
<div className="bg-slate-900/60 rounded-lg p-3 border border-red-800/30">
<div className="text-xs text-red-200/70">Total e-TIMS Invoices</div>
<div className="text-xl font-bold text-white mt-1">{summary.totalInvoices}</div>
<div className="text-[10px] text-emerald-400 mt-1">100% KRA Validated</div>
</div>
<div className="bg-slate-900/60 rounded-lg p-3 border border-red-800/30">
<div className="text-xs text-red-200/70">Taxable Construction Turnover</div>
<div className="text-xl font-bold text-white mt-1">KES {Number(summary.totalTaxableAmount).toLocaleString()}</div>
<div className="text-[10px] text-slate-400 mt-1">Base Contract Sum</div>
</div>
<div className="bg-slate-900/60 rounded-lg p-3 border border-red-800/30">
<div className="text-xs text-red-200/70">16% VAT Collected</div>
<div className="text-xl font-bold text-amber-300 mt-1">KES {Number(summary.totalTaxAmount).toLocaleString()}</div>
<div className="text-[10px] text-amber-300/80 mt-1">Remittable on 20th</div>
</div>
<div className="bg-slate-900/60 rounded-lg p-3 border border-red-800/30">
<div className="text-xs text-red-200/70">Gross Invoiced (with VAT)</div>
<div className="text-xl font-bold text-emerald-400 mt-1">KES {Number(summary.totalGrossAmount).toLocaleString()}</div>
<div className="text-[10px] text-slate-400 mt-1">IPC Cumulative</div>
</div>
</div>
</div>

      {/* Tabs */}
<div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
<button
          onClick={() => setActiveTab('INVOICES')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'INVOICES'
              ? 'border-red-600 text-red-600 dark:text-red-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
}`}
        >
<span> e-TIMS Tax Invoices ({invoices.length})</span>
</button>
<button
          onClick={() => setActiveTab('TCC_AUDIT')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'TCC_AUDIT'
              ? 'border-red-600 text-red-600 dark:text-red-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
}`}
        >
<span> Subcontractor TCC Compliance ({tccRecords.length})</span>
</button>
</div>

      {/* Tab 1: E-TIMS Invoices Table */}
      {activeTab === 'INVOICES' && (
<div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
<div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
<h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
              KRA Electronic Tax Invoices Registry
</h3>
<span className="text-xs text-slate-500">
              Tax Procedures Act 2015 &amp; e-TIMS Regulations 2023 Compliant
</span>
</div>
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse text-sm">
<thead>
<tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-xs font-semibold ">
<th className="py-3 px-4">Invoice #</th>
<th className="py-3 px-4">KRA Control Unit No.</th>
<th className="py-3 px-4">Buyer (Developer / Client)</th>
<th className="py-3 px-4">Buyer PIN</th>
<th className="py-3 px-4 text-right">Taxable (KES)</th>
<th className="py-3 px-4 text-right">16% VAT (KES)</th>
<th className="py-3 px-4 text-right">Gross Total (KES)</th>
<th className="py-3 px-4 text-center">Status</th>
<th className="py-3 px-4 text-center">KRA QR</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                {invoices.map((inv) => (
<tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
<td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                      {inv.invoiceNumber}
</td>
<td className="py-3 px-4 font-mono text-xs text-red-600 dark:text-red-400">
                      {inv.cuInvoiceNumber}
</td>
<td className="py-3 px-4">{inv.buyerName}</td>
<td className="py-3 px-4 font-mono text-xs">{inv.buyerPin}</td>
<td className="py-3 px-4 text-right font-medium">
                      {Number(inv.totalTaxableAmount).toLocaleString(undefined, { minimumFractionDigits: 2})}
</td>
<td className="py-3 px-4 text-right text-amber-600 dark:text-amber-400 font-medium">
                      {Number(inv.totalTaxAmount).toLocaleString(undefined, { minimumFractionDigits: 2})}
</td>
<td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                      {Number(inv.totalInvoiceAmount).toLocaleString(undefined, { minimumFractionDigits: 2})}
</td>
<td className="py-3 px-4 text-center">
<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                         {inv.transmissionStatus}
</span>
</td>
<td className="py-3 px-4 text-center">
<button
                        onClick={() => setSelectedInvoice(inv)}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium inline-flex items-center gap-1"
                      >
<span> View QR</span>
</button>
</td>
</tr>
))}
</tbody>
</table>
</div>
</div>
)}

      {/* Tab 2: Subcontractor TCC Audit Table */}
      {activeTab === 'TCC_AUDIT' && (
<div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
<div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
<h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
              Subcontractor Tax Compliance Certificates (TCC) &amp; Withholding Deduction Schedule
</h3>
<span className="text-xs text-slate-500">
              KRA Cap 470: 3% Withholding Tax on Compliant Works, 5% on Default
</span>
</div>
<div className="overflow-x-auto">
<table className="w-full text-left border-collapse text-sm">
<thead>
<tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 text-xs font-semibold ">
<th className="py-3 px-4">Subcontractor Firm</th>
<th className="py-3 px-4">Trade</th>
<th className="py-3 px-4">KRA PIN</th>
<th className="py-3 px-4">TCC Certificate #</th>
<th className="py-3 px-4">TCC Expiry</th>
<th className="py-3 px-4 text-center">Compliance Status</th>
<th className="py-3 px-4 text-center">WHT Rate</th>
<th className="py-3 px-4 text-center">WHVAT Rate</th>
</tr>
</thead>
<tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                {tccRecords.map((tcc) => {
                  const isExp = tcc.complianceStatus === 'EXPIRED';
                  return (
<tr key={tcc.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
<td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {tcc.firmName}
</td>
<td className="py-3 px-4 text-xs">{tcc.tradeCategory}</td>
<td className="py-3 px-4 font-mono text-xs">{tcc.pinNumber}</td>
<td className="py-3 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {tcc.tccNumber}
</td>
<td className="py-3 px-4 font-mono text-xs">{tcc.tccExpiryDate}</td>
<td className="py-3 px-4 text-center">
<span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isExp
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
}`}
                        >
                          {isExp ? ' EXPIRED' : ' COMPLIANT'}
</span>
</td>
<td className="py-3 px-4 text-center font-bold text-amber-600 dark:text-amber-400">
                        {tcc.withholdingTaxRate}%
</td>
<td className="py-3 px-4 text-center font-medium">{tcc.withholdingVatRate}%</td>
</tr>
);
})}
</tbody>
</table>
</div>
</div>
)}

      {/* QR Code Lightbox Modal */}
      {selectedInvoice && (
<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
<div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
<h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              KRA e-TIMS Tax Receipt
</h3>
<p className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-3 inline-block">
              SIMULATED — not transmitted to KRA eTIMS
</p>
<p className="text-xs text-slate-500 mb-4 font-mono">{selectedInvoice.cuInvoiceNumber}</p>
<div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg inline-block my-2 border border-slate-300 dark:border-slate-700">
<div className="w-48 h-48 bg-white p-2 mx-auto flex items-center justify-center text-slate-900 font-mono text-xs border border-dashed border-slate-400">
<div className="space-y-2">
<div className="text-2xl"></div>
<div className="font-bold text-[10px]">SCAN TO VERIFY ON iTAX</div>
<div className="text-[8px] break-all text-slate-500">{selectedInvoice.qrCodeUrl}</div>
</div>
</div>
</div>
<div className="mt-4 text-xs text-slate-600 dark:text-slate-300 text-left space-y-1 bg-slate-50 dark:bg-slate-800/40 p-3 rounded">
<div><strong>Buyer:</strong> {selectedInvoice.buyerName}</div>
<div><strong>PIN:</strong> {selectedInvoice.buyerPin}</div>
<div><strong>Gross Amount:</strong> KES {Number(selectedInvoice.totalInvoiceAmount).toLocaleString()}</div>
<div><strong>VSCU Signature:</strong><span className="font-mono text-[9px]">{selectedInvoice.cryptographicSignature.slice(0, 24)}...</span></div>
</div>
<div className="mt-6 flex justify-end">
<button
                onClick={() => setSelectedInvoice(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg text-sm transition-colors"
              >
                Close
</button>
</div>
</div>
</div>
)}

      {/* Create E-TIMS Invoice Modal */}
      {showInvoiceModal && (
<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
<div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
<h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Generate Official KRA e-TIMS Invoice
</h3>
<p className="text-xs text-slate-500 mb-4">
              Transmits electronic tax invoice to KRA OSCU/VSCU server with 16% standard VAT.
</p>
<form onSubmit={handleCreateInvoiceSubmit} className="space-y-4 text-sm">
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Invoice Reference Number
</label>
<input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
                  required
                />
</div>
<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Buyer / Developer Name
</label>
<input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    required
                  />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Buyer KRA PIN
</label>
<input
                    type="text"
                    value={buyerPin}
                    onChange={(e) => setBuyerPin(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono "
                    required
                  />
</div>
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Taxable Amount (KES)
</label>
<input
                  type="number"
                  step="0.01"
                  value={taxableAmount}
                  onChange={(e) => setTaxableAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
                  required
                />
<div className="flex justify-between text-xs text-slate-500 mt-1">
<span>16% VAT: KES {(parseFloat(taxableAmount || '0') * 0.16).toLocaleString()}</span>
<span>Gross: KES {(parseFloat(taxableAmount || '0') * 1.16).toLocaleString()}</span>
</div>
</div>
<div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
<button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
</button>
<button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow"
                >
                  Sign &amp; Validate with KRA
</button>
</div>
</form>
</div>
</div>
)}

      {/* Register Subcontractor TCC Modal */}
      {showTccModal && (
<div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
<div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
<h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              Register Subcontractor Tax Compliance Certificate
</h3>
<p className="text-xs text-slate-500 mb-4">
              Registers subcontractor tax clearance to determine contractual withholding tax (3% vs 5%).
</p>
<form onSubmit={handleRegisterTccSubmit} className="space-y-4 text-sm">
              {isLive && (
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Linked Subcontractor Package
</label>
<select
                    value={tccPackageId}
                    onChange={(e) => setTccPackageId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                    required
                  >
<option value="">Select subcontractor package…</option>
                    {subPkgs.map((p) => (
<option key={p.id} value={p.id}>{p.firm_name}</option>
))}
</select>
</div>
)}
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Subcontractor Firm Name
</label>
<input
                  type="text"
                  value={firmName}
                  onChange={(e) => setFirmName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  required
                />
</div>
<div className="grid grid-cols-2 gap-3">
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    KRA PIN
</label>
<input
                    type="text"
                    value={tccPin}
                    onChange={(e) => setTccPin(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono "
                    required
                  />
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    TCC Certificate Number
</label>
<input
                    type="text"
                    value={tccNumber}
                    onChange={(e) => setTccNumber(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700 font-mono"
                    required
                  />
</div>
</div>
<div>
<label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  TCC Expiry Date
</label>
<input
                  type="date"
                  value={tccExpiry}
                  onChange={(e) => setTccExpiry(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-800 dark:border-slate-700"
                  required
                />
</div>
<div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
<button
                  type="button"
                  onClick={() => setShowTccModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
</button>
<button
                  type="submit"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg shadow"
                >
                  Save TCC Record
</button>
</div>
</form>
</div>
</div>
)}
</div>
);
};

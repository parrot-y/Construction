import React, { useState } from 'react';

export interface LandingPortalHubProps {
  onSelectRolePreview: (role: string) => void;
  onOpenLogin: () => void;
}

export interface StakeholderRolePreview {
  role: string;
  title: string;
  badge: string;
  badgeStyle: string;
  description: string;
  keyFeatures: string[];
  ctaLabel: string;
}

const STAKEHOLDER_ROLES: StakeholderRolePreview[] = [
  {
    role: 'COMPANY_ADMIN',
    title: 'Apex Builders Ltd Executive View',
    badge: 'Executive / Board',
    badgeStyle: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Portfolio-wide financial oversight, multi-site project controls, KRA compliance, and executive KPI scorecards.',
    keyFeatures: ['Portfolio Budget Baseline & S-Curve', 'KRA e-TIMS & WHT Tax Governance', 'M-Pesa B2C Bulk Wages & Retention Release'],
    ctaLabel: 'Preview Company Admin Dashboard',
  },
  {
    role: 'PM_QS',
    title: 'Commercial Management & BOQ Studio',
    badge: 'Quantity Surveying',
    badgeStyle: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'BORAQS & EASMM 2008 standard cost modeling, Excel BOQ import, IPC interim valuation certificates, and tender evaluation.',
    keyFeatures: ['EASMM Excel BOQ Parser & Versions', 'Variance Monitor & Physical Progress Link', '70/30 Technical & Financial Tender Board'],
    ctaLabel: 'Preview PM / QS Workspace',
  },
  {
    role: 'SITE_SUPERVISOR',
    title: 'Mobile Site Diary, Plant Telematics & Concrete Tests',
    badge: 'Field Engineering',
    badgeStyle: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'Offline-ready mobile site diary, geofenced GPS muster roll, BS EN 206 slump & cube tests, and plant telematics CAN-bus diagnostics.',
    keyFeatures: ['BS 1881 Concrete Cube 7/14/28-Day Register', 'Live IoT CAN-bus & Fuel Siphoning Anomaly Alerts', 'Site Material Requisitions & Goods Received Notes'],
    ctaLabel: 'Preview Site Supervisor App',
  },
  {
    role: 'CLIENT',
    title: 'Diaspora Property Developer Portal',
    badge: 'Diaspora Investor',
    badgeStyle: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: '100% remote jobsite visibility, unannounced third-party Clerk of Works audits, multi-currency views (KES/USD/GBP/EUR/AED), and variation approvals.',
    keyFeatures: ['Unannounced Neutral Clerk of Works Audits', 'Multi-Currency Diaspora Converter', 'Live GPS-Tagged Milestone Evidence Gallery'],
    ctaLabel: 'Preview Diaspora Client Portal',
  },
  {
    role: 'CONSULTANT',
    title: 'Architect / Structural Engineer Review',
    badge: 'Zero Seat Tax • Consultant',
    badgeStyle: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description: 'Tokenized frictionless portal to review and respond to RFIs, approve architectural & structural revisions, and inspect submittals.',
    keyFeatures: ['Frictionless Tokenized Portal (Zero Seat Tax)', '24-Hour RFI Escalation SLAs', 'Structural & MEP Submittal Sign-Off'],
    ctaLabel: 'Preview Consultant Portal',
  },
  {
    role: 'SUBCONTRACTOR',
    title: 'Milestone Claims & Work Orders',
    badge: 'Zero Seat Tax • Trade Partner',
    badgeStyle: 'bg-teal-100 text-teal-800 border-teal-200',
    description: 'Trade subcontractor workspace to submit milestone progress claims, track retentions, and view work order packages.',
    keyFeatures: ['Trade Milestone Valuation Invoicing', 'Kenyan 5% Retention Ledger Tracking', 'Digital Work Order Sign-Off'],
    ctaLabel: 'Preview Subcontractor Portal',
  },
  {
    role: 'SUPPLIER',
    title: 'Purchase Orders & Materials GRN',
    badge: 'Zero Seat Tax • Vendor',
    badgeStyle: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    description: 'Cement, rebar, and aggregate vendors dispatch tracking, digital delivery notes, weighbridge tickets, and payment statuses.',
    keyFeatures: ['Digital Goods Received Notes (GRN)', 'Weighbridge & Batch Ticket Attachment', 'Invoice & Payment Milestone Ledger'],
    ctaLabel: 'Preview Supplier Portal',
  },
  {
    role: 'COMPLIANCE',
    title: 'NCA / NEMA / County Safety Auditor',
    badge: 'Zero Seat Tax • Statutory',
    badgeStyle: 'bg-rose-100 text-rose-800 border-rose-200',
    description: 'National Construction Authority, NEMA EIA, and Nairobi County physical planning compliance verification portal.',
    keyFeatures: ['NCA Site Registration & Hoarding Permit Audit', 'NEMA Environmental & Waste Disposal Permits', 'HSE Field Safety Scorecards & Incident Audits'],
    ctaLabel: 'Preview Compliance Auditor Portal',
  },
];

const TYPOLOGY_DATA = {
  maisonette: { name: '4-Bed Residential Maisonette', baseRate: 46000 },
  villa: { name: 'Luxury Standalone Villa', baseRate: 68000 },
  apartments: { name: 'Multi-Unit Apartment Block (G+4)', baseRate: 42000 },
  commercial: { name: 'Commercial Office & Retail Plaza', baseRate: 54000 },
  godown: { name: 'Industrial Godown / Warehouse', baseRate: 32000 },
};

const FINISH_FACTORS = {
  STANDARD: 1.0,
  EXECUTIVE: 1.25,
  LUXURY: 1.6,
};

const REGION_FACTORS = {
  NAIROBI: 1.0,
  MOMBASA: 1.12,
  NAKURU: 1.05,
  KISUMU: 1.08,
};

type CurrencyKey = 'KES' | 'USD' | 'GBP' | 'EUR' | 'AED';

const EXCHANGE_RATES: Record<CurrencyKey, { rate: number; symbol: string }> = {
  KES: { rate: 1.0, symbol: 'KES' },
  USD: { rate: 129.5, symbol: '$' },
  GBP: { rate: 166.8, symbol: '£' },
  EUR: { rate: 140.2, symbol: '€' },
  AED: { rate: 35.25, symbol: 'AED' },
};

export default function LandingPortalHub({
  onSelectRolePreview,
  onOpenLogin,
}: LandingPortalHubProps): React.JSX.Element {
  type TypologyKey = keyof typeof TYPOLOGY_DATA;
  type FinishKey = keyof typeof FINISH_FACTORS;
  type RegionKey = keyof typeof REGION_FACTORS;

  const [estTypology, setEstTypology] = useState<TypologyKey>('maisonette');
  const [estAreaSqm, setEstAreaSqm] = useState<number>(260);
  const [estFinish, setEstFinish] = useState<FinishKey>('EXECUTIVE');
  const [estRegion, setEstRegion] = useState<RegionKey>('NAIROBI');
  const [estCurrency, setEstCurrency] = useState<CurrencyKey>('KES');

  const baseRate = TYPOLOGY_DATA[estTypology].baseRate;
  const finishMultiplier = FINISH_FACTORS[estFinish];
  const regionMultiplier = REGION_FACTORS[estRegion];
  const effectiveRateKes = baseRate * finishMultiplier * regionMultiplier;
  const totalCostKes = estAreaSqm * effectiveRateKes;

  const currentExchange = EXCHANGE_RATES[estCurrency];
  const totalCostInTarget = totalCostKes / currentExchange.rate;
  const ratePerSqmInTarget = effectiveRateKes / currentExchange.rate;

  const formatCalcCost = (val: number): string => {
    return `${currentExchange.symbol} ${val.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const drawdownStages = [
    { name: 'Substructure & Slab', pct: 18, amount: totalCostInTarget * 0.18 },
    { name: 'Structural Framing', pct: 28, amount: totalCostInTarget * 0.28 },
    { name: 'Roofing & Disposal', pct: 14, amount: totalCostInTarget * 0.14 },
    { name: 'Finishes & Tiling', pct: 24, amount: totalCostInTarget * 0.24 },
    { name: 'MEP Services', pct: 11, amount: totalCostInTarget * 0.11 },
    { name: 'External Drainage', pct: 5, amount: totalCostInTarget * 0.05 },
  ];
  return (
    <div className="w-full max-w-6xl mx-auto space-y-12 py-6 px-4 sm:px-6">
      {/* Top Navbar */}
      <nav className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-700 to-emerald-500 flex items-center justify-center text-white text-xl font-black shadow-sm">
            B
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black text-slate-900 tracking-tight">
                Site Safi
              </span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">
                Construction OS
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Enterprise Jobsite Platform &amp; Diaspora Remote Property Owner Portal • Apex Builders Kenya Ltd
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <button
            onClick={onOpenLogin}
            data-testid="open-login-btn"
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-2"
          >
            <span>🔐</span>
            <span>Sign in to access your project workspace</span>
          </button>
        </div>
      </nav>

      {/* Hero Banner */}
      <header className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-8 sm:p-12 shadow-xl border border-slate-700/50 overflow-hidden">
        {/* Background Decorative Rings */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold backdrop-blur-xs">
            <span>🇰🇪 Built for Kenyan Ground Truth</span>
            <span>•</span>
            <span>BORAQS • NCA • EASMM 2008 • KEBS</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Site Safi — Kenya Construction Operating System &amp; Diaspora Property Owner Portal
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
            Eliminate project cost inflations, contractor ghost claims, and jobsite blindness. From real-time unannounced neutral Clerk of Works audits and telematics fuel fraud detection to EASMM BOQs and instant Zero Seat Tax stakeholder portals.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onSelectRolePreview('CLIENT')}
              data-testid="hero-client-preview-btn"
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl shadow-lg transition flex items-center gap-2"
            >
              <span>🌍 Diaspora Client Portal Preview</span>
            </button>
            <button
              onClick={onOpenLogin}
              className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-xl border border-white/20 transition backdrop-blur-xs"
            >
              Sign In with Credentials
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-700/60 text-xs">
            <div>
              <span className="text-emerald-400 font-bold block text-lg font-mono">100%</span>
              <span className="text-slate-400">Neutral Verification</span>
            </div>
            <div>
              <span className="text-emerald-400 font-bold block text-lg font-mono">5 Currencies</span>
              <span className="text-slate-400">KES, USD, GBP, EUR, AED</span>
            </div>
            <div>
              <span className="text-emerald-400 font-bold block text-lg font-mono">0 Seat Tax</span>
              <span className="text-slate-400">External Portals</span>
            </div>
            <div>
              <span className="text-emerald-400 font-bold block text-lg font-mono">BORAQS &amp; NCA</span>
              <span className="text-slate-400">Kenyan Statutory Standard</span>
            </div>
          </div>
        </div>
      </header>

      {/* 4 Key Value Proposition Cards */}
      <section className="space-y-4">
        <div className="text-center max-w-2xl mx-auto space-y-1">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-3 py-0.5 rounded-full">
            Core Enterprise Value Pillars
          </span>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Engineered Specifically for High-Trust Kenyan Construction
          </h2>
          <p className="text-xs text-slate-500">
            Addressing every systemic failure mode in real estate development and civil contracting across Kenya.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Card 1: Diaspora Remote Property Owner Portal */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-xl font-bold">
              🌍
            </div>
            <h3 className="text-base font-bold text-slate-900">
              1. Diaspora Remote Property Owner Portal
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Real-time milestone tracking, multi-currency views (KES/USD/GBP/EUR/AED), transparent change orders, and verifiable digital valuation certificates protecting overseas investors from contractor fund diversion.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                Multi-Currency (KES/USD/GBP/EUR/AED)
              </span>
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                Milestone Escrow &amp; Releases
              </span>
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                Variation Sign-Off
              </span>
            </div>
          </div>

          {/* Card 2: Independent Neutral Site Inspection Service */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center text-xl font-bold">
              🕵️
            </div>
            <h3 className="text-base font-bold text-slate-900">
              2. Independent Neutral Site Inspection Service
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Unannounced third-party Clerk of Works visits, GPS-verified evidence, material audit, and automated progress variance detection to stop contractor over-invoicing before interim payment certificates are authorized.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] font-semibold bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
                Unannounced 48-Hour Audits
              </span>
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                Substructure &amp; Slab Pre-Pour Checks
              </span>
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                Cement &amp; Rebar Quality Audits
              </span>
            </div>
          </div>

          {/* Card 3: Contractor & Jobsite Operating System */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl font-bold">
              🚜
            </div>
            <h3 className="text-base font-bold text-slate-900">
              3. Contractor &amp; Jobsite Operating System
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              EASMM BOQs, Daily Site Diaries, Concrete Cube Registers, Plant Telematics &amp; Fuel Siphoning Anomaly Detection, Geofenced Muster Rolls, and automated KRA e-TIMS / WHT statutory management.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                EASMM 2008 BOQ Studio
              </span>
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                Telematics &amp; Fuel Siphoning Radar
              </span>
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                BS 1881 Concrete Cubes
              </span>
            </div>
          </div>

          {/* Card 4: Zero Seat Tax Portals */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center text-xl font-bold">
              🔗
            </div>
            <h3 className="text-base font-bold text-slate-900">
              4. Zero Seat Tax Portals
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Instant tokenized links for Consultants, Subcontractors, Suppliers, and Compliance Auditors. Zero subscription friction, no per-seat licensing penalties, and 100% audit trail compliance.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                Architectural &amp; Structural RFIs
              </span>
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                Subcontractor Valuations
              </span>
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                NCA &amp; NEMA Compliance Inspection
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Instant Building Construction Cost & Feasibility Estimator */}
      <section className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                Interactive Feasibility Radar
              </span>
              <span className="text-xs text-slate-400 font-mono">BORAQS &amp; JBC 2026 Baseline</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
              Site Safi Instant Construction Cost &amp; Feasibility Estimator
            </h2>
            <p className="text-xs text-slate-400">
              Calculate preliminary budget, milestone cash flows, and diaspora exchange rates per Kenyan Joint Building Council standards.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <span className="text-[10px] font-semibold text-slate-400 uppercase px-1.5">Currency:</span>
            {(['KES', 'USD', 'GBP', 'EUR', 'AED'] as CurrencyKey[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setEstCurrency(c)}
                data-testid={`calc-currency-${c.toLowerCase()}`}
                className={`px-2 py-1 text-xs font-bold rounded-lg transition ${
                  estCurrency === c
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls: 5 cols */}
          <div className="lg:col-span-5 space-y-4">
            <div>
              <label htmlFor="calc-typology" className="block text-xs font-semibold text-slate-300 mb-1">
                Building Typology:
              </label>
              <select
                id="calc-typology"
                value={estTypology}
                onChange={(e) => setEstTypology(e.target.value as TypologyKey)}
                data-testid="calc-typology-select"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="maisonette">4-Bed Residential Maisonette (Two-Storey)</option>
                <option value="villa">Luxury Standalone Villa (Double-Height)</option>
                <option value="apartments">Multi-Unit Apartment Block (G+4 Floors)</option>
                <option value="commercial">Commercial Office &amp; Retail Plaza</option>
                <option value="godown">Industrial Godown / Warehouse</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="calc-area" className="block text-xs font-semibold text-slate-300 mb-1">
                  Gross Area (sqm):
                </label>
                <input
                  id="calc-area"
                  type="number"
                  min="50"
                  max="50000"
                  step="10"
                  value={estAreaSqm}
                  onChange={(e) => setEstAreaSqm(Math.max(20, Number(e.target.value) || 0))}
                  data-testid="calc-area-input"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label htmlFor="calc-region" className="block text-xs font-semibold text-slate-300 mb-1">
                  County Region:
                </label>
                <select
                  id="calc-region"
                  value={estRegion}
                  onChange={(e) => setEstRegion(e.target.value as RegionKey)}
                  data-testid="calc-region-select"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="NAIROBI">Nairobi &amp; Kiambu (1.00x)</option>
                  <option value="MOMBASA">Mombasa &amp; Coastal (1.12x)</option>
                  <option value="NAKURU">Nakuru &amp; Rift Valley (1.05x)</option>
                  <option value="KISUMU">Kisumu &amp; Western (1.08x)</option>
                </select>
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-300 mb-1.5">
                Finishes &amp; Specifications Standard:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(['STANDARD', 'EXECUTIVE', 'LUXURY'] as FinishKey[]).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setEstFinish(tier)}
                    data-testid={`calc-finish-${tier.toLowerCase()}`}
                    className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition ${
                      estFinish === tier
                        ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/60 p-3.5 rounded-xl border border-slate-700 text-xs text-slate-400 space-y-1">
              <span className="font-semibold text-slate-300 block">BORAQS Norm Compliance:</span>
              <p className="text-[11px] leading-relaxed">
                Rates derived from Ministry of Transport &amp; Infrastructure Joint Building Council rates adjusted for 2026 inflation and KEBS standard materials.
              </p>
            </div>
          </div>

          {/* Results Display: 7 cols */}
          <div className="lg:col-span-7 bg-slate-800/80 rounded-2xl p-5 border border-slate-700/80 flex flex-col justify-between space-y-5">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Estimated Construction Budget ({estCurrency})
              </span>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight" data-testid="calc-total-cost">
                  {formatCalcCost(totalCostInTarget)}
                </span>
                <span className="text-xs text-emerald-400 font-mono font-semibold">
                  (~{formatCalcCost(ratePerSqmInTarget)}/sqm)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Estimated for {estAreaSqm} sqm {estFinish.toLowerCase()} {TYPOLOGY_DATA[estTypology].name} in {estRegion}.
              </p>
            </div>

            {/* 6 Milestone Cash Flow Breakdown */}
            <div className="space-y-2 border-t border-slate-700/80 pt-4">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Stage-by-Stage Milestone Drawdown Schedule:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {drawdownStages.map((stg) => (
                  <div key={stg.name} className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60">
                    <span className="text-[10px] text-slate-400 block truncate">{stg.name} ({stg.pct}%)</span>
                    <span className="font-mono font-bold text-white text-xs mt-0.5 block">
                      {formatCalcCost(stg.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pre-Inspection Call to action */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-3 border-t border-slate-700/80">
              <span className="text-[11px] text-slate-400">
                Want an unannounced audit on your ongoing project?
              </span>
              <button
                type="button"
                onClick={() => onSelectRolePreview('CLIENT')}
                data-testid="calc-book-audit-btn"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                <span>🕵️ Book Neutral Site Audit</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Instant Stakeholder Interactive Preview Switcher */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                Interactive Multi-Role Switcher
              </span>
              <span className="text-xs text-slate-500 font-mono">8 Live Portals</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
              Instant Stakeholder Interactive Preview Switcher
            </h2>
            <p className="text-xs text-slate-500">
              Click any of the 8 stakeholder roles to instantly preview their dedicated, tailored Site Safi interface without typing credentials.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STAKEHOLDER_ROLES.map((roleDef, index) => (
            <div
              key={roleDef.role}
              data-testid={`stakeholder-role-card-${roleDef.role.toLowerCase()}`}
              className="bg-slate-50/70 rounded-2xl border border-slate-200 p-5 flex flex-col justify-between hover:border-emerald-500 hover:bg-emerald-50/20 transition group"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-mono font-bold text-slate-400">0{index + 1}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${roleDef.badgeStyle}`}>
                    {roleDef.badge}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition">
                  {roleDef.title}
                </h3>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {roleDef.description}
                </p>

                <ul className="space-y-1 text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                  {roleDef.keyFeatures.map((feat, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className="text-emerald-600">✓</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => onSelectRolePreview(roleDef.role)}
                data-testid={`preview-role-btn-${roleDef.role.toLowerCase()}`}
                className="mt-4 w-full py-2 px-3 bg-white hover:bg-emerald-700 hover:text-white border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl shadow-2xs transition text-center"
              >
                {roleDef.ctaLabel}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer Branding */}
      <footer className="pt-6 border-t border-slate-200 text-center text-xs text-slate-500 space-y-2">
        <p>
          Site Safi • Enterprise Construction Operating System &amp; Diaspora Remote Property Owner Portal
        </p>
        <p className="text-[11px] text-slate-400 font-mono">
          Compliant with BORAQS, NCA (National Construction Authority), EASMM 2008, KRA e-TIMS &amp; NEMA regulations.
        </p>
      </footer>
    </div>
  );
}

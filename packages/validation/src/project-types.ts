/**
 * Project type taxonomy — the single shared config for contractor projects.
 * Used by the API (validation), the web console (wizard, filters, cards) and
 * the client-request flow. Keys are stable enum-style strings; labels are the
 * plain words shown to users.
 */

export interface ProjectSubtype {
  key: string;
  label: string;
}

export interface ProjectTypeCategory {
  key: string;
  label: string;
  /** NCA trades this category typically registers under (hint only — the
   *  authoritative class/value limits live in the editable nca_class_rules
   *  table, never hard-coded here). */
  ncaTrades: string[];
  subtypes: ProjectSubtype[];
  /** Starter content seeded on project creation — each list stays small and
   *  every row is an ordinary record the user can edit or delete. */
  starter: {
    boqSections: string[];
    milestones: { name: string; wbs: string }[];
    checklists: { title: string; trade: string }[];
  };
}

export const PROJECT_TYPE_CATEGORIES: ProjectTypeCategory[] = [
  {
    key: 'RESIDENTIAL',
    label: 'Residential',
    ncaTrades: ['Building'],
    subtypes: [
      { key: 'SINGLE_HOME', label: 'Single home / bungalow' },
      { key: 'APARTMENTS', label: 'Apartments / flats' },
      { key: 'GATED_ESTATE', label: 'Gated estate / multi-unit' },
      { key: 'HOSTEL', label: 'Hostel / bedsitter blocks' },
    ],
    starter: {
      boqSections: ['Site setup & excavation', 'Foundation & substructure', 'Superstructure', 'Roofing', 'Plumbing & drainage', 'Electrical', 'Plastering & screeding', 'Doors, windows & finishes', 'External works & fencing'],
      milestones: [
        { name: 'Foundations complete', wbs: 'SUBSTRUCTURE' },
        { name: 'Structure topped out', wbs: 'SUPERSTRUCTURE' },
        { name: 'Roofing & waterproofing', wbs: 'ROOFING' },
        { name: 'MEP first fix', wbs: 'SERVICES' },
        { name: 'Plastering & finishes', wbs: 'FINISHES' },
        { name: 'Handing over', wbs: 'EXTERNAL_WORKS' },
      ],
      checklists: [
        { title: 'Pre-pour inspection — foundations', trade: 'Structural' },
        { title: 'Rebar check — superstructure', trade: 'Structural' },
        { title: 'Waterproofing test — wet areas', trade: 'Waterproofing' },
        { title: 'Pre-handover snag walk', trade: 'Quality' },
      ],
    },
  },
  {
    key: 'COMMERCIAL',
    label: 'Commercial',
    ncaTrades: ['Building'],
    subtypes: [
      { key: 'OFFICES', label: 'Offices' },
      { key: 'RETAIL', label: 'Retail / shopping centre' },
      { key: 'HOTEL_FNB', label: 'Hotel / restaurant' },
      { key: 'MIXED_USE', label: 'Mixed use' },
    ],
    starter: {
      boqSections: ['Site establishment', 'Substructure & piling', 'Superstructure frame', 'Building envelope & cladding', 'MEP services', 'Fit-out & finishes', 'External works & landscaping'],
      milestones: [
        { name: 'Substructure complete', wbs: 'SUBSTRUCTURE' },
        { name: 'Frame & envelope closed', wbs: 'SUPERSTRUCTURE' },
        { name: 'MEP services complete', wbs: 'SERVICES' },
        { name: 'Fit-out complete', wbs: 'FINISHES' },
        { name: 'Practical completion', wbs: 'EXTERNAL_WORKS' },
      ],
      checklists: [
        { title: 'Piling / foundation inspection', trade: 'Structural' },
        { title: 'Envelope watertightness check', trade: 'Quality' },
        { title: 'Fire & life-safety services check', trade: 'Safety' },
        { title: 'Pre-handover inspection', trade: 'Quality' },
      ],
    },
  },
  {
    key: 'INDUSTRIAL',
    label: 'Industrial',
    ncaTrades: ['Building', 'Mechanical'],
    subtypes: [
      { key: 'WAREHOUSE', label: 'Warehouse' },
      { key: 'FACTORY', label: 'Factory / production plant' },
      { key: 'COLD_ROOM', label: 'Cold room / cold store' },
    ],
    starter: {
      boqSections: ['Site works & hardstanding', 'Substructure', 'Steel frame & cladding', 'Process services (power, compressed air)', 'Cold-chain insulation where applicable', 'Office & welfare block', 'External works'],
      milestones: [
        { name: 'Hardstanding & drainage', wbs: 'EXTERNAL_WORKS' },
        { name: 'Frame & cladding', wbs: 'SUPERSTRUCTURE' },
        { name: 'Process services first fix', wbs: 'SERVICES' },
        { name: 'Commissioning support', wbs: 'FINISHES' },
      ],
      checklists: [
        { title: 'Pre-pour inspection — hardstanding', trade: 'Structural' },
        { title: 'Cladding fixings check', trade: 'Quality' },
        { title: 'Process services inspection', trade: 'MEP' },
        { title: 'Handover snag walk', trade: 'Quality' },
      ],
    },
  },
  {
    key: 'INSTITUTIONAL',
    label: 'Institutional and public',
    ncaTrades: ['Building'],
    subtypes: [
      { key: 'SCHOOL', label: 'School / college' },
      { key: 'HOSPITAL', label: 'Hospital / clinic' },
      { key: 'PLACE_OF_WORSHIP', label: 'Church / mosque' },
      { key: 'GOVERNMENT', label: 'Government building' },
    ],
    starter: {
      boqSections: ['Site establishment', 'Substructure', 'Superstructure', 'Roofing & envelope', 'MEP services', 'Specialist fit-out (labs, theatre, AV)', 'External works & accessibility'],
      milestones: [
        { name: 'Substructure complete', wbs: 'SUBSTRUCTURE' },
        { name: 'Frame topped out', wbs: 'SUPERSTRUCTURE' },
        { name: 'Envelope closed', wbs: 'ROOFING' },
        { name: 'Specialist services', wbs: 'SERVICES' },
        { name: 'Handover & defect period start', wbs: 'FINISHES' },
      ],
      checklists: [
        { title: 'Pre-pour inspection', trade: 'Structural' },
        { title: 'Accessibility compliance check', trade: 'Quality' },
        { title: 'Fire & evacuation check', trade: 'Safety' },
        { title: 'Pre-handover inspection', trade: 'Quality' },
      ],
    },
  },
  {
    key: 'CIVIL',
    label: 'Civil and infrastructure',
    ncaTrades: ['Roads and earthworks', 'Water'],
    subtypes: [
      { key: 'ROADS', label: 'Roads and earthworks' },
      { key: 'BRIDGES_DRAINAGE', label: 'Bridges and drainage' },
      { key: 'WATER_SEWERAGE', label: 'Water and sewerage' },
    ],
    starter: {
      boqSections: ['Site establishment & access', 'Earthworks & drainage', 'Sub-base & pavement', 'Structures (culverts / bridges)', 'Water / sewer pipelines', 'Reinstatement & landscaping'],
      milestones: [
        { name: 'Earthworks complete', wbs: 'SUBSTRUCTURE' },
        { name: 'Drainage & pipelines laid', wbs: 'SERVICES' },
        { name: 'Pavement / structures', wbs: 'SUPERSTRUCTURE' },
        { name: 'Reinstatement complete', wbs: 'EXTERNAL_WORKS' },
      ],
      checklists: [
        { title: 'Material testing — sub-base', trade: 'Materials' },
        { title: 'Pipe bedding & backfill check', trade: 'Quality' },
        { title: 'Compaction test sign-off', trade: 'Quality' },
        { title: 'Handover inspection', trade: 'Quality' },
      ],
    },
  },
  {
    key: 'SPECIALIST',
    label: 'Specialist',
    ncaTrades: ['Electrical', 'Mechanical'],
    subtypes: [
      { key: 'ELECTRICAL', label: 'Electrical' },
      { key: 'MECHANICAL', label: 'Mechanical / HVAC' },
      { key: 'SOLAR_ENERGY', label: 'Solar / energy' },
    ],
    starter: {
      boqSections: ['Mobilisation & site setup', 'Supply of materials', 'First fix installation', 'Second fix & termination', 'Testing & commissioning'],
      milestones: [
        { name: 'Materials on site', wbs: 'SUBSTRUCTURE' },
        { name: 'First fix complete', wbs: 'SERVICES' },
        { name: 'Second fix complete', wbs: 'FINISHES' },
        { name: 'Testing & handover', wbs: 'EXTERNAL_WORKS' },
      ],
      checklists: [
        { title: 'Pre-energisation inspection', trade: 'Electrical' },
        { title: 'Pressure / continuity test records', trade: 'Quality' },
        { title: 'Commissioning checklist', trade: 'MEP' },
        { title: 'Handover documentation check', trade: 'Quality' },
      ],
    },
  },
  {
    key: 'RENOVATION',
    label: 'Renovation and fit-out',
    ncaTrades: ['Building'],
    subtypes: [
      { key: 'FIT_OUT', label: 'Fit-out / refurbishment' },
      { key: 'EXTENSION', label: 'Extension / alteration' },
      { key: 'INTERIORS', label: 'Interior finishes' },
    ],
    starter: {
      boqSections: ['Protection & set-up', 'Strip-out / enabling works', 'Structure alterations', 'Services (electrical, plumbing)', 'Finishes & joinery', 'Reinstatement & cleaning'],
      milestones: [
        { name: 'Enabling works complete', wbs: 'SUBSTRUCTURE' },
        { name: 'Services first fix', wbs: 'SERVICES' },
        { name: 'Finishes complete', wbs: 'FINISHES' },
        { name: 'Handover', wbs: 'EXTERNAL_WORKS' },
      ],
      checklists: [
        { title: 'Protection of existing works check', trade: 'Quality' },
        { title: 'Services isolation check', trade: 'Safety' },
        { title: 'Snag & touch-up list', trade: 'Quality' },
        { title: 'Handover walk-through', trade: 'Quality' },
      ],
    },
  },
  {
    key: 'OTHER',
    label: 'Other',
    ncaTrades: ['Building'],
    subtypes: [
      { key: 'OTHER', label: 'Other / not listed' },
    ],
    starter: {
      boqSections: ['General works'],
      milestones: [{ name: 'Project kickoff', wbs: 'SUBSTRUCTURE' }],
      checklists: [{ title: 'Kickoff inspection', trade: 'Quality' }],
    },
  },
];

export const PROJECT_TYPE_KEYS = PROJECT_TYPE_CATEGORIES.map((c) => c.key) as [string, ...string[]];

const CATEGORY_BY_KEY = new Map(PROJECT_TYPE_CATEGORIES.map((c) => [c.key, c]));
const SUBTYPE_KEYS = new Set(
  PROJECT_TYPE_CATEGORIES.flatMap((c) => c.subtypes.map((s) => s.key)),
);

export function projectTypeCategory(key: string | null | undefined): ProjectTypeCategory | undefined {
  return key ? CATEGORY_BY_KEY.get(key) : undefined;
}

export function isValidProjectSubtype(subtype: string): boolean {
  return SUBTYPE_KEYS.has(subtype);
}

export function subtypeBelongsToType(typeKey: string, subtypeKey: string): boolean {
  return CATEGORY_BY_KEY.get(typeKey)?.subtypes.some((s) => s.key === subtypeKey) ?? false;
}

/** NCA trade names used to seed the editable nca_class_rules table. Limits
 *  themselves live in the DB — these are only the trade labels. */
export const NCA_TRADES = ['Building', 'Roads and earthworks', 'Water', 'Electrical', 'Mechanical'] as const;

export const NCA_CLASS_LABELS = ['NCA-1', 'NCA-2', 'NCA-3', 'NCA-4', 'NCA-5', 'NCA-6', 'NCA-7', 'NCA-8'] as const;

/**
 * Client-initiated project-request vocabulary ("Request a project" portal).
 * This is a different, finer-grained list than the contractor project-type
 * taxonomy — both the web form and the API route validate against this one
 * shared list. The enum-style values are kept for the auditor contract.
 */
export const CLIENT_PROJECT_REQUEST_TYPES = [
  'RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'INSTITUTIONAL', 'OTHER_WORKS',
  'New house / bungalow', 'Maisonette or villa', 'Apartments / flats',
  'Commercial building', 'Renovation / remodeling', 'Kitchen or bathroom remodel',
  'Interior design & finishes', 'Fencing & gates', 'Borehole / water works',
  'Solar / electrical installation', 'CCTV & security', 'Landscaping & gardening',
  'Roads, drainage or civil works', 'Land clearing & surveying', 'Other',
] as const;

export const CLIENT_BUDGET_RANGES = ['Below KES 1M', 'KES 1M - 5M', 'KES 5M - 20M', 'KES 20M - 50M', 'Above KES 50M', 'Not sure yet'] as const;

export const CLIENT_START_TIMEFRAMES = ['As soon as possible', 'Within 3 months', 'In 3 - 6 months', 'In 6 - 12 months', 'Just planning for now'] as const;

/** Default NCA class bands seeded per tenant (mirrors migration 0025). These
 *  are starting values only — NCA revises limits, so tenants adjust them in
 *  the editable nca_class_rules table. max is exclusive; NULL = no ceiling. */
export interface NcaDefaultRule {
  trade: string;
  classLabel: string;
  minContractValue: number | null;
  maxContractValue: number | null;
}

const NCA_BAND_LADDER: [string, number | null, number | null][] = [
  ['NCA-1', 0, 5_000_000],
  ['NCA-2', 5_000_000, 20_000_000],
  ['NCA-3', 20_000_000, 50_000_000],
  ['NCA-4', 50_000_000, 150_000_000],
  ['NCA-5', 150_000_000, 300_000_000],
  ['NCA-6', 300_000_000, 750_000_000],
  ['NCA-7', 750_000_000, null],
  ['NCA-8', null, null],
];

export function defaultNcaRules(): NcaDefaultRule[] {
  return NCA_TRADES.flatMap((trade) =>
    NCA_BAND_LADDER.map(([classLabel, minContractValue, maxContractValue]) => ({
      trade, classLabel, minContractValue, maxContractValue,
    })),
  );
}

/** Plain-words label for display: "Residential · Single home / bungalow". */
export function projectTypeLabel(type: string | null | undefined, subtype?: string | null): string | null {
  const cat = projectTypeCategory(type ?? null);
  if (!cat) return null;
  const sub = subtype ? cat.subtypes.find((s) => s.key === subtype)?.label ?? subtype : null;
  return sub ? `${cat.label} · ${sub}` : cat.label;
}

/**
 * Demo variation orders for the seeded Apex project — K4: every row has a
 * distinct title, amount, reason AND lifecycle state so owner-facing demo
 * screens never show duplicates. Consumed by seed.ts and asserted unique
 * by packages/db/src/seed-data.test.ts.
 */
export const VARIATION_SEEDS = [
  {
    title: 'Additional basement waterproofing membrane',
    reason: 'Geotechnical review recommended upgraded tanking below water table.',
    trigger_type: 'UNFORESEEN_CONDITION',
    status: 'APPROVED',
    net_amount: 486000,
    time_extension_days: 5,
    items: [{ description: 'Torch-on waterproofing, basement slab and walls', unit: 'm2', quantity: 1850, unit_rate: 262.16 }],
    submittedDaysAgo: 62,
    approvedDaysAgo: 40,
  },
  {
    title: 'Upgrade lobby flooring to Italian porcelain',
    reason: 'Client requested premium finish in double-volume lobby.',
    trigger_type: 'OWNER_REQUEST',
    status: 'OWNER_REVIEW',
    net_amount: 1247500,
    time_extension_days: 0,
    items: [{ description: 'Supply and lay 600x600 porcelain tiles', unit: 'm2', quantity: 420, unit_rate: 2970 }],
    submittedDaysAgo: 9,
    approvedDaysAgo: null,
  },
  {
    title: 'Relocate switchroom for DIB approval',
    reason: 'County planning feedback required switchroom away from boundary; contractor rate exceeded the approved estimate.',
    trigger_type: 'CODE_COMPLIANCE',
    status: 'REJECTED',
    net_amount: 218400,
    time_extension_days: 3,
    items: [{ description: 'Relocate LV switchgear and containment', unit: 'item', quantity: 1, unit_rate: 218400 }],
    submittedDaysAgo: 21,
    approvedDaysAgo: null,
  },
  {
    title: 'Extra drainage soak-away for roof runoff',
    reason: 'Hydraulic calculation showed undersized yard drain.',
    trigger_type: 'DESIGN_CLARIFICATION',
    status: 'PM_REVIEW',
    net_amount: -96000,
    time_extension_days: 0,
    items: [{ description: 'Omit duplicate soak-away chamber (credit)', unit: 'item', quantity: 1, unit_rate: -96000 }],
    submittedDaysAgo: 4,
    approvedDaysAgo: null,
  },
] as const;

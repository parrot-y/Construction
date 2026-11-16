import { PrismaClient } from '@prisma/client';
import { hashPassword, withTenantTx } from '../src/index';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://db_app:app_secret@127.0.0.1:54329/construction_dev?schema=public',
    },
  },
});

export async function seed() {
  // Audit A-08: demo seed data must NEVER run against production.
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Refusing to seed: NODE_ENV=production. Demo seed data is for development/test only. ' +
      'Provision real tenants/users through the application onboarding flow instead.',
    );
  }
  console.log('Seeding initial Kenyan construction tenant and V1 users...');

  // 1. Create or upsert Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'apex-builders' },
    update: {},
    create: {
      name: 'Apex Builders Kenya Ltd',
      slug: 'apex-builders',
      kra_pin: 'P051234567X',
      nca_category: 'NCA 4',
      currency: 'KES',
    },
  });

  // B1: demo/dev tenant keeps every gated module enabled so the full
  // surface stays exercisable; pilot tenants start with non-core OFF.
  const GATED = ['equipment','telematics','soil','survey','tenders','steel','asphalt','geofence','rmc','muster','independent','rebar','safety-audits','correspondence','inventory'];
  await withTenantTx(prisma, tenant.id, async (tx) => {
    for (const m of GATED) {
      await tx.tenantModuleFlag.upsert({
        where: { tenant_id_module: { tenant_id: tenant.id, module: m } },
        update: { enabled: true },
        create: { tenant_id: tenant.id, module: m, enabled: true, updated_by: 'seed' },
      });
    }
  });

  const defaultPasswordHash = await hashPassword('Password123!');

  // 2. Create V1 Users and Memberships within tenant context
  const usersData = [
    {
      email: 'admin@apexbuilders.co.ke',
      full_name: 'Mwangi Karanja',
      phone_number: '+254712345678',
      role: 'COMPANY_ADMIN',
    },
    {
      email: 'qs@apexbuilders.co.ke',
      full_name: 'Faith Achieng',
      phone_number: '+254722345678',
      role: 'PM_QS',
    },
    {
      email: 'supervisor@apexbuilders.co.ke',
      full_name: 'John Kiprono',
      phone_number: '+254733345678',
      role: 'SITE_SUPERVISOR',
    },
    {
      email: 'client@apexbuilders.co.ke',
      full_name: 'David Omondi',
      phone_number: '+254744345678',
      role: 'CLIENT',
    },
    // Gate-5 role ladder — one login per observed portal role
    {
      email: 'executive@apexbuilders.co.ke',
      full_name: 'Esther Wanjiru',
      phone_number: '+254755345678',
      role: 'EXECUTIVE',
    },
    {
      email: 'pm@apexbuilders.co.ke',
      full_name: 'Mary Wangari',
      phone_number: '+254766345678',
      role: 'PM_QS',
    },
    {
      email: 'engineer@apexbuilders.co.ke',
      full_name: 'Kevin Barasa',
      phone_number: '+254777345678',
      role: 'SITE_ENGINEER',
    },
    {
      email: 'superintendent@apexbuilders.co.ke',
      full_name: 'Grace Muthoni',
      phone_number: '+254788345678',
      role: 'SUPERINTENDENT',
    },
    {
      email: 'tradelead@apexbuilders.co.ke',
      full_name: 'Peter Kamau',
      phone_number: '+254799345678',
      role: 'TRADE_LEAD',
    },
    {
      email: 'foreman@apexbuilders.co.ke',
      full_name: 'Samuel Njoroge',
      phone_number: '+254700345678',
      role: 'FOREMAN',
    },
    {
      email: 'worker@apexbuilders.co.ke',
      full_name: 'Joseph Otieno',
      phone_number: '+254711345678',
      role: 'WORKER',
    },
    {
      email: 'viewer@apexbuilders.co.ke',
      full_name: 'Lydia Auma',
      phone_number: '+254722345678',
      role: 'VIEWER',
    },
    {
      email: 'architect@apexbuilders.co.ke',
      full_name: 'Peter Njoroge',
      phone_number: '+254733345678',
      role: 'ARCHITECT',
    },
    {
      email: 'qaqc@apexbuilders.co.ke',
      full_name: 'Susan Wanjiru',
      phone_number: '+254744345678',
      role: 'QA_QC',
    },
    {
      email: 'owner@apexbuilders.co.ke',
      full_name: 'Grace Muthoni',
      phone_number: '+254755345678',
      role: 'OWNER',
    },
  ];

  await withTenantTx(prisma, tenant.id, async (tx) => {
    const seededUsers: { id: string; role: string }[] = [];
    for (const u of usersData) {
      const user = await tx.user.upsert({
        where: { email: u.email },
        update: {
          password_hash: defaultPasswordHash,
          // Seeded demo accounts are pre-verified so they remain usable.
          email_verified_at: new Date(),
        },
        create: {
          email: u.email,
          password_hash: defaultPasswordHash,
          full_name: u.full_name,
          phone_number: u.phone_number,
          is_active: true,
          email_verified_at: new Date(),
        },
      });

      // Create Tenant Membership
      await tx.membership.upsert({
        where: {
          tenant_id_user_id: {
            tenant_id: tenant.id,
            user_id: user.id,
          },
        },
        update: {
          role: u.role,
        },
        create: {
          tenant_id: tenant.id,
          user_id: user.id,
          role: u.role,
        },
      });
      seededUsers.push({ id: user.id, role: u.role });
    }

    // 3. Create active demo Project
    const project = await tx.project.upsert({
      where: {
        tenant_id_code: {
          tenant_id: tenant.id,
          code: 'RCP-2026',
        },
      },
      update: {},
      create: {
        tenant_id: tenant.id,
        name: 'Riverside Commercial Plaza',
        code: 'RCP-2026',
        description: 'Ground + 4 Storey Commercial Office Block',
        location: 'Riverside Drive, Nairobi',
        nca_project_no: 'NCA-PRJ-2026-0891',
        status: 'ACTIVE',
        original_contract_sum: 45000000.0,
        current_approved_budget: 45000000.0,
      },
    });

    // Project memberships — required by the central authorization layer so
    // every seeded role can reach the demo project (tenant-wide roles exempt).
    for (const u of seededUsers) {
      await tx.projectMember.upsert({
        where: { project_id_user_id: { project_id: project.id, user_id: u.id } },
        update: { role: u.role },
        create: { tenant_id: tenant.id, project_id: project.id, user_id: u.id, role: u.role },
      });
    }

    // ------------------------------------------------------------------
    // Demo domain data (checklist 15) — varied, believable rows so dev and
    // screenshot captures show a living project, never repeated fixtures.
    // Each group is created only when empty, so re-seeding stays idempotent.
    // ------------------------------------------------------------------
    const adminUser = seededUsers.find((u) => u.role === 'COMPANY_ADMIN');

    // Suppliers — three different merchants for PO variety.
    const supplierSeeds = [
      { name: 'East Africa Cement Suppliers', contact: 'Ann Njeri', phone: '+254720111222' },
      { name: 'Savannah Timber & Boards Ltd', contact: 'John Muriithi', phone: '+254721333444' },
      { name: 'Nyali Steel & Roofing Supplies', contact: 'Caroline Atieno', phone: '+254722555666' },
    ];
    const supplierIds: string[] = [];
    for (const s of supplierSeeds) {
      const existing = await tx.supplier.findFirst({ where: { tenant_id: tenant.id, name: s.name } });
      const row = existing ?? await tx.supplier.create({
        data: { tenant_id: tenant.id, name: s.name, contact_person: s.contact, phone: s.phone, email: `${s.name.split(' ')[0].toLowerCase()}@supplies.co.ke` },
      });
      supplierIds.push(row.id);
    }

    // Purchase orders — different materials, suppliers and lifecycle states.
    if ((await tx.purchaseOrder.count({ where: { project_id: project.id } })) === 0 && supplierIds.length >= 3) {
      const poSeeds = [
        {
          po_number: 'PO-RCP-001', supplier_id: supplierIds[0]!, status: 'DELIVERED',
          order_date: new Date('2026-02-10'), expected_delivery_date: new Date('2026-02-24'),
          items: [
            { description: 'Cement 50kg (Bamburi)', unit: 'bag', quantity: 4000, rate: 780 },
            { description: 'Ballast 20mm', unit: 'tonne', quantity: 120, rate: 2850 },
          ],
        },
        {
          po_number: 'PO-RCP-002', supplier_id: supplierIds[1]!, status: 'PART_DELIVERED',
          order_date: new Date('2026-03-05'), expected_delivery_date: new Date('2026-03-28'),
          items: [
            { description: 'Plywood shuttering 18mm', unit: 'sheet', quantity: 600, rate: 4200 },
            { description: 'Hardwood props 100x100', unit: 'piece', quantity: 1500, rate: 950 },
          ],
        },
        {
          po_number: 'PO-RCP-003', supplier_id: supplierIds[2]!, status: 'ISSUED',
          order_date: new Date('2026-04-18'), expected_delivery_date: new Date('2026-05-09'),
          items: [
            { description: 'Y12 reinforcement bar', unit: 'tonne', quantity: 85, rate: 98000 },
            { description: 'Roofing sheets 0.5mm', unit: 'sheet', quantity: 2400, rate: 1650 },
          ],
        },
        {
          po_number: 'PO-RCP-004', supplier_id: supplierIds[0]!, status: 'DRAFT',
          order_date: new Date('2026-05-02'),
          items: [
            { description: 'Plaster sand (river sand)', unit: 'tonne', quantity: 300, rate: 3200 },
            { description: 'Wire nails 3"', unit: 'kg', quantity: 250, rate: 420 },
          ],
        },
      ];
      for (const po of poSeeds) {
        const total = po.items.reduce((s, i) => s + i.quantity * i.rate, 0);
        const { items, ...poData } = po;
        await tx.purchaseOrder.create({
          data: {
            ...poData,
            tenant_id: tenant.id,
            project_id: project.id,
            total_amount_kes: total,
            issued_at: po.status === 'DRAFT' ? null : po.order_date,
            created_by_id: adminUser?.id ?? null,
            items: { create: items.map((i) => ({ ...i, tenant_id: tenant.id })) },
          },
        });
      }
    }

    // Variations — different titles, amounts and lifecycle states.
    if ((await tx.variationOrder.count({ where: { project_id: project.id } })) === 0) {
      const maxNo = (await tx.variationOrder.aggregate({ where: { project_id: project.id }, _max: { variation_no: true } }))._max.variation_no ?? 0;
      const variationSeeds = [
        {
          title: 'Additional basement waterproofing membrane',
          reason: 'Geotechnical review recommended upgraded tanking below water table.',
          trigger_type: 'UNFORESEEN_CONDITION', status: 'APPROVED',
          net_amount: 486000, time_extension_days: 5,
          items: [{ description: 'Torch-on waterproofing, basement slab and walls', unit: 'm2', quantity: 1850, unit_rate: 262.16 }],
          submittedDaysAgo: 62, approvedDaysAgo: 40,
        },
        {
          title: 'Upgrade lobby flooring to Italian porcelain',
          reason: 'Client requested premium finish in double-volume lobby.',
          trigger_type: 'OWNER_REQUEST', status: 'OWNER_REVIEW',
          net_amount: 1247500, time_extension_days: 0,
          items: [{ description: 'Supply and lay 600x600 porcelain tiles', unit: 'm2', quantity: 420, unit_rate: 2970 }],
          submittedDaysAgo: 9,
        },
        {
          title: 'Relocate switchroom for DIB approval',
          reason: 'County planning feedback required switchroom away from boundary.',
          trigger_type: 'CODE_COMPLIANCE', status: 'PM_REVIEW',
          net_amount: 218400, time_extension_days: 3,
          items: [{ description: 'Relocate LV switchgear and containment', unit: 'item', quantity: 1, unit_rate: 218400 }],
          submittedDaysAgo: 4,
        },
        {
          title: 'Extra drainage soak-away for roof runoff',
          reason: 'Hydraulic calculation showed undersized yard drain.',
          trigger_type: 'DESIGN_CLARIFICATION', status: 'DRAFT',
          net_amount: -96000, time_extension_days: 0,
          items: [{ description: 'Omit duplicate soak-away chamber (credit)', unit: 'item', quantity: 1, unit_rate: -96000 }],
          submittedDaysAgo: null,
        },
      ];
      let seq = maxNo;
      for (const v of variationSeeds) {
        seq += 1;
        const submittedAt = v.submittedDaysAgo != null ? new Date(Date.now() - v.submittedDaysAgo * 86400_000) : null;
        const approvedAt = v.approvedDaysAgo != null ? new Date(Date.now() - v.approvedDaysAgo * 86400_000) : null;
        await tx.variationOrder.create({
          data: {
            tenant_id: tenant.id,
            project_id: project.id,
            variation_no: seq,
            title: v.title,
            reason: v.reason,
            trigger_type: v.trigger_type,
            status: v.status,
            requested_by_id: adminUser?.id ?? null,
            net_amount: v.net_amount,
            time_extension_days: v.time_extension_days,
            submitted_at: submittedAt,
            approved_at: approvedAt,
            created_at: submittedAt ?? new Date(Date.now() - 3 * 86400_000),
            items: {
              create: v.items.map((i) => ({
                ...i, tenant_id: tenant.id,
                total_amount: (i.quantity * i.unit_rate).toFixed(2),
              })),
            },
          },
        });
      }
    }

    // Inspections — different types, outcomes and dates.
    if ((await tx.inspectionChecklist.count({ where: { project_id: project.id } })) === 0) {
      const inspectionSeeds = [
        { checklist_type: 'PRE_POUR_CONCRETE', title: 'Raft slab pour — grid C4', location: 'Basement raft, grid C4', status: 'APPROVED_WITHOUT_COMMENTS', scheduled_date: '2026-03-14', inspected_at: '2026-03-14', inspector_name: 'Eng. Wanjiru Kamau', inspector_role: 'Consulting Engineer' },
        { checklist_type: 'REBAR_VERIFICATION', title: 'First floor beam reinforcement', location: 'Level 1, grid A-B/3-5', status: 'APPROVED_WITH_CONDITIONS', scheduled_date: '2026-04-02', inspected_at: '2026-04-02', inspector_name: 'Eng. Wanjiru Kamau', inspector_role: 'Consulting Engineer' },
        { checklist_type: 'WATERPROOFING_FLOOD_TEST', title: 'Basement tanking flood test', location: 'Basement, grid A1-D4', status: 'REJECTED', scheduled_date: '2026-05-11', inspected_at: '2026-05-11', inspector_name: 'Eng. Otieno Odhiambo', inspector_role: 'Waterproofing Specialist' },
        { checklist_type: 'PRE_HANDOVER_INSPECTION', title: 'Villa 3 pre-handover snag walk', location: 'Villa 3, all floors', status: 'IN_PROGRESS', scheduled_date: '2026-06-20', inspected_at: null, inspector_name: null, inspector_role: null },
        { checklist_type: 'MEP_PRESSURE_TEST', title: 'Domestic water pressure test', location: 'Plant room & risers', status: 'PENDING', scheduled_date: '2026-06-28', inspected_at: null, inspector_name: null, inspector_role: null },
      ] as const;
      for (const i of inspectionSeeds) {
        await tx.inspectionChecklist.create({
          data: {
            tenant_id: tenant.id,
            project_id: project.id,
            ...i,
            scheduled_date: new Date(i.scheduled_date),
            inspected_at: i.inspected_at ? new Date(i.inspected_at) : null,
          },
        });
      }
    }

    // Snags — different trades, severities and workflow states.
    if ((await tx.snagItem.count({ where: { project_id: project.id } })) === 0) {
      const snagSeeds = [
        { snag_number: 1, location_block: 'Villa 1', location_floor: 'Ground', location_room: 'Kitchen', trade_category: 'Joinery', description: 'Kitchen unit door misaligned — gap at hinge side exceeds 3mm.', severity: 'FUNCTIONAL', status: 'READY_FOR_REVIEW', priority: 'HIGH', identified_by_name: 'Sarah Achieng', identified_at: '2026-05-30', due_date: '2026-06-12' },
        { snag_number: 2, location_block: 'Villa 2', location_floor: 'First', location_room: 'Master bathroom', trade_category: 'Tiling', description: 'Hollow-sounding tiles near shower tray — two tiles need re-fix.', severity: 'FUNCTIONAL', status: 'IN_PROGRESS', priority: 'MEDIUM', identified_by_name: 'Eng. Wanjiru Kamau', identified_at: '2026-06-02', due_date: '2026-06-20' },
        { snag_number: 3, location_block: 'Villa 4', location_floor: 'Second', location_room: 'Bedroom 2', trade_category: 'Painting', description: 'Paint blistering on external wall near window reveal.', severity: 'COSMETIC', status: 'OPEN', priority: 'LOW', identified_by_name: 'Sarah Achieng', identified_at: '2026-06-08', due_date: '2026-06-25' },
        { snag_number: 4, location_block: 'Common', location_floor: 'Basement', location_room: 'Car park ramp', trade_category: 'Waterproofing', description: 'Damp patch on ramp wall — possible membrane puncture at drain.', severity: 'CRITICAL_SAFETY', status: 'IN_PROGRESS', priority: 'CRITICAL', identified_by_name: 'Eng. Otieno Odhiambo', identified_at: '2026-06-10', due_date: '2026-06-16' },
        { snag_number: 5, location_block: 'Villa 5', location_floor: 'Ground', location_room: 'Living room', trade_category: 'Electrical', description: 'Socket faceplate cracked beside TV point.', severity: 'COSMETIC', status: 'VERIFIED_CLOSED', priority: 'LOW', identified_by_name: 'Eng. Wanjiru Kamau', identified_at: '2026-05-18', rectified_at: '2026-05-25', verified_at: '2026-05-27', verified_by_name: 'Eng. Wanjiru Kamau' },
        { snag_number: 6, location_block: 'Villa 2', location_floor: 'Roof', location_room: 'Parapet', trade_category: 'Waterproofing', description: 'Contractor disputes sealant failure — claims substrate prep issue.', severity: 'FUNCTIONAL', status: 'CONTESTED', priority: 'MEDIUM', identified_by_name: 'Sarah Achieng', identified_at: '2026-06-05', due_date: '2026-06-19' },
      ] as const;
      for (const s of snagSeeds) {
        await tx.snagItem.create({
          data: {
            tenant_id: tenant.id,
            project_id: project.id,
            ...s,
            identified_at: new Date(s.identified_at),
            due_date: s.due_date ? new Date(s.due_date) : null,
            rectified_at: s.rectified_at ? new Date(s.rectified_at) : null,
            verified_at: s.verified_at ? new Date(s.verified_at) : null,
          },
        });
      }
    }

    console.log(`Database seeded successfully! Tenant: ${tenant.name} (${tenant.id}), Project: ${project.name}`);
  });
}

seed()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

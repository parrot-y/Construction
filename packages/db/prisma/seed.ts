import path from 'node:path';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { hashPassword, withTenantTx } from '../src/index';
import { VARIATION_SEEDS } from '../src/variation-seeds';
import { defaultNcaRules } from '@construction/validation';

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
    // Phase 2.8: demo tenant gets the editable NCA class-band table too —
    // registerCompany seeds it for signups; the seed path needs it as well.
    // deleteMany first keeps re-seeding idempotent (no unique constraint).
    await tx.ncaClassRule.deleteMany({});
    await tx.ncaClassRule.createMany({
      data: defaultNcaRules().map((r) => ({
        tenant_id: tenant.id,
        trade: r.trade,
        class_label: r.classLabel,
        min_contract_value: r.minContractValue,
        max_contract_value: r.maxContractValue,
        notes: 'Default band — confirm current NCA limits before registration',
      })),
    });
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
      const variationSeeds = VARIATION_SEEDS;
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

    // Schedule tasks — the dashboard "Next milestones" block and any Gantt
    // view need believable WBS rows, not an empty table.
    if ((await tx.projectScheduleTask.count({ where: { project_id: project.id } })) === 0) {
      const day = 86400_000;
      const taskSeeds = [
        { wbs_phase: 'SUBSTRUCTURE', task_name: 'Raft slab pour — grid C4', planned_start_date: -40, planned_end_date: -38, duration_days: 3, progress_percentage: 100, status: 'COMPLETED', assigned_trade: 'Concrete crew' },
        { wbs_phase: 'SUBSTRUCTURE', task_name: 'Ground beams and blinding', planned_start_date: -35, planned_end_date: -25, duration_days: 11, progress_percentage: 100, status: 'COMPLETED', assigned_trade: 'Masons' },
        { wbs_phase: 'SUPERSTRUCTURE', task_name: 'Columns to first floor', planned_start_date: -20, planned_end_date: -6, duration_days: 15, progress_percentage: 100, status: 'COMPLETED', assigned_trade: 'Masons' },
        { wbs_phase: 'SUPERSTRUCTURE', task_name: 'First floor slab and beam reinforcement', planned_start_date: -8, planned_end_date: 4, duration_days: 13, progress_percentage: 65, status: 'IN_PROGRESS', assigned_trade: 'Steel fixers' },
        { wbs_phase: 'SUPERSTRUCTURE', task_name: 'Blockwork to second floor', planned_start_date: 2, planned_end_date: 18, duration_days: 17, progress_percentage: 10, status: 'IN_PROGRESS', assigned_trade: 'Masons' },
        { wbs_phase: 'ROOFING', task_name: 'Roof trusses and iron sheets', planned_start_date: 30, planned_end_date: 44, duration_days: 15, progress_percentage: 0, status: 'PLANNED', assigned_trade: 'Roofers' },
        { wbs_phase: 'SERVICES', task_name: 'Electrical first fix', planned_start_date: 40, planned_end_date: 58, duration_days: 19, progress_percentage: 0, status: 'PLANNED', assigned_trade: 'Electricians' },
        { wbs_phase: 'FINISHES', task_name: 'Plastering and screeding', planned_start_date: 55, planned_end_date: 75, duration_days: 21, progress_percentage: 0, status: 'PLANNED', assigned_trade: 'Masons' },
        { wbs_phase: 'EXTERNAL_WORKS', task_name: 'External paving and drainage', planned_start_date: 70, planned_end_date: 88, duration_days: 19, progress_percentage: 0, status: 'PLANNED', assigned_trade: 'General works' },
      ];
      const now = Date.now();
      for (const [i, t] of taskSeeds.entries()) {
        await tx.projectScheduleTask.create({
          data: {
            tenant_id: tenant.id,
            project_id: project.id,
            ...t,
            planned_start_date: new Date(now + t.planned_start_date * day),
            planned_end_date: new Date(now + t.planned_end_date * day),
            order_index: i,
          },
        });
      }
    }

    // Site diaries + photos — powers the dashboard site-health and latest-
    // photos blocks. Photo binaries are committed seed assets copied into
    // the configured upload root (same layout the API serves at /uploads/).
    if ((await tx.siteDiary.count({ where: { project_id: project.id } })) === 0 && adminUser) {
      const uploadRoot = process.env.UPLOAD_DIR || process.env.E2E_UPLOAD_DIR
        || path.resolve(import.meta.dirname, '../../../apps/api/uploads');
      const photoDir = path.join(uploadRoot, tenant.id, project.id);
      fs.mkdirSync(photoDir, { recursive: true });
      const assetsDir = path.resolve(import.meta.dirname, 'seed-assets');
      const photoFiles = ['site-foundation.jpg', 'site-steelfix.jpg', 'site-blockwork.jpg', 'site-delivery.jpg'];
      const diarySeeds = [
        { offset: 0, weather: 'SUNNY', site_status: 'OPERATIONAL', general_notes: 'First floor beam reinforcement continuing on grid A-B/3-5. Two tower cranes operational; concrete skip in use for column pours.', photos: [0, 1] },
        { offset: 2, weather: 'PARTLY_CLOUDY', site_status: 'OPERATIONAL', general_notes: 'Blockwork started on Villa 2 party walls. Delivery of 400 bags cement received and stacked in bay 2.', photos: [3] },
        { offset: 4, weather: 'SUNNY', site_status: 'OPERATIONAL', general_notes: 'Rebar inspection prep for first floor slab. MEP first-fix setting out underway on level 1.', photos: [1] },
        { offset: 7, weather: 'LIGHT_RAIN', site_status: 'PARTIAL', general_notes: 'Morning rain delayed external works; internal blockwork continued. Pump and generator on standby.', photos: [] },
        { offset: 11, weather: 'SUNNY', site_status: 'OPERATIONAL', general_notes: 'Foundation pour completed on grid C4. Blinding and membrane inspection signed off.', photos: [0] },
      ];
      let photoIdx = 0;
      for (const d of diarySeeds) {
        const entryDate = new Date(Date.now() - d.offset * 86400_000);
        const diary = await tx.siteDiary.create({
          data: {
            tenant_id: tenant.id,
            project_id: project.id,
            entry_date: entryDate,
            weather: d.weather,
            site_status: d.site_status,
            general_notes: d.general_notes,
            recorded_by_id: adminUser.id,
          },
        });
        for (const pi of d.photos) {
          const file = photoFiles[pi % photoFiles.length]!;
          const key = `${tenant.id}/${project.id}/seed-${photoIdx}.jpg`;
          photoIdx += 1;
          fs.copyFileSync(path.join(assetsDir, file), path.join(uploadRoot, key));
          await tx.sitePhoto.create({
            data: {
              tenant_id: tenant.id,
              site_diary_id: diary.id,
              storage_key: key,
              caption: file.replace('site-', '').replace('.jpg', '').replace(/-/g, ' '),
              client_visible: pi !== 1,
              taken_at: new Date(entryDate.getTime() + 9 * 3600_000),
            },
          });
        }
      }
    }

    // Invoices + payment certificates — money-per-project bars, invoice
    // attention stats and retention figures on the dashboard.
    if ((await tx.invoice.count({ where: { project_id: project.id } })) === 0 && adminUser) {
      const maxInv = (await tx.invoice.aggregate({ where: { tenant_id: tenant.id }, _max: { invoice_no: true } }))._max.invoice_no ?? 0;
      const invSeeds = [
        { title: 'Interim valuation — substructure complete', status: 'PAID', total: 6750000, paid: 6750000, issueOffset: 70, dueOffset: 55 },
        { title: 'Interim valuation — superstructure underway', status: 'SENT', total: 5400000, paid: 0, issueOffset: 20, dueOffset: 5 },
        { title: 'Variation account — additional piling', status: 'OVERDUE', total: 1150000, paid: 0, issueOffset: 45, dueOffset: -10 },
      ];
      for (const [i, inv] of invSeeds.entries()) {
        const issue = new Date(Date.now() - inv.issueOffset * 86400_000);
        const due = new Date(Date.now() - inv.dueOffset * 86400_000);
        const subtotal = Math.round(inv.total / 1.16);
        const tax = inv.total - subtotal;
        await tx.invoice.create({
          data: {
            tenant_id: tenant.id,
            invoice_no: maxInv + i + 1,
            title: inv.title,
            project_id: project.id,
            client_name: 'Riverside Properties Ltd',
            client_email: 'accounts@riversideproperties.co.ke',
            status: inv.status,
            currency: 'KES',
            subtotal, tax_pct: 16, tax_amount: tax, total: inv.total,
            amount_paid: inv.paid, balance_due: inv.total - inv.paid,
            issue_date: issue, due_date: due,
            sent_at: issue, paid_at: inv.status === 'PAID' ? due : null,
            created_by: adminUser.id,
          },
        });
      }
      const maxCert = (await tx.paymentCertificate.aggregate({ where: { project_id: project.id }, _max: { certificate_no: true } }))._max.certificate_no ?? 0;
      const certSeeds = [
        { this_period: 5200000, prev: 0, retention_pct: 5, retention_held: 260000, status: 'PAID', endOffset: 60 },
        { this_period: 6750000, prev: 5200000, retention_pct: 5, retention_held: 597500, status: 'CERTIFIED', endOffset: 25 },
      ];
      for (const [i, c] of certSeeds.entries()) {
        const periodEnd = new Date(Date.now() - c.endOffset * 86400_000);
        const periodStart = new Date(periodEnd.getTime() - 30 * 86400_000);
        const retentionDeduction = Math.round(c.this_period * c.retention_pct / 100);
        const netPayable = c.this_period - retentionDeduction;
        await tx.paymentCertificate.create({
          data: {
            tenant_id: tenant.id,
            project_id: project.id,
            certificate_no: maxCert + i + 1,
            period_start: periodStart,
            period_end: periodEnd,
            this_period_amount: c.this_period,
            previous_certified: c.prev,
            cumulative_certified: c.prev + c.this_period,
            retention_pct: c.retention_pct,
            retention_deduction: retentionDeduction,
            retention_held: c.retention_held,
            net_payable: netPayable,
            status: c.status,
            submitted_at: periodEnd,
            certified_at: periodEnd,
            paid_at: c.status === 'PAID' ? periodEnd : null,
            submitted_by_id: adminUser.id,
            certified_by_id: adminUser.id,
          },
        });
      }
    }

    // Monthly EVM/cash-flow points — feeds the progress-against-plan curve
    // and the cash forecast blocks. period_month is "YYYY-MM".
    if ((await tx.projectCashFlowForecast.count({ where: { project_id: project.id } })) === 0) {
      const ym = (offsetMonths: number) => {
        const d = new Date();
        d.setMonth(d.getMonth() + offsetMonths);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      };
      const rows = [
        { m: -5, pv: 4200000, ac: 4050000, ev: 3900000, billed: 3600000, cash: 1800000 },
        { m: -4, pv: 8600000, ac: 8400000, ev: 8100000, billed: 7800000, cash: 2200000 },
        { m: -3, pv: 12400000, ac: 12100000, ev: 11800000, billed: 11200000, cash: -650000 },
        { m: -2, pv: 15800000, ac: 15600000, ev: 15100000, billed: 14800000, cash: 2900000 },
        { m: -1, pv: 18900000, ac: 18800000, ev: 18100000, billed: 17900000, cash: 1500000 },
        { m: 0, pv: 21800000, ac: 21900000, ev: 20700000, billed: 20500000, cash: -1400000 },
        { m: 1, pv: 24400000, ac: 24600000, ev: 23100000, billed: 22800000, cash: 3100000 },
        { m: 2, pv: 26800000, ac: 27100000, ev: 25200000, billed: 24900000, cash: 900000 },
      ];
      for (const r of rows) {
        await tx.projectCashFlowForecast.create({
          data: {
            tenant_id: tenant.id,
            project_id: project.id,
            period_month: ym(r.m),
            planned_value_kes: r.pv,
            actual_cost_kes: r.ac,
            earned_value_kes: r.ev,
            cpi: Number((r.ev / r.ac).toFixed(4)),
            spi: Number((r.ev / r.pv).toFixed(4)),
            forecasted_final_cost_kes: 46200000,
            client_billed_kes: r.billed,
            net_cash_flow_kes: r.cash,
            status: r.m <= 0 ? 'ON_TRACK' : 'AHEAD_UNDER_BUDGET',
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

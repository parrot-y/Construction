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
  ];

  await withTenantTx(prisma, tenant.id, async (tx) => {
    for (const u of usersData) {
      const user = await tx.user.upsert({
        where: { email: u.email },
        update: {
          password_hash: defaultPasswordHash,
        },
        create: {
          email: u.email,
          password_hash: defaultPasswordHash,
          full_name: u.full_name,
          phone_number: u.phone_number,
          is_active: true,
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

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/index';

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

  // 2. Create V1 Users
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
  ];

  for (const u of usersData) {
    const user = await prisma.user.upsert({
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
    await prisma.membership.upsert({
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
  const project = await prisma.project.upsert({
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
}

seed()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

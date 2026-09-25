import {
  EquipmentStatus,
  Organization,
  PrismaClient,
  RequestStatus,
  Role,
  ScheduleStatus,
  ServiceKind,
  TicketPriority,
  TicketStatus,
  TicketType,
  UserStatus,
} from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const checklist = [
  ['Body Work', 'Wiper condition checked'],
  ['Body Work', 'All four doors condition checked'],
  ['Body Work', 'Body condition checked for damage/wear'],
  ['Body Work', 'Front side mirrors checked'],
  ['Body Work', 'Windshield condition checked'],
  ['Body Work', 'Rear glass condition checked'],
  ['Body Work', 'Rear side mirrors checked'],
  ['Engine', 'Lube filter checked/replaced'],
  ['Engine', 'Fuel filter checked/replaced'],
  ['Engine', 'Air filter checked/replaced'],
  ['Engine', 'Water separator checked'],
  ['Engine', 'Engine oil level/condition checked'],
  ['Engine', 'Engine idle/RPM checked'],
  ['Engine', 'Belting condition checked'],
  ['Engine', 'Timing belt condition checked'],
  ['Engine', 'Diesel tank checked'],
  ['Engine', 'Engine checked for oil/fluid leakage'],
  ['Transmission', 'Gear filter checked/replaced'],
  ['Transmission', 'Gear oil level/condition checked'],
  ['Transmission', 'Transmission checked for leakage'],
  ['Rear Axle', 'Axle oil level/condition checked'],
  ['Rear Axle', 'Axle oil seal checked for leakage'],
  ['Brake', 'Brake oil level/condition checked'],
  ['Brake', 'Brake pads checked'],
  ['Brake', 'Brake hoses checked'],
  ['Brake', 'Brake calipers checked'],
  ['Brake', 'Brake discs checked'],
  ['Brake', 'Brake drums checked'],
  ['Brake', 'Brake lining checked'],
  ['Brake', 'Wheel cylinders checked'],
  ['Brake', 'Parking brake cable checked'],
  ['Hydraulic', 'Hydraulic filter checked/replaced'],
  ['Hydraulic', 'Hydraulic oil level/condition checked'],
  ['Hydraulic', 'Main hydraulic pump checked'],
  ['Hydraulic', 'Hydraulic hoses checked'],
  ['Hydraulic', 'Hydraulic cylinders checked'],
  ['Wheels & Suspension', 'Tyres checked for condition/wear'],
  ['Wheels & Suspension', 'Wheel studs checked'],
  ['Wheels & Suspension', 'Tyre pressure checked on all four wheels'],
  ['Wheels & Suspension', 'Leaf springs checked'],
  ['Wheels & Suspension', 'Front springs checked'],
  ['Wheels & Suspension', 'U-clamps checked'],
  ['Electrical', 'Front lamps checked'],
  ['Electrical', 'Rear lamps checked'],
  ['Electrical', 'Front indicators/signals checked'],
  ['Electrical', 'Rear indicators/signals checked'],
  ['Electrical', 'Reverse lights checked'],
  ['Electrical', 'Brake lights checked'],
  ['Electrical', 'Battery water/condition checked'],
  ['Electrical', 'Beacon light checked'],
  ['Greasing', 'Propeller shaft greased/checked'],
  ['Greasing', 'King pin greased/checked'],
  ['Greasing', 'Steering joints greased/checked'],
  ['Greasing', 'Spring points greased/checked'],
  ['Safety', 'Fire extinguisher checked and expiry date verified'],
  ['Safety', 'Tyre chock available and condition checked'],
  ['Safety', 'Chain tyre chock checked'],
  ['General', 'Equipment washing completed'],
  ['General', 'Painting condition checked/touch-up completed'],
  ['General', 'Safety/identification stickers checked'],
] as const;

async function seedDemoData(userId: string) {
  const equipmentType = await prisma.equipmentType.upsert({
    where: { name: 'Demo Airport Tractor' },
    update: {},
    create: {
      name: 'Demo Airport Tractor',
      services: {
        create: [
          {
            name: 'F-Service',
            kind: ServiceKind.F_SERVICE,
            minHours: 0,
            maxHours: 500,
          },
          {
            name: 'B-Service',
            kind: ServiceKind.B_SERVICE,
            minHours: 500,
            maxHours: 1000,
          },
          {
            name: 'C-Service',
            kind: ServiceKind.C_SERVICE,
            minHours: 1000,
            maxHours: 1500,
          },
          {
            name: 'D-Service',
            kind: ServiceKind.D_SERVICE,
            minHours: 1500,
            maxHours: 2000,
          },
          {
            name: 'E-Service',
            kind: ServiceKind.E_SERVICE,
            minHours: 2000,
            maxHours: 2500,
          },
          { name: 'Others', kind: ServiceKind.OTHERS, minHours: 2500 },
          { name: 'V-Service', kind: ServiceKind.V_SERVICE, months: 6 },
        ],
      },
    },
  });

  const equipment = await Promise.all(
    [
      {
        assetNo: 'DEMO-GSE-001',
        manufacturer: 'Tug',
        model: '660',
        location: 'Terminal 1',
        status: EquipmentStatus.AVAILABLE,
        hourMeter: 1248.5,
      },
      {
        assetNo: 'DEMO-GSE-002',
        manufacturer: 'TLD',
        model: 'TMX-150',
        location: 'Cargo Apron',
        status: EquipmentStatus.UNDER_MAINTENANCE,
        hourMeter: 2031,
      },
      {
        assetNo: 'DEMO-GSE-003',
        manufacturer: 'Charlatte',
        model: 'T135',
        location: 'Hangar 2',
        status: EquipmentStatus.OUT_OF_SERVICE,
        hourMeter: 876,
      },
    ].map(({ assetNo, ...data }) =>
      prisma.equipment.upsert({
        where: { assetNo },
        update: {},
        create: { assetNo, equipmentTypeId: equipmentType.id, ...data },
      }),
    ),
  );

  const [available, maintenance, outOfService] = equipment;
  const tickets = await Promise.all(
    [
      {
        ticketNo: 'DEMO-TKT-OPEN-001',
        equipmentId: available.id,
        serviceType: TicketType.BREAKDOWN,
        priority: TicketPriority.HIGH,
        status: TicketStatus.OPEN,
        faultDescription: 'Hydraulic lift responds slowly during operation.',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
      {
        ticketNo: 'DEMO-TKT-PARTS-001',
        equipmentId: maintenance.id,
        serviceType: TicketType.GENERAL,
        priority: TicketPriority.MEDIUM,
        status: TicketStatus.AWAITING_PARTS,
        faultDescription: 'Replace worn starter motor and inspect wiring.',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
      {
        ticketNo: 'DEMO-TKT-DONE-001',
        equipmentId: outOfService.id,
        serviceType: TicketType.F_SERVICE,
        priority: TicketPriority.LOW,
        status: TicketStatus.COMPLETED,
        faultDescription: 'Routine 1,000-hour preventive maintenance.',
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        closedDate: new Date(),
        downtimeHours: 4.5,
      },
    ].map((data) =>
      prisma.ticket.upsert({
        where: { ticketNo: data.ticketNo },
        update: {},
        create: { ...data, createdByUserId: userId },
      }),
    ),
  );

  await prisma.equipmentRequest.upsert({
    where: { requestNo: 'DEMO-REQ-001' },
    update: {},
    create: {
      requestNo: 'DEMO-REQ-001',
      ticketId: tickets[1].id,
      equipmentId: maintenance.id,
      item: 'Starter motor',
      quantity: 1,
      reason: 'Required to complete the open maintenance work.',
      status: RequestStatus.PENDING,
      requestedById: userId,
    },
  });

  await prisma.maintenanceSchedule.upsert({
    where: { scheduleNo: 'DEMO-SCH-001' },
    update: {},
    create: {
      scheduleNo: 'DEMO-SCH-001',
      equipmentId: available.id,
      lastDate: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: ScheduleStatus.SCHEDULED,
    },
  });

  console.log(
    'Demo equipment, tickets, parts request, and schedule are ready.',
  );
}

async function main() {
  if (
    process.env.SEED_DEMO_DATA === 'true' &&
    process.env.NODE_ENV === 'production'
  ) {
    throw new Error('Demo data seeding is disabled in production.');
  }

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !name || !password || password.length < 12) {
    throw new Error(
      'Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME and a BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters before seeding.',
    );
  }

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name,
      passwordHash: await hash(password, 12),
      role: Role.SUPER_ADMIN,
      organization: Organization.NGGL,
      status: UserStatus.ACTIVE,
      mustChangePassword: true,
    },
  });

  const serviceTypes = [
    ServiceKind.F_SERVICE,
    ServiceKind.B_SERVICE,
    ServiceKind.C_SERVICE,
    ServiceKind.D_SERVICE,
    ServiceKind.E_SERVICE,
    ServiceKind.V_SERVICE,
    ServiceKind.OTHERS,
  ];
  for (const serviceType of serviceTypes) {
    const count = await prisma.checklistTemplateItem.count({
      where: { serviceType, equipmentTypeServiceId: null },
    });
    if (!count) {
      await prisma.checklistTemplateItem.createMany({
        data: checklist.map(([category, label], sortOrder) => ({
          serviceType,
          category,
          label,
          sortOrder,
        })),
      });
    }
  }

  if (process.env.SEED_DEMO_DATA === 'true') await seedDemoData(admin.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

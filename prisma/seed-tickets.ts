import {
  EquipmentStatus,
  Prisma,
  PrismaClient,
  RequestStatus,
  Role,
  ServiceKind,
  TicketPriority,
  TicketStatus,
  TicketType,
  UserStatus,
} from '@prisma/client';
import { loadChecklistCatalog } from '../src/common/checklist-catalog';
import { ChecklistTemplate } from '../src/common/checklist-templates';
import { ticketTypeLabel } from '../src/common/api-serializers';

// Dummy tickets for development/UAT. Idempotent: existing DMY-* records are
// left untouched. Run with `pnpm run db:seed:tickets`.
const prisma = new PrismaClient();
const FIXED_CHECKLIST_EQUIPMENT_TYPES = [
  'Push Back',
  'Belt Loader',
  'ACU',
  'GPU',
  'CPT TF-7',
  'Passenger Steps',
] as const;
let checklistCatalog: ChecklistTemplate[] = [];
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

const services: {
  kind: ServiceKind;
  name: string;
  minHours?: number;
  maxHours?: number;
  months?: number;
}[] = [
  {
    kind: ServiceKind.F_SERVICE,
    name: 'F-Service',
    minHours: 0,
    maxHours: 500,
  },
  {
    kind: ServiceKind.B_SERVICE,
    name: 'B-Service',
    minHours: 500,
    maxHours: 1000,
  },
  {
    kind: ServiceKind.C_SERVICE,
    name: 'C-Service',
    minHours: 1000,
    maxHours: 2000,
  },
  {
    kind: ServiceKind.D_SERVICE,
    name: 'D-Service',
    minHours: 2000,
    maxHours: 2500,
  },
  {
    kind: ServiceKind.E_SERVICE,
    name: 'E-Service',
    minHours: 2500,
    maxHours: 3000,
  },
  { kind: ServiceKind.V_SERVICE, name: 'V-Service', months: 6 },
];

const equipmentByType: Record<
  (typeof FIXED_CHECKLIST_EQUIPMENT_TYPES)[number],
  { code: string; manufacturer: string; model: string }
> = {
  'Push Back': { code: 'PB', manufacturer: 'TLD', model: 'TMX-150' },
  'Belt Loader': { code: 'BL', manufacturer: 'TLD', model: 'NBL-E' },
  ACU: { code: 'ACU', manufacturer: 'TLD', model: 'ACU-802' },
  GPU: { code: 'GPU', manufacturer: 'TLD', model: 'GPU-428' },
  'CPT TF-7': { code: 'CPT', manufacturer: 'TLD', model: 'TF-7' },
  'Passenger Steps': { code: 'PS', manufacturer: 'TLD', model: 'ABS-580' },
};

const locations = [
  'Terminal 1',
  'Cargo Apron',
  'Hangar 2',
  'Bay 7',
  'Terminal 2',
];

// Status rotation so every equipment type x service gets a different stage.
const statusCycle: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
  TicketStatus.AWAITING_PARTS,
  TicketStatus.AWAITING_VERIFICATION,
  TicketStatus.CLOSED,
];

const manualTickets: {
  type: TicketType;
  fault: string;
  priority: TicketPriority;
  status: TicketStatus;
  party: string;
}[] = [
  {
    type: TicketType.BREAKDOWN,
    fault: 'Hydraulic lift responds slowly during operation.',
    priority: TicketPriority.HIGH,
    status: TicketStatus.OPEN,
    party: 'Ramp Control',
  },
  {
    type: TicketType.BREAKDOWN,
    fault: 'Engine does not start — starter motor clicking.',
    priority: TicketPriority.CRITICAL,
    status: TicketStatus.IN_PROGRESS,
    party: 'Biman Operations',
  },
  {
    type: TicketType.GENERAL,
    fault: 'Replace damaged side mirror and check wiring of beacon light.',
    priority: TicketPriority.MEDIUM,
    status: TicketStatus.ASSIGNED,
    party: 'Station Manager',
  },
  {
    type: TicketType.GENERAL,
    fault: 'Conveyor belt misalignment reported by loading crew.',
    priority: TicketPriority.MEDIUM,
    status: TicketStatus.AWAITING_VERIFICATION,
    party: 'Cargo Section',
  },
  {
    type: TicketType.WASHING,
    fault: 'Full exterior wash and degreasing before audit.',
    priority: TicketPriority.LOW,
    status: TicketStatus.CLOSED,
    party: 'Quality Assurance',
  },
  {
    type: TicketType.WASHING,
    fault: 'Cabin and exterior wash after monsoon operations.',
    priority: TicketPriority.LOW,
    status: TicketStatus.ASSIGNED,
    party: 'Biman Operations',
  },
];

const parts = [
  'Engine oil 15W-40 (12 L), oil filter',
  'Fuel filter, air filter element',
  'Hydraulic filter, brake pads (set)',
  'Coolant (5 L), V-belt',
  'N/A — inspection only',
];
const requestItems = [
  'Hydraulic filter',
  'Brake pad set',
  'Air filter element',
  'Starter relay',
  'Beacon light assembly',
  'Fuel filter',
];

const reached = (status: TicketStatus, stage: TicketStatus) =>
  statusCycle.indexOf(status) >= statusCycle.indexOf(stage);

async function main() {
  checklistCatalog = await loadChecklistCatalog(prisma);
  if (process.env.NODE_ENV === 'production')
    throw new Error('Dummy ticket seeding is disabled in production.');

  const creator = await prisma.user.findFirst({
    where: {
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!creator) throw new Error('An active Super Admin is required.');
  const engineers = await prisma.user.findMany({
    where: { role: Role.ENGINEER, status: UserStatus.ACTIVE, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  if (!engineers.length)
    throw new Error('At least one active engineer is required.');
  // Favour the primary engineer account so it has plenty of work to try.
  const primary =
    engineers.find((user) => user.email === 'engineer@biman.com') ??
    engineers[0];
  const others = engineers.filter((user) => user.id !== primary.id);
  const engineerFor = (index: number) =>
    index % 3 === 2 && others.length ? others[index % others.length] : primary;

  const equipment: {
    id: string;
    assetNo: string;
    typeName: string;
    hourMeter: number;
  }[] = [];
  for (const [
    typeIndex,
    typeName,
  ] of FIXED_CHECKLIST_EQUIPMENT_TYPES.entries()) {
    const type = await prisma.equipmentType.upsert({
      where: { name: typeName },
      update: {},
      create: {
        name: typeName,
        services: {
          create: services.map((service, sortOrder) => ({
            ...service,
            sortOrder,
          })),
        },
      },
    });
    const info = equipmentByType[typeName];
    for (const unit of [1, 2]) {
      const assetNo = `DMY-${info.code}-${String(unit).padStart(3, '0')}`;
      const hourMeter = 400 + typeIndex * 350 + unit * 180.5;
      const item = await prisma.equipment.upsert({
        where: { assetNo },
        update: {},
        create: {
          assetNo,
          equipmentTypeId: type.id,
          manufacturer: info.manufacturer,
          model: info.model,
          location: locations[(typeIndex + unit) % locations.length],
          status:
            unit === 2
              ? EquipmentStatus.UNDER_MAINTENANCE
              : EquipmentStatus.AVAILABLE,
          hourMeter,
          tldSerialNo: `TLD-${info.code}-${2024 + unit}${typeIndex}7`,
        },
      });
      equipment.push({ id: item.id, assetNo, typeName, hourMeter });
    }
  }

  const serviceIds = new Map(
    (
      await prisma.equipmentTypeService.findMany({
        where: {
          equipmentType: { name: { in: [...FIXED_CHECKLIST_EQUIPMENT_TYPES] } },
        },
        select: {
          id: true,
          kind: true,
          equipmentType: { select: { name: true } },
        },
      })
    ).map((service) => [
      `${service.equipmentType.name}:${service.kind}`,
      service.id,
    ]),
  );

  let counter = 0;
  let created = 0;
  const createTicket = async (input: {
    type: TicketType;
    status: TicketStatus;
    priority: TicketPriority;
    unit: (typeof equipment)[number];
    fault?: string;
    party?: string;
    pmServiceId?: string;
    checklist: ChecklistTemplate[] | null;
  }) => {
    const index = counter++;
    const ticketNo = `DMY-TKT-${String(index + 1).padStart(3, '0')}`;
    if (
      await prisma.ticket.findUnique({
        where: { ticketNo },
        select: { id: true },
      })
    )
      return;
    const { status, checklist } = input;
    const createdAt = daysAgo(20 - (index % 18));
    const engineer = status === TicketStatus.OPEN ? null : engineerFor(index);
    const done = reached(status, TicketStatus.AWAITING_VERIFICATION);
    const started = reached(status, TicketStatus.IN_PROGRESS);
    const applicable = (checklist ?? []).filter(
      (item) => item.applicable !== false,
    );
    const checkedUpTo = done
      ? applicable.length
      : started
        ? Math.ceil(applicable.length * (0.35 + (index % 4) * 0.15))
        : 0;
    const checkedLabels = new Set(
      applicable.slice(0, checkedUpTo).map((item) => item.sortOrder),
    );
    const at = (hours: number) =>
      new Date(createdAt.getTime() + hours * 3600000);
    const history: Prisma.TicketHistoryUncheckedCreateWithoutTicketInput[] = [
      {
        actorId: creator.id,
        label: `Ticket created — ${ticketTypeLabel[input.type]}`,
        createdAt,
      },
    ];
    if (engineer)
      history.push({
        actorId: creator.id,
        label: `Assigned to ${engineer.name}`,
        createdAt: at(2),
      });
    if (started && engineer)
      history.push({
        actorId: engineer.id,
        label: 'Work started',
        createdAt: at(20),
      });
    if (status === TicketStatus.AWAITING_PARTS && engineer)
      history.push({
        actorId: engineer.id,
        label: `Parts request created — DMY-REQ-${ticketNo.slice(-3)}`,
        createdAt: at(26),
      });
    if (done && engineer)
      history.push({
        actorId: engineer.id,
        label: 'Submitted for verification',
        createdAt: at(52),
      });
    if (status === TicketStatus.CLOSED)
      history.push({
        actorId: creator.id,
        label: 'Ticket verified and closed',
        createdAt: at(60),
      });

    const dueDate =
      status === TicketStatus.CLOSED
        ? at(72)
        : new Date(Date.now() + ((index % 7) - 2) * DAY);
    await prisma.ticket.create({
      data: {
        ticketNo,
        serviceType: input.type,
        pmServiceId: input.pmServiceId,
        equipmentId: input.unit.id,
        faultDescription: input.fault,
        priority: input.priority,
        status,
        dueDate,
        createdAt,
        requestingParty: input.party,
        createdByUserId: creator.id,
        assignedEngineerId: engineer?.id,
        closedDate: status === TicketStatus.CLOSED ? at(60) : undefined,
        downtimeHours: status === TicketStatus.CLOSED ? 60 : undefined,
        maintenanceRecord: {
          create: {
            problemDescription: input.fault,
            partsUsed: started ? parts[index % parts.length] : undefined,
            labourHours: done ? 3 + (index % 5) : started ? 1.5 : 0,
            functionalTestPassed: done ? true : undefined,
            safetyCheckPassed: done ? true : undefined,
            checklistItems: {
              create: (checklist ?? []).map(
                ({
                  category,
                  label,
                  sortOrder,
                  applicable: isApplicable = true,
                }) => ({
                  category,
                  label,
                  sortOrder,
                  applicable: isApplicable,
                  checked: isApplicable && checkedLabels.has(sortOrder),
                }),
              ),
            },
          },
        },
        history: { create: history },
        ...(done && engineer
          ? {
              feedback: {
                create: {
                  authorUserId: engineer.id,
                  createdAt: at(51),
                  bodyHtml: `<p>${input.fault ?? 'Scheduled service'} completed on <b>${input.unit.assetNo}</b>.</p><ul><li>All applicable inspection items checked</li><li>Replaced: ${parts[index % parts.length]}</li><li>Functional and safety tests passed</li></ul>`,
                },
              },
            }
          : {}),
        ...(status === TicketStatus.AWAITING_PARTS && engineer
          ? {
              requests: {
                create: {
                  requestNo: `DMY-REQ-${ticketNo.slice(-3)}`,
                  equipmentId: input.unit.id,
                  item: requestItems[index % requestItems.length],
                  quantity: 1 + (index % 3),
                  reason:
                    'Worn part found during inspection; required to complete the service.',
                  status: RequestStatus.PENDING,
                  requestedById: engineer.id,
                  createdAt: at(26),
                },
              },
            }
          : {}),
      },
    });
    created++;
  };

  for (const [
    typeIndex,
    typeName,
  ] of FIXED_CHECKLIST_EQUIPMENT_TYPES.entries()) {
    for (const [serviceIndex, service] of services.entries()) {
      const unit = equipment[typeIndex * 2 + (serviceIndex % 2)];
      await createTicket({
        type: service.kind as TicketType,
        status: statusCycle[(typeIndex + serviceIndex) % statusCycle.length],
        priority: [
          TicketPriority.MEDIUM,
          TicketPriority.HIGH,
          TicketPriority.LOW,
        ][serviceIndex % 3],
        unit,
        fault: `${service.name} preventive maintenance — ${service.months ? `${service.months}-month visual check` : `${service.maxHours} hour service`}`,
        pmServiceId: serviceIds.get(`${typeName}:${service.kind}`),
        checklist: checklistCatalog,
      });
    }
  }
  for (const [index, ticket] of manualTickets.entries()) {
    await createTicket({
      type: ticket.type,
      status: ticket.status,
      priority: ticket.priority,
      unit: equipment[(index * 5) % equipment.length],
      fault: ticket.fault,
      party: ticket.party,
      checklist: null,
    });
  }

  console.log(
    `Dummy data ready: ${equipment.length} equipment, ${created} new tickets (primary engineer: ${primary.email}).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

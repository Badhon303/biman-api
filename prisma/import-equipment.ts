import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EquipmentStatus,
  Prisma,
  PrismaClient,
  ServiceKind,
} from '@prisma/client';
import equipmentRows from './data/biman-equipment-2026-09-22.json';

let prisma: PrismaClient;

function loadLocalEnvironment() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].replace(/^(?:"(.*)"|'(.*)')$/, (_, double, single) => double ?? single);
    process.env[match[1]] = value;
  }
}

type SourceRow = {
  equipmentGroup: string;
  tldSerialNo: string;
  model: string;
  manufacturerLocation: string;
  actualGtDate: string | null;
  shipDate: string | null;
  sourceStatus: string;
  bimanSerialNo: string | null;
  previousHourMeter: number | null;
  currentHourMeter: number | null;
  engineModel: string | null;
  engineSerialNo: string | null;
};

const typeByGroup: Record<string, string> = {
  'Aircraft air conditioning units (ACU)': 'ACU',
  'Aircraft Towbarless Push-Back Tractor (PBTT)': 'Push Back',
  'Aircraft hi-lift catering Van': 'Hi Lift Van',
  'Aircraft Water Cart/ Flush Cart': 'Water Cart / Flush Cart',
  'Aircraft Air Start Unit   (ASU)': 'ASU',
  'Aircraft Ground Power Unit (GPU)': 'GPU',
  'Aircraft Pallet Transporter    (TF-7-GR)': 'CPT TF-7',
  'Aircraft Belt Loader   (NBL)': 'Belt Loader',
};

const services = [
  { name: 'F-Service', kind: ServiceKind.F_SERVICE, minHours: 0, maxHours: 500 },
  { name: 'B-Service', kind: ServiceKind.B_SERVICE, minHours: 500, maxHours: 1000 },
  { name: 'C-Service', kind: ServiceKind.C_SERVICE, minHours: 1000, maxHours: 2000 },
  { name: 'D-Service', kind: ServiceKind.D_SERVICE, minHours: 2000, maxHours: 2500 },
  { name: 'E-Service', kind: ServiceKind.E_SERVICE, minHours: 2500, maxHours: 3000 },
  { name: 'V-Service', kind: ServiceKind.V_SERVICE, months: 6 },
] as const;

function asDate(value: string | null) {
  if (!value || value.startsWith('0000-')) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid source date: ${value}`);
  }
  return date;
}

function statusFor(sourceStatus: string) {
  return sourceStatus.trim().toUpperCase() === 'COMMISIONED' ||
    sourceStatus.trim().toUpperCase() === 'COMMISSIONED'
    ? EquipmentStatus.AVAILABLE
    : EquipmentStatus.INACTIVE;
}

function sourceSpecifications(row: SourceRow) {
  return [
    { label: 'Manufacturer Location', value: row.manufacturerLocation },
    ...(row.previousHourMeter === null
      ? []
      : [{ label: 'Previous Hour Meter', value: String(row.previousHourMeter) }]),
  ];
}

async function ensureEquipmentType(tx: Prisma.TransactionClient, name: string) {
  const type = await tx.equipmentType.upsert({
    where: { name },
    update: { deletedAt: null },
    create: { name },
    include: { services: true },
  });

  const existingKinds = new Set(type.services.map((service) => service.kind));
  const missing = services.filter((service) => !existingKinds.has(service.kind));
  if (missing.length) {
    await tx.equipmentTypeService.createMany({
      data: missing.map((service, index) => ({
        equipmentTypeId: type.id,
        ...service,
        sortOrder: type.services.length + index,
      })),
    });
  }
  return type.id;
}

async function nextAssetNo(tx: Prisma.TransactionClient) {
  const records = await tx.equipment.findMany({
    where: { assetNo: { startsWith: 'BGM-' } },
    select: { assetNo: true },
  });
  const next = records.reduce((highest, { assetNo }) => {
    const match = /^BGM-(\d+)$/.exec(assetNo);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;
  return `BGM-${String(next).padStart(3, '0')}`;
}

async function importRows() {
  const rows = equipmentRows as SourceRow[];
  const groups = new Set(rows.map((row) => row.equipmentGroup));
  const unsupported = [...groups].filter((group) => !typeByGroup[group]);
  if (unsupported.length) {
    throw new Error(`Unmapped equipment groups: ${unsupported.join(', ')}`);
  }

  const serials = rows.map((row) => row.tldSerialNo);
  if (new Set(serials).size !== serials.length) {
    throw new Error('Duplicate TLD serial numbers found in the source file.');
  }

  let created = 0;
  let updated = 0;
  for (const row of rows) {
    await prisma.$transaction(async (tx) => {
      const equipmentTypeId = await ensureEquipmentType(
        tx,
        typeByGroup[row.equipmentGroup],
      );
      const existing = await tx.equipment.findMany({
        where: { tldSerialNo: row.tldSerialNo },
        select: { id: true, assetNo: true },
        take: 2,
      });
      if (existing.length > 1) {
        throw new Error(`More than one existing record has TLD serial ${row.tldSerialNo}.`);
      }

      const data = {
        equipmentTypeId,
        manufacturer: 'TLD',
        model: row.model,
        location: row.manufacturerLocation.trim() || 'Not specified',
        bimanSerialNo: row.bimanSerialNo,
        tldSerialNo: row.tldSerialNo,
        status: statusFor(row.sourceStatus),
        hourMeter: row.currentHourMeter ?? 0,
        actualGtDate: asDate(row.actualGtDate),
        shipDate: asDate(row.shipDate),
        shippingStatus: row.sourceStatus,
        engineModel: row.engineModel,
        engineSerialNo: row.engineSerialNo,
        deletedAt: null,
      };

      if (existing[0]) {
        await tx.equipment.update({ where: { id: existing[0].id }, data });
        await tx.equipmentSpecification.deleteMany({
          where: {
            equipmentId: existing[0].id,
            label: { in: ['Manufacturer Location', 'Previous Hour Meter'] },
          },
        });
        await tx.equipmentSpecification.createMany({
          data: sourceSpecifications(row).map((specification) => ({
            equipmentId: existing[0].id,
            ...specification,
          })),
        });
        updated++;
      } else {
        const assetNo = await nextAssetNo(tx);
        await tx.equipment.create({
          data: {
            ...data,
            assetNo,
            specifications: { create: sourceSpecifications(row) },
          },
        });
        created++;
      }
    });
  }

  console.log(JSON.stringify({ rows: rows.length, created, updated }));
}

loadLocalEnvironment();
prisma = new PrismaClient();

importRows()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

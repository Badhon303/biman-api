import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import equipmentRows from './data/biman-equipment-2026-09-22.json';

type SourceRow = {
  tldSerialNo: string;
  manufacturerLocation: string;
};

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

async function main() {
  loadLocalEnvironment();
  const prisma = new PrismaClient();
  try {
    const rows = equipmentRows as SourceRow[];
    const serials = rows.map((row) => row.tldSerialNo);
    if (new Set(serials).size !== serials.length) {
      throw new Error('Duplicate TLD serial numbers found in the source file.');
    }
    if (rows.some((row) => !row.manufacturerLocation?.trim())) {
      throw new Error('A source row has no Man Location value.');
    }

    const existing = await prisma.equipment.findMany({
      where: { deletedAt: null, tldSerialNo: { in: serials } },
      select: { id: true, tldSerialNo: true },
    });
    const bySerial = new Map<string, string>();
    for (const item of existing) {
      if (!item.tldSerialNo) continue;
      if (bySerial.has(item.tldSerialNo)) {
        throw new Error(`More than one active equipment record has TLD serial ${item.tldSerialNo}.`);
      }
      bySerial.set(item.tldSerialNo, item.id);
    }

    const unmatched = rows.filter((row) => !bySerial.has(row.tldSerialNo));
    if (unmatched.length) {
      throw new Error(`No active equipment record found for ${unmatched.length} source TLD serial(s): ${unmatched.slice(0, 10).map((row) => row.tldSerialNo).join(', ')}`);
    }

    let updated = 0;
    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        const result = await tx.equipment.update({
          where: { id: bySerial.get(row.tldSerialNo)! },
          data: { location: row.manufacturerLocation.trim() },
        });
        if (result.location === row.manufacturerLocation.trim()) updated++;
      }
    }, { maxWait: 30_000, timeout: 60_000 });
    console.log(JSON.stringify({ matched: rows.length, updated }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

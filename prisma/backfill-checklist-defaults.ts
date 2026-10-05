import { PrismaClient, ServiceKind } from '@prisma/client';
import { checklistCatalogFor } from '../src/common/fixed-checklists';

const prisma = new PrismaClient();

async function main() {
  let updated = 0;
  for (const serviceType of [ServiceKind.B_SERVICE, ServiceKind.V_SERVICE]) {
    for (const item of checklistCatalogFor(serviceType)) {
      const result = await prisma.checklistTemplateItem.updateMany({
        where: {
          serviceType,
          category: item.category,
          label: item.label,
          enabled: false,
        },
        data: { enabled: true },
      });
      updated += result.count;
    }
  }
  console.log(`Enabled ${updated} B-Service and V-Service checklist items.`);
}

main().finally(() => prisma.$disconnect());

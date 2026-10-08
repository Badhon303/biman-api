import { PrismaClient } from '@prisma/client';
import { ChecklistTemplate } from './checklist-templates';

type Db = Pick<PrismaClient, 'inspectionChecklistCategory'>;

export async function loadChecklistCatalog(
  db: Db,
): Promise<ChecklistTemplate[]> {
  const categories = await db.inspectionChecklistCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
    },
  });
  return categories
    .flatMap((category) =>
      category.items.map((item) => ({
        category: category.name,
        label: item.label,
      })),
    )
    .map((item, sortOrder) => ({ ...item, sortOrder, applicable: true }));
}

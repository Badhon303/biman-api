export type ChecklistTemplate = {
  category: string;
  label: string;
  sortOrder: number;
  applicable?: boolean;
  enabled?: boolean;
};

export function applyChecklistSettings(
  templates: ChecklistTemplate[],
  settings: ChecklistTemplate[],
): ChecklistTemplate[] {
  const enabledByItem = new Map(
    settings.map((item) => [
      `${item.category}\u0000${item.label}`,
      item.enabled ?? true,
    ]),
  );
  return templates.map((item) => ({
    ...item,
    enabled: enabledByItem.get(`${item.category}\u0000${item.label}`) ?? true,
  }));
}

export const toChecklistItems = (templates: ChecklistTemplate[]) =>
  templates
    .filter(({ enabled = true }) => enabled)
    .map(({ category, label, sortOrder }) => ({
      category,
      label,
      sortOrder,
      applicable: true,
    }));

import { EquipmentTypeService } from '@prisma/client';

export type HourBand = Pick<
  EquipmentTypeService,
  'id' | 'minHours' | 'maxHours'
>;

export function crossedHourBands<T extends HourBand>(
  services: T[],
  previousValue: number,
  currentValue: number,
  checkedKeys: Set<string>,
) {
  return services.filter((service) => {
    const threshold = service.maxHours ?? service.minHours;
    return (
      threshold !== null &&
      threshold !== undefined &&
      threshold > previousValue &&
      threshold <= currentValue &&
      !checkedKeys.has(`${service.id}:${threshold}`)
    );
  });
}

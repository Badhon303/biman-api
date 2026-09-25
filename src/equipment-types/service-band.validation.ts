import { BadRequestException } from '@nestjs/common';
import { ServiceKind } from '@prisma/client';
import { EquipmentTypeServiceDto } from './equipment-types.dto';
import { serviceKindFromName } from '../common/enum-mappers';

export function validateServiceBands(
  services: EquipmentTypeServiceDto[],
): void {
  const calendar = services.filter(
    (service) => serviceKindFromName(service.name) === ServiceKind.V_SERVICE,
  );
  if (calendar.length > 1)
    throw new BadRequestException(
      'An equipment type can have only one V-Service.',
    );
  for (const service of calendar) {
    if (
      service.months !== 6 ||
      service.minHours !== undefined ||
      service.maxHours !== undefined
    ) {
      throw new BadRequestException(
        'V-Service must use a six-month interval and cannot define hour bands.',
      );
    }
  }

  const bands = services
    .filter(
      (service) => serviceKindFromName(service.name) !== ServiceKind.V_SERVICE,
    )
    .sort((left, right) => (left.minHours ?? -1) - (right.minHours ?? -1));
  for (const service of bands) {
    if (service.months !== undefined)
      throw new BadRequestException(
        `${service.name} must use an hour band, not a calendar interval.`,
      );
  }
  const standardKinds = new Set<ServiceKind>();
  for (const service of bands) {
    const kind = serviceKindFromName(service.name);
    if (kind !== ServiceKind.OTHERS && standardKinds.has(kind)) {
      throw new BadRequestException(
        `${service.name} can only be defined once per equipment type.`,
      );
    }
    if (kind !== ServiceKind.OTHERS) standardKinds.add(kind);
  }
  if (!bands.length)
    throw new BadRequestException(
      'At least one hour-band service is required.',
    );
  if (bands[0].minHours !== 0) {
    throw new BadRequestException(`${bands[0].name} must start at 0h.`);
  }
  bands.forEach((band, index) => {
    if (
      band.minHours === undefined ||
      (band.maxHours !== undefined && band.minHours >= band.maxHours)
    ) {
      throw new BadRequestException(
        `${band.name} must have minHours less than maxHours.`,
      );
    }
    if (band.maxHours === undefined && index !== bands.length - 1) {
      throw new BadRequestException(
        `Only the final hour band may have an open-ended maxHours (${band.name}).`,
      );
    }
    const next = bands[index + 1];
    if (next && band.maxHours !== next.minHours) {
      throw new BadRequestException(
        `${band.name} ends at ${band.maxHours ?? 'open'}h but ${next.name} starts at ${next.minHours ?? 'unset'}h; bands must be contiguous.`,
      );
    }
  });
}

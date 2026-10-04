import { EquipmentTypeService, NotificationEntity } from '@prisma/client';

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

export function serviceTicketNotificationData(
  tickets: { id: string; ticketNo: string }[],
  recipients: { id: string }[],
  assetNo: string,
) {
  return tickets.flatMap((ticket) =>
    recipients.map(({ id: userId }) => ({
      userId,
      type: 'Ticket created',
      message: `${ticket.ticketNo} was generated for ${assetNo} after an hour-meter service threshold was crossed.`,
      entityType: NotificationEntity.TICKET,
      entityId: ticket.id,
    })),
  );
}

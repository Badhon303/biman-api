import { NotificationEntity } from '@prisma/client';
import {
  crossedHourBands,
  serviceTicketNotificationData,
} from './service-check.logic';

describe('crossedHourBands', () => {
  const services = [
    { id: 'f', minHours: 0, maxHours: 500 },
    { id: 'b', minHours: 500, maxHours: 1000 },
    { id: 'custom', minHours: 1000, maxHours: null },
  ];

  it('returns every threshold crossed by a large meter jump in order', () => {
    expect(
      crossedHourBands(services, 250, 1100, new Set()).map((item) => item.id),
    ).toEqual(['f', 'b', 'custom']);
  });

  it('includes a threshold equal to the current meter reading', () => {
    expect(
      crossedHourBands(services, 250, 500, new Set()).map((item) => item.id),
    ).toEqual(['f']);
  });

  it('does not include the previous value or an unchecked future band', () => {
    expect(
      crossedHourBands(services, 500, 900, new Set()).map((item) => item.id),
    ).toEqual([]);
  });

  it('does not return a previously checked threshold', () => {
    expect(
      crossedHourBands(services, 250, 1100, new Set(['b:1000'])).map(
        (item) => item.id,
      ),
    ).toEqual(['f', 'custom']);
  });

  it('creates one ticket-linked notification per generated ticket and recipient', () => {
    expect(
      serviceTicketNotificationData(
        [
          { id: 'ticket-1', ticketNo: 'TKT-1' },
          { id: 'ticket-2', ticketNo: 'TKT-2' },
        ],
        [{ id: 'admin-1' }, { id: 'manager-1' }],
        'EQ-1',
      ),
    ).toEqual([
      {
        userId: 'admin-1',
        type: 'Ticket created',
        message:
          'TKT-1 was generated for EQ-1 after an hour-meter service threshold was crossed.',
        entityType: NotificationEntity.TICKET,
        entityId: 'ticket-1',
      },
      {
        userId: 'manager-1',
        type: 'Ticket created',
        message:
          'TKT-1 was generated for EQ-1 after an hour-meter service threshold was crossed.',
        entityType: NotificationEntity.TICKET,
        entityId: 'ticket-1',
      },
      {
        userId: 'admin-1',
        type: 'Ticket created',
        message:
          'TKT-2 was generated for EQ-1 after an hour-meter service threshold was crossed.',
        entityType: NotificationEntity.TICKET,
        entityId: 'ticket-2',
      },
      {
        userId: 'manager-1',
        type: 'Ticket created',
        message:
          'TKT-2 was generated for EQ-1 after an hour-meter service threshold was crossed.',
        entityType: NotificationEntity.TICKET,
        entityId: 'ticket-2',
      },
    ]);
  });
});

import { NotificationEntity } from '@prisma/client';
import {
  crossedHourBands,
  initialHourBands,
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

  it('initialHourBands returns every unchecked band the meter has entered', () => {
    expect(
      initialHourBands(services, 600, new Set(['f:500'])).map((i) => i.id),
    ).toEqual(['b']);
    expect(initialHourBands(services, 500, new Set()).map((i) => i.id)).toEqual(
      ['f', 'b'],
    );
  });

  it('initialHourBands creates every band up to the cycle end when bands are skipped', () => {
    const full = [
      { id: 'f', minHours: 0, maxHours: 500 },
      { id: 'b', minHours: 500, maxHours: 1000 },
      { id: 'e', minHours: 2000, maxHours: 2500 },
    ];
    expect(initialHourBands(full, 2500, new Set()).map((i) => i.id)).toEqual([
      'f',
      'b',
      'e',
    ]);
    expect(
      initialHourBands(full, 2500, new Set(['f:500', 'b:1000'])).map(
        (i) => i.id,
      ),
    ).toEqual(['e']);
  });

  it('initialHourBands allows the same band again once the full cycle is complete', () => {
    const full = [
      { id: 'f', minHours: 0, maxHours: 500 },
      { id: 'e', minHours: 500, maxHours: 1000 },
    ];
    const done = new Set(['f:500', 'e:1000']);
    expect(initialHourBands(full, 1000, done)).toEqual([]);
    expect(initialHourBands(full, 1200, done)).toEqual([
      { id: 'f', minHours: 0, maxHours: 500, threshold: 1500 },
    ]);
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

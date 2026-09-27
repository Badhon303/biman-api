import {
  addMonthsClamped,
  isScheduleDue,
  scheduleStatusFor,
} from './schedule-logic';

describe('V-Service schedule logic', () => {
  it('creates a due ticket only once the schedule date arrives', () => {
    const dueDate = new Date('2026-09-27T00:00:00.000Z');
    expect(isScheduleDue(dueDate, new Date('2026-09-26T23:59:59.999Z'))).toBe(
      false,
    );
    expect(isScheduleDue(dueDate, dueDate)).toBe(true);
    expect(isScheduleDue(dueDate, new Date('2026-09-28T00:00:00.000Z'))).toBe(
      true,
    );
  });

  it('clamps month-end dates when advancing by six months', () => {
    expect(addMonthsClamped(new Date('2026-08-31T12:30:00.000Z'), 6)).toEqual(
      new Date('2027-02-28T12:30:00.000Z'),
    );
  });

  it('calculates the next schedule status using the new due date', () => {
    const now = new Date('2026-09-27T00:00:00.000Z');
    expect(scheduleStatusFor(new Date('2026-10-12T00:00:00.000Z'), now)).toBe(
      'DUE_SOON',
    );
    expect(scheduleStatusFor(new Date('2026-10-13T00:00:00.000Z'), now)).toBe(
      'SCHEDULED',
    );
    expect(scheduleStatusFor(now, new Date(now.getTime() + 1))).toBe('OVERDUE');
  });
});

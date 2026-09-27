export type ScheduleStatus = 'SCHEDULED' | 'DUE_SOON' | 'OVERDUE';

export function addMonthsClamped(date: Date, months: number) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const day = Math.min(
    date.getUTCDate(),
    new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate(),
  );
  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

export function isScheduleDue(dueDate: Date, now: Date) {
  return dueDate.getTime() <= now.getTime();
}

export function scheduleStatusFor(
  dueDate: Date,
  now = new Date(),
): ScheduleStatus {
  const daysLeft = (dueDate.getTime() - now.getTime()) / 86400000;
  if (daysLeft < 0) return 'OVERDUE';
  if (daysLeft <= 15) return 'DUE_SOON';
  return 'SCHEDULED';
}

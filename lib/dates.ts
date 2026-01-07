export function addBusinessDays(start: Date, days: number) {
  const result = new Date(start);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }
  return result;
}

export function businessDaysBetween(start: Date, end: Date) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  let count = 0;
  const direction = startDate <= endDate ? 1 : -1;
  while (startDate.toDateString() !== endDate.toDateString()) {
    startDate.setDate(startDate.getDate() + direction);
    const day = startDate.getDay();
    if (day !== 0 && day !== 6) {
      count += direction;
    }
  }
  return count;
}

export function differenceInCalendarDays(start: Date, end: Date) {
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diffMs = endDay.getTime() - startDay.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function addBusinessDays(
  start: Date | string,
  businessDays: number,
): Date {
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid start date.");
  }

  let added = 0;

  while (added < businessDays) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) {
      added += 1;
    }
  }

  return date;
}

export function calculateBusinessDeadline(
  start: Date | string,
  businessDays = 3,
): string {
  const deadline = addBusinessDays(start, businessDays);
  return deadline.toISOString().slice(0, 10);
}

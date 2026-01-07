export const vacancyCountMode =
  (process.env.NEXT_PUBLIC_VACANCY_COUNT_MODE ?? 'calendar') === 'business'
    ? 'business'
    : 'calendar';

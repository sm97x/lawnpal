const DAY_MS = 24 * 60 * 60 * 1000;

export const addDays = (isoDate: string, days: number): string => {
  const date = new Date(isoDate);
  return new Date(date.getTime() + days * DAY_MS).toISOString();
};

export const startOfDayIso = (isoDate: string): string => {
  const date = new Date(isoDate);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
};

export const sameDayKey = (isoDate: string): string =>
  new Date(isoDate).toISOString().slice(0, 10);

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const average = (values: number[]): number =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export const makeId = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

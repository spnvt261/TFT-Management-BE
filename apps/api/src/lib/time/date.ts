export function nowIso(): string {
  return new Date().toISOString();
}

export function parseDate(value: string): Date {
  return new Date(value);
}

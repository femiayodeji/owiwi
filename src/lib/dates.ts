// All dates in Owiwi are device-local calendar dates formatted as YYYY-MM-DD.

const pad = (n: number): string => String(n).padStart(2, '0');

export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parses YYYY-MM-DD as a local-midnight Date. */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: string, days: number): string {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + days);
  return localDate(d);
}

/** Parses "HH:MM" (24h). Returns null if malformed. */
export function parseTime(hhmm: string): { hours: number; minutes: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function timeToMinutes(hhmm: string): number | null {
  const t = parseTime(hhmm);
  return t ? t.hours * 60 + t.minutes : null;
}

/** Local Date for a given YYYY-MM-DD at HH:MM. */
export function atTime(date: string, hhmm: string): Date | null {
  const t = parseTime(hhmm);
  if (!t) return null;
  const d = parseLocalDate(date);
  d.setHours(t.hours, t.minutes, 0, 0);
  return d;
}

export function formatTime(hhmm: string): string {
  const t = parseTime(hhmm);
  if (!t) return hhmm;
  return `${pad(t.hours)}:${pad(t.minutes)}`;
}

/** "5m ago", "3h ago", "2d ago". Returns null for unparseable input. */
export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const diff = Math.max(0, now.getTime() - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

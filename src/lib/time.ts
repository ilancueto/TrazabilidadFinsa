const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

export function toArgentinaParts(date: Date) {
  const ar = new Date(date.getTime() - AR_OFFSET_MS);
  return {
    year: ar.getUTCFullYear(),
    month: ar.getUTCMonth() + 1,
    day: ar.getUTCDate(),
    hour: ar.getUTCHours(),
    minute: ar.getUTCMinutes(),
  };
}

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function todayYmdAR(now = new Date()): string {
  const parts = toArgentinaParts(now);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function isValidYmd(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00-03:00`);
  if (Number.isNaN(date.getTime())) return false;
  const parts = toArgentinaParts(date);
  return parts.year === Number(match[1]) && parts.month === Number(match[2]) && parts.day === Number(match[3]);
}

export function formatOperationalDateTime(date = new Date()): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function argentinaDayBounds(dateYmd: string): { start: Date; end: Date } {
  const start = new Date(`${dateYmd}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function parseDueInput(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const withSeconds = raw.length === 16 ? `${raw}:00` : raw;
  const datePart = withSeconds.slice(0, 10);
  if (!isValidYmd(datePart)) return null;
  const dated = new Date(`${withSeconds}-03:00`);
  if (Number.isNaN(dated.getTime())) return null;
  return dated.toISOString();
}

export function toDueInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = toArgentinaParts(new Date(iso));
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function isOverdue(
  dueAt: string | null | undefined,
  status: string,
  now = new Date(),
): boolean {
  if (!dueAt || status === "CLOSED" || status === "DRAFT") return false;
  return new Date(dueAt).getTime() < now.getTime();
}

export function formatDueLabel(
  dueAt: string | null | undefined,
  status: string,
  now = new Date(),
): string | null {
  if (!dueAt) return null;
  if (isOverdue(dueAt, status, now)) return "Vencida";
  const parts = toArgentinaParts(new Date(dueAt));
  const ymd = `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
  const time = `${pad2(parts.hour)}:${pad2(parts.minute)}`;
  if (ymd === todayYmdAR(now)) return `Vence ${time}`;
  return `Vence ${parts.day}/${parts.month} ${time}`;
}

export function minutesBetween(from: string | null | undefined, to: string | null | undefined): number | null {
  if (!from || !to) return null;
  const diff = (new Date(to).getTime() - new Date(from).getTime()) / 60000;
  if (!Number.isFinite(diff) || diff < 0) return null;
  return Math.round(diff);
}

export function formatMinutes(value: number | null): string {
  if (value === null) return "—";
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

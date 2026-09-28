// Date helpers for Asia/Tashkent (UTC+5, no DST). Timestamps are stored in UTC,
// while users think in Tashkent calendar days.

const TASHKENT_OFFSET = "+05:00";
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * Parses a `from`/`to` query value as Tashkent time.
 * - `YYYY-MM-DD` -> start of the Tashkent day (or end of it with `endOfDay`).
 * - `YYYY-MM-DDTHH:mm[:ss[.SSS]]` without a zone -> treated as Tashkent time.
 * - Values with an explicit zone (Z / +hh:mm) are used as-is.
 * Returns undefined for empty or invalid input.
 */
export function parseDateParam(
  value: string | undefined | null,
  opts: { endOfDay?: boolean } = {}
): Date | undefined {
  if (!value) return undefined;
  const v = value.trim();
  if (!v) return undefined;

  let iso: string;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    iso = opts.endOfDay ? `${v}T23:59:59.999${TASHKENT_OFFSET}` : `${v}T00:00:00${TASHKENT_OFFSET}`;
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v)) {
    iso = `${v}${TASHKENT_OFFSET}`;
  } else {
    iso = v;
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Formats a Date as `YYYY-MM-DD` in Tashkent time. */
export function tashkentDateString(d: Date = new Date()): string {
  return new Date(d.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Start of the current Tashkent month as a Date (UTC instant). */
export function startOfTashkentMonth(now: Date = new Date()): Date {
  const day = tashkentDateString(now);
  return parseDateParam(`${day.slice(0, 8)}01`)!;
}

/** Formats a Date as `YYYY-MM-DD HH:mm` in Tashkent time (for Excel exports). */
export function formatTashkentDateTime(d: Date): string {
  const s = new Date(d.getTime() + TASHKENT_OFFSET_MS).toISOString();
  return `${s.slice(0, 10)} ${s.slice(11, 16)}`;
}

/** Formats a Date as `YYYY-MM-DD` in Tashkent time (for Excel exports). */
export function formatTashkentDate(d: Date): string {
  return tashkentDateString(d);
}

/** Shifts a Tashkent day string (`YYYY-MM-DD`) by N days. */
export function shiftDayString(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Hijri dates for the fasting tracker.
 * Uses the Umm al-Qura calendar through Intl when the runtime supports it, otherwise the tabular
 * (arithmetical) Islamic calendar. Either way the start of a month can differ by a day or two from
 * the local moon-sighting announcement, so users can shift the calendar by −2…+2 days.
 */
import { addDays } from './dates';

export interface HijriDate {
  y: number;
  m: number; // 1–12
  d: number; // 1–30
}

const DAY = 86400000;
const toUTC = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** Tabular Islamic calendar (civil epoch, 30-year cycle). */
export function hijriTabular(date: string): HijriDate {
  const jd = Math.floor(toUTC(date) / DAY) + 2440588;
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const m = Math.floor((24 * l) / 709);
  const d = l - Math.floor((709 * m) / 24);
  return { y: 30 * n + j - 30, m, d };
}

let fmt: Intl.DateTimeFormat | null | undefined;
function umalquraFormatter(): Intl.DateTimeFormat | null {
  if (fmt !== undefined) return fmt;
  try {
    const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });
    // Sanity check against a known date: 1 Ramadan 1447 = 18 Feb 2026 (Umm al-Qura).
    const p = f.formatToParts(new Date(Date.UTC(2026, 1, 18)));
    const ok = p.find((x) => x.type === 'month')?.value === '9' && p.find((x) => x.type === 'day')?.value === '1';
    fmt = ok ? f : null;
  } catch {
    fmt = null;
  }
  return fmt;
}

export function hijriUmmAlQura(date: string): HijriDate | null {
  const f = umalquraFormatter();
  if (!f) return null;
  const p = f.formatToParts(new Date(toUTC(date)));
  const num = (t: string) => Number((p.find((x) => x.type === t)?.value ?? '').replace(/\D/g, ''));
  const y = num('year') || num('relatedYear');
  const m = num('month');
  const d = num('day');
  return y && m && d ? { y, m, d } : null;
}

export type HijriSource = 'umalqura' | 'tabular';
export const hijriSource = (): HijriSource => (umalquraFormatter() ? 'umalqura' : 'tabular');

/** Hijri date of a Gregorian YYYY-MM-DD, after the user's −2…+2 day adjustment. */
export function toHijri(date: string, offsetDays = 0): HijriDate {
  const d = offsetDays ? addDays(date, offsetDays) : date;
  return hijriUmmAlQura(d) ?? hijriTabular(d);
}

export const hijriKey = (h: Pick<HijriDate, 'y' | 'm'>) => `${h.y}-${String(h.m).padStart(2, '0')}`;

/** All Gregorian dates that fall in Hijri month (y, m) for this offset. */
export function datesOfHijriMonth(y: number, m: number, offsetDays = 0): string[] {
  // Start ~ from a tabular estimate and walk; months are 29–30 days.
  const approxDays = Math.floor((y - 1) * 354.367 + (m - 1) * 29.53 + 1) - 1;
  let probe = addDays('0622-07-19', approxDays);
  for (let i = 0; i < 70; i++) {
    const h = toHijri(probe, offsetDays);
    if (h.y > y || (h.y === y && h.m >= m)) break;
    probe = addDays(probe, 1);
  }
  for (let i = 0; i < 70; i++) {
    const h = toHijri(addDays(probe, -1), offsetDays);
    if (h.y < y || (h.y === y && h.m < m)) break;
    probe = addDays(probe, -1);
  }
  const out: string[] = [];
  for (let d = probe; ; d = addDays(d, 1)) {
    const h = toHijri(d, offsetDays);
    if (h.y !== y || h.m !== m) break;
    out.push(d);
    if (out.length > 31) break;
  }
  return out;
}

export function nextHijriMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = y * 12 + (m - 1) + delta;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
}

export const HIJRI_MONTHS = {
  ar: ['محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة'],
  en: ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Akhir', 'Jumada al-Ula', 'Jumada al-Akhirah', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qa'dah", 'Dhu al-Hijjah'],
};

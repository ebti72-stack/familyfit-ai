import { HIJRI_MONTHS, toHijri } from './hijri';

export function fmtDate(date: string, lang: 'ar' | 'en', opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) {
  try {
    return new Date(date + 'T12:00:00').toLocaleDateString(lang === 'ar' ? 'ar-u-ca-gregory-nu-latn' : 'en-GB', opts);
  } catch {
    return date;
  }
}

export function hijriLabel(date: string, offset: number, lang: 'ar' | 'en') {
  const h = toHijri(date, offset);
  return `${h.d} ${HIJRI_MONTHS[lang][h.m - 1]} ${h.y}`;
}

/** 'all' → '', 'YYYY-MM' (Hijri) → month name + year. */
export function hijriPeriodLabel(key: string, lang: 'ar' | 'en') {
  if (!/^\d{4}-\d{2}$/.test(key)) return '';
  const [y, m] = key.split('-').map(Number);
  return `${HIJRI_MONTHS[lang][m - 1]} ${y}`;
}

/**
 * Smart fasting tracker: schedules, monthly summary and badges.
 * Rules that matter for trust:
 *  - A planned day is never counted as fasted. Only days the user confirmed as completed count.
 *  - Fasting never lowers calorie goals or creates a deficit; it only redistributes meals (suhoor / iftar).
 *  - Fasting goals are never switched on automatically for children, and there is no ranking by fasting days.
 */
import { addDays } from './dates';
import { hijriKey, nextHijriMonth, toHijri, type HijriDate } from './hijri';

export type FastingType = 'three_monthly' | 'mon_thu' | 'ayyam_bid' | 'ramadan' | 'voluntary' | 'custom';
export type FastingStatus = 'planned' | 'fasting' | 'completed' | 'broken';
export type HealthFlag = 'pregnant' | 'breastfeeding' | 'diabetes' | 'medication' | 'chronic' | 'eating_disorder';

export interface FastingProfile {
  memberId: string;
  enabled: boolean;
  type: FastingType;
  /** 0 = Sunday … 6 = Saturday (for 'custom'). */
  daysOfWeek: number[];
  /** Hijri day numbers planned each month (for 'three_monthly'; empty = choose days manually). */
  hijriDays: number[];
  startDate: string | null;
  endDate: string | null;
  suhoorTime: string | null; // HH:MM
  iftarTime: string | null; // HH:MM
  /** Shift the Hijri calendar −2…+2 days to match the local announcement. */
  hijriOffset: number;
  /** Completed days targeted per Hijri month (0 = no goal). */
  monthlyGoal: number;
  joinFamilyChallenge: boolean;
  healthFlags: HealthFlag[];
  /** The member (or the parent for a child) read and accepted the health note. */
  healthAck: boolean;
}

export interface FastingLog {
  id: string;
  memberId: string;
  logDate: string;
  status: FastingStatus;
  hijriYear: number;
  hijriMonth: number;
  hijriDay: number;
  confirmedAt: string | null;
  note: string | null;
}

export interface FastingAchievement {
  memberId: string;
  badge: BadgeCode;
  periodKey: string; // 'all' or a Hijri month key 'YYYY-MM'
  earnedAt: string;
}

export const DEFAULT_GOAL: Record<FastingType, number> = { three_monthly: 3, mon_thu: 8, ayyam_bid: 3, ramadan: 30, voluntary: 0, custom: 0 };

export function defaultFastingProfile(memberId: string): FastingProfile {
  return {
    memberId, enabled: false, type: 'three_monthly', daysOfWeek: [], hijriDays: [13, 14, 15], startDate: null, endDate: null,
    suhoorTime: null, iftarTime: null, hijriOffset: 0, monthlyGoal: 3, joinFamilyChallenge: false, healthFlags: [], healthAck: false,
  };
}

/** Days the schedule plans in [from, to]. Planned ≠ fasted. */
export function plannedDates(p: FastingProfile, from: string, to: string): string[] {
  if (!p.enabled) return [];
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (p.startDate && d < p.startDate) continue;
    if (p.endDate && d > p.endDate) continue;
    const dow = new Date(d + 'T12:00:00').getDay();
    const h = toHijri(d, p.hijriOffset);
    let yes = false;
    switch (p.type) {
      case 'mon_thu': yes = dow === 1 || dow === 4; break;
      case 'ayyam_bid': yes = h.d >= 13 && h.d <= 15; break;
      case 'ramadan': yes = h.m === 9; break;
      case 'three_monthly': yes = p.hijriDays.includes(h.d); break;
      case 'custom': yes = p.daysOfWeek.includes(dow); break;
      case 'voluntary': yes = false; break;
    }
    if (yes) out.push(d);
    if (out.length > 400) break;
  }
  return out;
}

export function makeLog(memberId: string, date: string, status: FastingStatus, offset: number, nowIso: string, id: string): FastingLog {
  const h = toHijri(date, offset);
  return { id, memberId, logDate: date, status, hijriYear: h.y, hijriMonth: h.m, hijriDay: h.d, confirmedAt: status === 'completed' ? nowIso : null, note: null };
}

/** Completion must be a deliberate confirmation for today or a past day. */
export function canConfirmCompletion(date: string, today: string): boolean {
  return date <= today;
}

export interface MonthSummary {
  key: string;
  completed: number;
  planned: number; // planned and not yet completed
  broken: number;
  goal: number;
  remaining: number;
  goalMet: boolean;
}

export function monthSummary(logs: FastingLog[], planned: string[], h: Pick<HijriDate, 'y' | 'm'>, goal: number): MonthSummary {
  const inMonth = logs.filter((l) => l.hijriYear === h.y && l.hijriMonth === h.m);
  const completed = inMonth.filter(isCompleted).length;
  const doneDates = new Set(inMonth.filter((l) => l.status === 'completed' || l.status === 'broken').map((l) => l.logDate));
  const manualPlanned = inMonth.filter((l) => l.status === 'planned').map((l) => l.logDate);
  const plannedOpen = new Set([...planned, ...manualPlanned].filter((d) => !doneDates.has(d)));
  return {
    key: hijriKey(h),
    completed,
    planned: plannedOpen.size,
    broken: inMonth.filter((l) => l.status === 'broken').length,
    goal,
    remaining: Math.max(0, goal - completed),
    goalMet: goal > 0 && completed >= goal,
  };
}

export const isCompleted = (l: FastingLog) => l.status === 'completed' && !!l.confirmedAt;

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------
export type BadgeCode = 'first_fast' | 'three_month' | 'six_month' | 'ten_total' | 'monthly_goal' | 'consistency_3';

export const FASTING_BADGES: { code: BadgeCode; premium?: boolean; icon: string }[] = [
  { code: 'three_month', premium: true, icon: 'moon' },
  { code: 'first_fast', icon: 'sparkles' },
  { code: 'six_month', icon: 'star' },
  { code: 'ten_total', icon: 'ribbon' },
  { code: 'monthly_goal', icon: 'flag' },
  { code: 'consistency_3', icon: 'infinite' },
];

/**
 * Badges earned by a set of logs. Only confirmed completed days count.
 * Returns every (badge, period) pair earned; callers insert the ones not stored yet.
 */
export function earnedBadges(logs: FastingLog[], monthlyGoal: number): { badge: BadgeCode; periodKey: string }[] {
  const done = logs.filter(isCompleted);
  const out: { badge: BadgeCode; periodKey: string }[] = [];
  if (done.length >= 1) out.push({ badge: 'first_fast', periodKey: 'all' });
  if (done.length >= 10) out.push({ badge: 'ten_total', periodKey: 'all' });
  const perMonth = new Map<string, number>();
  done.forEach((l) => {
    const k = hijriKey({ y: l.hijriYear, m: l.hijriMonth });
    perMonth.set(k, (perMonth.get(k) ?? 0) + 1);
  });
  const threeMonths: string[] = [];
  perMonth.forEach((count, key) => {
    if (count >= 3) {
      out.push({ badge: 'three_month', periodKey: key });
      threeMonths.push(key);
    }
    if (count >= 6) out.push({ badge: 'six_month', periodKey: key });
    if (monthlyGoal > 0 && count >= monthlyGoal) out.push({ badge: 'monthly_goal', periodKey: key });
  });
  // Consistency: the 3-days badge in three consecutive Hijri months.
  const set = new Set(threeMonths);
  threeMonths.sort().forEach((k) => {
    const [y, m] = k.split('-').map(Number);
    const p1 = nextHijriMonth(y, m, -1);
    const p2 = nextHijriMonth(y, m, -2);
    if (set.has(hijriKey(p1)) && set.has(hijriKey(p2))) out.push({ badge: 'consistency_3', periodKey: k });
  });
  return out;
}

export function newBadges(logs: FastingLog[], monthlyGoal: number, existing: Pick<FastingAchievement, 'badge' | 'periodKey'>[]) {
  const have = new Set(existing.map((a) => `${a.badge}:${a.periodKey}`));
  return earnedBadges(logs, monthlyGoal).filter((b) => !have.has(`${b.badge}:${b.periodKey}`));
}

// ---------------------------------------------------------------------------
// Safety notes
// ---------------------------------------------------------------------------
export type FastingWarning = 'child' | 'teen' | 'pregnant' | 'breastfeeding' | 'diabetes' | 'medication' | 'chronic' | 'eating_disorder';

export function fastingWarnings(p: Pick<FastingProfile, 'healthFlags'>, role: 'admin' | 'adult' | 'teen' | 'child', age: number | null): FastingWarning[] {
  const w: FastingWarning[] = [];
  if (role === 'child' || (age != null && age < 12)) w.push('child');
  else if (role === 'teen' || (age != null && age < 18)) w.push('teen');
  p.healthFlags.forEach((f) => w.push(f));
  return w;
}

/** Share of the day's (unchanged) energy goal per meal while fasting. */
export const FASTING_SHARE = { suhoor: 0.35, iftar: 0.45, snack: 0.2 } as const;

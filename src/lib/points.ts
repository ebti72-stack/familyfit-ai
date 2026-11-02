import { addDays } from './dates';
import type { Habit, LeaderboardRow, Member, PointsConfig, PointsEntry } from './types';

export const DEFAULT_POINTS: PointsConfig = {
  water_goal: 10,
  steps_goal: 20,
  activity: 20,
  meal_logged: 10,
  sleep_routine: 10,
  weekly_challenge: 50,
};

/** Minutes of logged activity that count as "did an activity today". */
export const ACTIVITY_MIN_MINUTES = 15;

export interface DayFacts {
  waterMl: number;
  waterGoal: number;
  steps: number;
  stepsGoal: number;
  activityMinutes: number;
  mealsLogged: number;
}

/** Habits earned on a day, based only on habits — never on weight, body shape, calories burned or deficit. */
export function earnedHabits(f: DayFacts): Habit[] {
  const out: Habit[] = [];
  if (f.waterGoal > 0 && f.waterMl >= f.waterGoal) out.push('water_goal');
  if (f.mealsLogged > 0) out.push('meal_logged');
  if (f.activityMinutes >= ACTIVITY_MIN_MINUTES) out.push('activity');
  if (f.stepsGoal > 0 && f.steps >= f.stepsGoal) out.push('steps_goal');
  return out;
}

/** Consecutive days (ending today or yesterday) with at least one habit point. */
export function streakFor(dates: Set<string>, today: string): number {
  let d = dates.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (dates.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function buildLeaderboard(members: Member[], points: PointsEntry[], from: string, to: string, today: string): LeaderboardRow[] {
  const rows = members.map((m) => {
    const mine = points.filter((p) => p.memberId === m.id);
    const inRange = mine.filter((p) => p.logDate >= from && p.logDate <= to);
    const allDates = new Set(mine.filter((p) => p.points > 0).map((p) => p.logDate));
    return {
      memberId: m.id,
      displayName: m.displayName,
      avatarEmoji: m.avatarEmoji,
      role: m.role,
      points: inRange.reduce((s, p) => s + p.points, 0),
      activeDays: new Set(inRange.map((p) => p.logDate)).size,
      streak: streakFor(allDates, today),
    };
  });
  return rows.sort((a, b) => b.points - a.points || b.streak - a.streak || a.displayName.localeCompare(b.displayName));
}

/** Competition ranks with ties sharing a place (1, 2, 2, 4). */
export function ranks(rows: LeaderboardRow[]): number[] {
  return rows.map((r, i) => rows.findIndex((x) => x.points === r.points) + 1 || i + 1);
}

export interface Badge {
  code: string;
  emoji: string;
}

export function badgesFor(row: LeaderboardRow, allTimePoints: number): Badge[] {
  const b: Badge[] = [];
  if (row.streak >= 3) b.push({ code: 'streak3', emoji: '🌱' });
  if (row.streak >= 7) b.push({ code: 'streak7', emoji: '🏅' });
  if (allTimePoints >= 100) b.push({ code: 'points100', emoji: '⭐' });
  if (allTimePoints >= 500) b.push({ code: 'points500', emoji: '🏆' });
  return b;
}

// ---------------------------------------------------------------------------
// Activity energy estimate (Compendium of Physical Activities METs) — always labelled as an estimate.
// ---------------------------------------------------------------------------
export const ACTIVITY_METS: Record<string, number> = {
  walking: 3.5,
  running: 9.0,
  cycling: 7.0,
  home_workout: 5.0,
  swimming: 6.0,
  football: 7.0,
  yoga: 2.5,
  family_play: 4.0,
};

export function estimateActivityKcal(type: string, minutes: number, weightKg: number | null): number | null {
  if (!weightKg) return null; // no weight → no estimate rather than a made-up number
  const met = ACTIVITY_METS[type] ?? 4;
  return Math.round(((met * 3.5 * weightKg) / 200) * minutes);
}

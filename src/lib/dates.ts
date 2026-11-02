/** Local calendar date as YYYY-MM-DD (logs are grouped by the user's local day). */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return localDate(d);
}

export type Period = 'day' | 'week' | 'month' | 'all';

/** Inclusive date range for a leaderboard period. Weeks start on Saturday (common in the Gulf region). */
export function periodRange(period: Period, today: string = localDate(), weekStartsOn = 6): [string, string] {
  if (period === 'day') return [today, today];
  if (period === 'all') return ['2000-01-01', today];
  const d = new Date(today + 'T12:00:00');
  if (period === 'week') {
    const diff = (d.getDay() - weekStartsOn + 7) % 7;
    return [addDays(today, -diff), today];
  }
  return [today.slice(0, 8) + '01', today];
}

export function uid(): string {
  // RFC4122 v4 using Math.random — ids only need to be unique per device for local mode.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

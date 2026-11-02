import { useCallback, useEffect, useState } from 'react';
import { backend } from '../backend';
import { addDays, localDate } from '../lib/dates';
import type { BadgeCode, FastingAchievement, FastingLog, FastingProfile, FastingStatus } from '../lib/fasting';
import { toHijri } from '../lib/hijri';
import { useApp } from './app';

export interface FastingState {
  loading: boolean;
  error: string | null;
  profile: FastingProfile | null;
  logs: FastingLog[];
  achievements: FastingAchievement[];
  todayLog: FastingLog | null;
  /** Fasting mode for meal suggestions: only when the member said so for today (never automatic). */
  fastingToday: boolean;
  setDay: (date: string, status: FastingStatus | null) => Promise<{ badge: BadgeCode; periodKey: string }[]>;
  reload: () => Promise<void>;
}

/** A member's fasting profile, ~13 months of logs and achievements. Refetches after any write. */
export function useFasting(memberId: string | null | undefined): FastingState {
  const { version, bump } = useApp();
  const [s, set] = useState<Omit<FastingState, 'setDay' | 'reload' | 'todayLog' | 'fastingToday'>>({ loading: true, error: null, profile: null, logs: [], achievements: [] });
  const today = localDate();

  const load = useCallback(async () => {
    if (!memberId) return;
    try {
      const [profile, logs, achievements] = await Promise.all([
        backend.getFastingProfile(memberId),
        backend.listFastingLogs(memberId, addDays(today, -400), addDays(today, 120)),
        backend.listFastingAchievements(memberId),
      ]);
      set({ loading: false, error: null, profile, logs, achievements });
    } catch (e: any) {
      set((x) => ({ ...x, loading: false, error: e?.message ?? 'error' }));
    }
  }, [memberId, today]);

  useEffect(() => {
    load();
  }, [load, version]);

  const setDay = useCallback(
    async (date: string, status: FastingStatus | null) => {
      if (!memberId) return [];
      const h = toHijri(date, s.profile?.hijriOffset ?? 0);
      await backend.setFastingDay(memberId, date, status, h);
      const fresh = status === 'completed' ? await backend.evaluateFastingBadges(memberId).catch(() => []) : [];
      bump();
      return fresh;
    },
    [memberId, s.profile, bump],
  );

  const todayLog = s.logs.find((l) => l.logDate === today) ?? null;
  return { ...s, todayLog, fastingToday: todayLog?.status === 'fasting' || todayLog?.status === 'completed', setDay, reload: load };
}

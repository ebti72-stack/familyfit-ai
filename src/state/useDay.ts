import { useCallback, useEffect, useState } from 'react';
import { backend } from '../backend';
import { localDate } from '../lib/dates';
import { computeGoals, remainingFor, sumNutrients, ageOn } from '../lib/nutrition';
import { earnedHabits } from '../lib/points';
import type { ActivityLog, DailyGoals, FoodLog, HealthProfile, HydrationLog, Nutrients } from '../lib/types';
import { ZERO } from '../lib/types';
import { useApp } from './app';

export interface DayData {
  loading: boolean;
  error: string | null;
  date: string;
  profile: HealthProfile | null;
  goals: DailyGoals | null;
  isMinor: boolean;
  foodLogs: FoodLog[];
  water: HydrationLog[];
  activity: ActivityLog[];
  consumed: Nutrients;
  remaining: { kcal: number; protein: number; carbs: number; fat: number };
  waterMl: number;
  steps: number;
  activeMinutes: number;
  kcalBurnedEstimate: number | null;
  goalCompletion: number; // 0–1 across food log, water, activity, steps
  reload: () => Promise<void>;
}

/** All of today's data for a member; refetches whenever any write bumps the app version. */
export function useDay(memberId: string | null | undefined, date: string = localDate()): DayData {
  const { version } = useApp();
  const [state, setState] = useState<Omit<DayData, 'reload'>>({
    loading: true, error: null, date, profile: null, goals: null, isMinor: false, foodLogs: [], water: [], activity: [], consumed: ZERO,
    remaining: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, waterMl: 0, steps: 0, activeMinutes: 0, kcalBurnedEstimate: null, goalCompletion: 0,
  });

  const load = useCallback(async () => {
    if (!memberId) return;
    try {
      const [profile, savedGoals, foodLogs, water, activity] = await Promise.all([
        backend.getHealthProfile(memberId),
        backend.getGoals(memberId),
        backend.listFoodLogs(memberId, date, date),
        backend.listWater(memberId, date, date),
        backend.listActivity(memberId, date, date),
      ]);
      const goals = savedGoals ?? (profile ? computeGoals(profile) : null);
      const consumed = sumNutrients(foodLogs.map((l) => l.totals));
      const waterMl = water.reduce((s, w) => s + w.ml, 0);
      const steps = activity.reduce((s, a) => s + a.steps, 0);
      const activeMinutes = activity.reduce((s, a) => s + a.minutes, 0);
      const est = activity.some((a) => a.kcalEstimate != null) ? activity.reduce((s, a) => s + (a.kcalEstimate ?? 0), 0) : null;
      const habits = goals
        ? earnedHabits({ waterMl, waterGoal: goals.waterMl, steps, stepsGoal: goals.steps, activityMinutes: activeMinutes, mealsLogged: foodLogs.length })
        : [];
      setState({
        loading: false, error: null, date, profile, goals, isMinor: profile ? ageOn(profile.birthDate) < 18 : false, foodLogs, water, activity, consumed,
        remaining: goals ? remainingFor(goals, consumed) : { kcal: 0, protein: 0, carbs: 0, fat: 0 }, waterMl, steps, activeMinutes,
        kcalBurnedEstimate: est, goalCompletion: habits.length / 4,
      });
    } catch (e: any) {
      setState((s) => ({ ...s, loading: false, error: e?.message ?? 'error' }));
    }
  }, [memberId, date]);

  useEffect(() => {
    load();
  }, [load, version]);

  return { ...state, reload: load };
}

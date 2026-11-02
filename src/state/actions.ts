import { useCallback, useRef, useState } from 'react';
import { backend } from '../backend';
import { haptic } from '../components/ui';
import type { Habit } from '../lib/types';

const HABITS: Habit[] = ['water_goal', 'meal_logged', 'activity', 'steps_goal'];

/**
 * After any log write, ask the backend to award any habit that is now complete.
 * The server verifies each habit from the logs and awards each at most once per day.
 */
export async function awardEarnedHabits(memberId: string, date: string): Promise<number> {
  let total = 0;
  for (const h of HABITS) {
    try {
      total += await backend.awardHabit(memberId, date, h);
    } catch {
      // Points are best-effort; logging must never fail because of them.
    }
  }
  if (total > 0) haptic('success');
  return total;
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string) => {
    setMsg(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 2200);
  }, []);
  return { msg, show };
}

import type { ActivityLevel, DailyGoals, HealthProfile, Nutrients, Sex } from './types';
import { ZERO } from './types';

/** Age in whole years on a given date. */
export function ageOn(birthDate: string, on: Date = new Date()): number {
  const b = new Date(birthDate + 'T00:00:00');
  let age = on.getFullYear() - b.getFullYear();
  const m = on.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < b.getDate())) age--;
  return age;
}

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Mifflin-St Jeor resting energy expenditure (kcal/day). Valid for adults (18+). */
export function mifflinStJeor(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

/**
 * IOM (2005) Estimated Energy Requirement for children and adolescents 3–18 y, healthy weight.
 * Physical-activity coefficients map our 5 levels onto the IOM 4 categories.
 */
export function iomChildEER(sex: Sex, age: number, weightKg: number, heightCm: number, level: ActivityLevel): number {
  const h = heightCm / 100;
  const idx = { sedentary: 0, light: 1, moderate: 2, active: 3, very_active: 3 }[level];
  const growth = age <= 8 ? 20 : 25;
  if (sex === 'male') {
    const pa = [1.0, 1.13, 1.26, 1.42][idx];
    return 88.5 - 61.9 * age + pa * (26.7 * weightKg + 903 * h) + growth;
  }
  const pa = [1.0, 1.16, 1.31, 1.56][idx];
  return 135.3 - 30.8 * age + pa * (10 * weightKg + 934 * h) + growth;
}

/**
 * Age-based reference energy ranges (Dietary Guidelines for Americans 2020–2025, Appendix 2),
 * used for children when weight is not provided. Returns the midpoint for the activity level.
 */
export function referenceEnergyForChild(sex: Sex, age: number, level: ActivityLevel): number {
  const table: Record<Sex, [number, number, number][]> = {
    // [maxAge, sedentary, active]
    female: [[3, 1000, 1400], [8, 1200, 1800], [13, 1600, 2200], [18, 1800, 2400]],
    male: [[3, 1000, 1400], [8, 1200, 2000], [13, 1600, 2600], [18, 2000, 3200]],
  };
  const row = table[sex].find(([max]) => age <= max) ?? table[sex][table[sex].length - 1];
  const t = { sedentary: 0, light: 0.33, moderate: 0.6, active: 0.85, very_active: 1 }[level];
  return row[1] + (row[2] - row[1]) * t;
}

/** Default daily water from drinks (ml), based on EFSA adequate total water intakes (≈80% from drinks). */
export function defaultWaterMl(sex: Sex, age: number): number {
  let total: number;
  if (age < 4) total = 1300;
  else if (age <= 8) total = 1600;
  else if (age <= 13) total = sex === 'male' ? 2100 : 1900;
  else total = sex === 'male' ? 2500 : 2000;
  return Math.round((total * 0.8) / 50) * 50;
}

const round5 = (x: number) => Math.round(x / 5) * 5;

/**
 * Compute recommended daily goals.
 * Rules:
 *  - Adults: Mifflin-St Jeor × activity factor. Weight goals adjust by at most ±15% and never
 *    below a safety floor.
 *  - Under 18: IOM EER (or age reference without weight). Never any deficit for minors.
 *  - Macros: protein by g/kg (or % of energy), fat 30% kcal, carbs = remainder.
 */
export function computeGoals(p: HealthProfile, today: Date = new Date()): DailyGoals {
  const age = ageOn(p.birthDate, today);
  const notes: string[] = [];
  let kcal: number;
  let method: DailyGoals['method'];
  const isMinor = age < 18;

  if (isMinor) {
    if (p.weightKg && age >= 3) {
      kcal = iomChildEER(p.sex, age, p.weightKg, p.heightCm, p.activityLevel);
      method = 'iom_eer_child';
    } else {
      kcal = referenceEnergyForChild(p.sex, Math.max(age, 2), p.activityLevel);
      method = 'age_reference';
    }
    notes.push('goals.note.minor');
    if (p.goal === 'weight_loss' || p.goal === 'weight_gain') notes.push('goals.note.minorNoWeightGoal');
  } else if (p.weightKg) {
    const ree = mifflinStJeor(p.sex, p.weightKg, p.heightCm, age);
    kcal = ree * ACTIVITY_FACTORS[p.activityLevel];
    method = 'mifflin_st_jeor';
    if (p.goal === 'weight_loss') {
      kcal *= 0.85;
      notes.push('goals.note.weightLossSupervision');
    } else if (p.goal === 'weight_gain') {
      kcal *= 1.1;
    }
    const floor = p.sex === 'male' ? 1500 : 1200;
    if (kcal < floor) {
      kcal = floor;
      notes.push('goals.note.floor');
    }
    if (age >= 65) notes.push('goals.note.older');
  } else {
    // Adult without weight: use a reference midpoint and invite them to customise.
    kcal = p.sex === 'male' ? 2400 : 1900;
    if (p.activityLevel === 'sedentary') kcal -= 200;
    if (p.activityLevel === 'active' || p.activityLevel === 'very_active') kcal += 300;
    method = 'age_reference';
    notes.push('goals.note.noWeight');
  }
  if (p.declaredConditions) notes.push('goals.note.conditions');

  kcal = round5(kcal);

  // Protein
  let protein: number;
  if (p.weightKg) {
    let perKg = isMinor ? (age <= 13 ? 0.95 : 0.85) : 1.0;
    if (!isMinor && (p.goal === 'fitness' || p.goal === 'weight_loss' || p.goal === 'weight_gain')) perKg = 1.4;
    if (!isMinor && p.activityLevel === 'very_active') perKg = Math.max(perKg, 1.6);
    protein = p.weightKg * perKg;
  } else {
    protein = (kcal * 0.2) / 4;
  }
  // Keep protein within 10–35% of energy (AMDR)
  protein = Math.min(Math.max(protein, (kcal * 0.1) / 4), (kcal * 0.35) / 4);

  const fatPct = isMinor && age <= 3 ? 0.35 : 0.3;
  const fat = (kcal * fatPct) / 9;
  const carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);

  return {
    kcal,
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    fiber: Math.round((kcal / 1000) * 14),
    sugarMax: Math.round((kcal * 0.1) / 4), // free sugars < 10% of energy (WHO)
    satFatMax: Math.round((kcal * 0.1) / 9),
    sodiumMax: isMinor ? (age <= 8 ? 1500 : 1800) : 2300,
    waterMl: defaultWaterMl(p.sex, age),
    steps: isMinor ? 10000 : 7000,
    activeMinutes: isMinor ? 60 : 30,
    sleepHours: age <= 12 ? 10 : age <= 17 ? 9 : 8,
    isCustom: false,
    method,
    notes,
  };
}

export function scaleNutrients(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  return {
    kcal: per100.kcal * f,
    protein: per100.protein * f,
    carbs: per100.carbs * f,
    fat: per100.fat * f,
    fiber: per100.fiber * f,
    sugar: per100.sugar * f,
    satFat: per100.satFat * f,
    sodium: per100.sodium * f,
  };
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  return list.reduce(
    (a, b) => ({
      kcal: a.kcal + b.kcal,
      protein: a.protein + b.protein,
      carbs: a.carbs + b.carbs,
      fat: a.fat + b.fat,
      fiber: a.fiber + b.fiber,
      sugar: a.sugar + b.sugar,
      satFat: a.satFat + b.satFat,
      sodium: a.sodium + b.sodium,
    }),
    { ...ZERO },
  );
}

export interface Remaining {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Remaining = goal − consumed, floored at 0 (overshoot is reported separately, never "negative food"). */
export function remainingFor(goals: Pick<DailyGoals, 'kcal' | 'protein' | 'carbs' | 'fat'>, consumed: Nutrients): Remaining {
  return {
    kcal: Math.max(0, goals.kcal - consumed.kcal),
    protein: Math.max(0, goals.protein - consumed.protein),
    carbs: Math.max(0, goals.carbs - consumed.carbs),
    fat: Math.max(0, goals.fat - consumed.fat),
  };
}

/** Rounded display helpers. */
export const r0 = (x: number) => Math.round(x);
export const r1 = (x: number) => Math.round(x * 10) / 10;

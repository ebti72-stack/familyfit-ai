export interface Nutrients {
  kcal: number;
  protein: number; // g
  carbs: number; // g
  fat: number; // g
  fiber: number; // g
  sugar: number; // g
  satFat: number; // g
  sodium: number; // mg
}

export type Sex = 'female' | 'male';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type HealthGoal =
  | 'healthy_lifestyle'
  | 'fitness'
  | 'healthy_habits'
  | 'more_activity'
  | 'hydration_sleep'
  | 'weight_loss'
  | 'weight_gain';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'suhoor' | 'iftar';
export type MemberRole = 'admin' | 'adult' | 'teen' | 'child';
export type LogSource = 'manual' | 'barcode' | 'recipe' | 'next_meal' | 'photo' | 'label_ocr';

export interface HealthProfile {
  memberId: string;
  birthDate: string; // YYYY-MM-DD
  sex: Sex;
  heightCm: number;
  weightKg: number | null;
  activityLevel: ActivityLevel;
  goal: HealthGoal;
  dietaryPreferences: string[]; // e.g. vegetarian, pescatarian, halal
  allergies: string[]; // Allergen codes
  dislikedFoods: string[]; // FoodItem ids
  declaredConditions?: string | null;
}

export interface DailyGoals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugarMax: number;
  satFatMax: number;
  sodiumMax: number;
  waterMl: number;
  steps: number;
  activeMinutes: number;
  sleepHours: number;
  isCustom: boolean;
  /** How the energy target was derived, shown to the user. */
  method: 'mifflin_st_jeor' | 'iom_eer_child' | 'age_reference' | 'custom';
  notes: string[]; // i18n keys explaining caveats
}

export interface Family {
  id: string;
  name: string;
  inviteCode: string;
  pointsConfig: PointsConfig;
}

export interface PointsConfig {
  water_goal: number;
  steps_goal: number;
  activity: number;
  meal_logged: number;
  sleep_routine: number;
  weekly_challenge: number;
}

export interface Member {
  id: string;
  familyId: string;
  userId: string | null;
  displayName: string;
  avatarEmoji: string | null;
  role: MemberRole;
  managedBy: string | null;
  shareHealthWithAdmin: boolean;
}

export interface MealItem {
  name: string;
  grams: number;
  foodItemId?: string | null;
  productId?: string | null;
  nutrients: Nutrients;
}

export interface FoodLog {
  id: string;
  memberId: string;
  logDate: string;
  loggedAt: string;
  mealType: MealType;
  title: string;
  source: LogSource;
  dedupeKey: string;
  items: MealItem[];
  totals: Nutrients;
}

export interface HydrationLog {
  id: string;
  memberId: string;
  logDate: string;
  loggedAt: string;
  ml: number;
}

export interface ActivityLog {
  id: string;
  memberId: string;
  logDate: string;
  loggedAt: string;
  activityType: string;
  minutes: number;
  steps: number;
  kcalEstimate: number | null;
  source: 'manual';
}

export type Habit = 'water_goal' | 'steps_goal' | 'activity' | 'meal_logged' | 'sleep_routine';

export interface PointsEntry {
  memberId: string;
  logDate: string;
  reason: string;
  points: number;
}

export interface LeaderboardRow {
  memberId: string;
  displayName: string;
  avatarEmoji: string | null;
  role: MemberRole;
  points: number;
  activeDays: number;
  streak: number;
}

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, satFat: 0, sodium: 0 };

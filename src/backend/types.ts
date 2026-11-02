import type { FastingAchievement, FastingLog, FastingProfile, FastingStatus, BadgeCode } from '../lib/fasting';
import type { HijriDate } from '../lib/hijri';
import type { Product } from '../lib/openFoodFacts';
import type { DocLang, UserRecipe } from '../lib/recipe';
import type { RecipeTranslation } from '../lib/recipeDoc';
import type {
  ActivityLog, DailyGoals, Family, FoodLog, Habit, HealthProfile, HydrationLog, Member, MemberRole, PointsConfig, PointsEntry, GroupKind } from '../lib/types';

export interface Session {
  userId: string;
  email: string | null;
  phone?: string | null;
  /** Name given at sign-up, used to pre-fill onboarding. */
  displayName?: string | null;
}

export interface Membership {
  member: Member;
  family: Family;
}

export interface UserPrefs {
  theme: 'system' | 'light' | 'dark';
  favoriteRecipes: string[];
  rejectedRecipes: string[];
  pantry: string[];
  budgetTier: 1 | 2 | 3;
  recentRecipeIds: string[];
  /** "Suggest from my favourites first" in the next-meal assistant. */
  favoritesFirst: boolean;
}

export const DEFAULT_PREFS: UserPrefs = {
  theme: 'system',
  favoriteRecipes: [],
  rejectedRecipes: [],
  pantry: [],
  budgetTier: 2,
  recentRecipeIds: [],
  favoritesFirst: true,
};

/** Reference to a recipe: 'b:<builtin id>' for built-in recipes, otherwise a user recipe id. */
export type RecipeRef = string;

export interface FavoriteRecipe {
  ref: RecipeRef;
  folders: string[];
  note: string;
  createdAt: string;
}

export interface RecipeRating {
  memberId: string;
  ref: RecipeRef;
  stars: number;
  comment: string;
  createdAt: string;
}

export interface AnalyzeInput {
  mode: 'text' | 'link' | 'frames';
  text?: string;
  url?: string;
  /** JPEG frames (base64, no data: prefix) sampled from an uploaded video, screen recording or ingredient photos. */
  frames?: string[];
  lang: 'ar' | 'en';
}

/** What the analysis service returns. Names, quantities and steps only — nutrition is computed locally/in the DB. */
export interface AnalyzeResult {
  status: 'ok' | 'no_recipe' | 'unreachable' | 'unsupported';
  title: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ovenTempC: number | null;
  tools: string[];
  ingredients: { name: string; quantity: number | null; unit: string | null; quantity_is_estimate: boolean }[];
  steps: { text: string; minutes: number | null; temp_c: number | null }[];
  alternatives: string[];
  confidence: 'high' | 'medium' | 'low';
  sourceText: string | null;
  message: string | null;
}

export interface TranslateResult {
  title: string;
  description: string;
  ingredientNames: string[];
  steps: string[];
  notes: string;
  servingTip: string;
}

export type NewFoodLog = Omit<FoodLog, 'id' | 'totals' | 'loggedAt'>;

export type AuthCapability = 'email' | 'phone' | 'apple' | 'google';

export interface Backend {
  readonly mode: 'supabase' | 'local';
  /** Which sign-in methods are actually configured. Unconfigured methods are shown disabled, never faked. */
  authCapabilities(): AuthCapability[];

  getSession(): Promise<Session | null>;
  onAuthChange(cb: (s: Session | null) => void): () => void;
  signUpEmail(email: string, password: string, displayName: string): Promise<{ needsConfirmation: boolean }>;
  signInEmail(email: string, password: string): Promise<void>;
  sendPhoneOtp(phone: string): Promise<void>;
  verifyPhoneOtp(phone: string, code: string): Promise<void>;
  signInApple(): Promise<void>;
  signInGoogle(): Promise<void>;
  signOut(): Promise<void>;
  deleteMyData(): Promise<void>;

  myMemberships(): Promise<Membership[]>;
  createFamily(name: string, myName: string, emoji: string | null, kind?: GroupKind): Promise<Membership>;
  /** Admin only: rename, or turn a personal space into a family/friends group (and back). */
  updateGroup(familyId: string, patch: { name?: string; kind?: GroupKind }): Promise<void>;
  joinFamily(code: string, myName: string, role: MemberRole, emoji: string | null): Promise<Membership>;
  listMembers(familyId: string): Promise<Member[]>;
  addManagedMember(familyId: string, name: string, role: MemberRole, emoji: string | null): Promise<Member>;
  updateMember(memberId: string, patch: Partial<Pick<Member, 'displayName' | 'avatarEmoji' | 'shareHealthWithAdmin'>>): Promise<void>;
  updatePointsConfig(familyId: string, cfg: PointsConfig): Promise<void>;

  getHealthProfile(memberId: string): Promise<HealthProfile | null>;
  saveHealthProfile(p: HealthProfile): Promise<void>;
  getGoals(memberId: string): Promise<DailyGoals | null>;
  saveGoals(memberId: string, g: DailyGoals): Promise<void>;
  getPrefs(): Promise<UserPrefs>;
  savePrefs(p: UserPrefs): Promise<void>;

  listFoodLogs(memberId: string, from: string, to: string): Promise<FoodLog[]>;
  /** Idempotent on (memberId, dedupeKey): the same submission is never counted twice. */
  addFoodLog(log: NewFoodLog): Promise<FoodLog>;
  deleteFoodLog(id: string): Promise<void>;
  listWater(memberId: string, from: string, to: string): Promise<HydrationLog[]>;
  addWater(memberId: string, logDate: string, ml: number): Promise<void>;
  deleteWater(id: string): Promise<void>;
  listActivity(memberId: string, from: string, to: string): Promise<ActivityLog[]>;
  addActivity(a: Omit<ActivityLog, 'id' | 'loggedAt'>): Promise<void>;

  findProduct(familyId: string, barcode: string): Promise<Product | null>;
  saveProduct(familyId: string | null, p: Product): Promise<void>;

  awardHabit(memberId: string, logDate: string, habit: Habit): Promise<number>;
  listPoints(familyId: string, from: string, to: string): Promise<PointsEntry[]>;

  // ---- fasting ----
  getFastingProfile(memberId: string): Promise<FastingProfile | null>;
  saveFastingProfile(p: FastingProfile): Promise<void>;
  listFastingLogs(memberId: string, from: string, to: string): Promise<FastingLog[]>;
  /** null removes the day. 'completed' records the confirmation time; the server rejects future completions. */
  setFastingDay(memberId: string, date: string, status: FastingStatus | null, hijri: HijriDate): Promise<void>;
  /** Server-side: issues badges from confirmed completed days only; returns the new ones. */
  evaluateFastingBadges(memberId: string): Promise<{ badge: BadgeCode; periodKey: string }[]>;
  listFastingAchievements(memberId: string): Promise<FastingAchievement[]>;
  /** Optional family challenge: anonymous total of opted-in members. */
  familyFastingTotal(familyId: string, hijriYear: number, hijriMonth: number): Promise<{ participants: number; completedDays: number }>;

  // ---- recipes ----
  listRecipes(familyId: string): Promise<UserRecipe[]>;
  getRecipe(id: string): Promise<UserRecipe | null>;
  saveRecipe(r: UserRecipe): Promise<UserRecipe>;
  deleteRecipe(id: string): Promise<void>;
  setRecipeShared(id: string, shared: boolean, byMemberId: string): Promise<void>;
  listFavoriteRecipes(memberId: string): Promise<FavoriteRecipe[]>;
  saveFavoriteRecipe(memberId: string, fav: Omit<FavoriteRecipe, 'createdAt'>): Promise<void>;
  removeFavoriteRecipe(memberId: string, ref: RecipeRef): Promise<void>;
  listFavoriteIngredients(memberId: string): Promise<string[]>;
  setFavoriteIngredient(memberId: string, foodId: string, on: boolean): Promise<void>;
  listRatings(ref: RecipeRef): Promise<RecipeRating[]>;
  listMyRatings(memberId: string): Promise<RecipeRating[]>;
  rateRecipe(memberId: string, ref: RecipeRef, stars: number, comment: string): Promise<void>;
  getTranslation(memberId: string, ref: RecipeRef, lang: DocLang): Promise<RecipeTranslation | null>;
  saveTranslation(memberId: string, ref: RecipeRef, t: RecipeTranslation): Promise<void>;
  logRecipeDocument(memberId: string, ref: RecipeRef, lang: DocLang, options: Record<string, unknown>): Promise<void>;

  // ---- AI services (server-side keys only) ----
  /** True only when the analysis/translation Edge Functions are deployed and enabled. */
  aiAvailable(): boolean;
  analyzeRecipe(input: AnalyzeInput): Promise<AnalyzeResult>;
  translateRecipe(source: TranslateResult, target: DocLang): Promise<TranslateResult>;
}

export class BackendError extends Error {
  constructor(public code: 'invalid_code' | 'not_configured' | 'auth' | 'network' | 'forbidden' | 'unknown', message?: string) {
    super(message ?? code);
  }
}

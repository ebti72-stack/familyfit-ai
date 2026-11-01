import type { Product } from '../lib/openFoodFacts';
import type {
  ActivityLog, DailyGoals, Family, FoodLog, Habit, HealthProfile, HydrationLog, Member, MemberRole, PointsConfig, PointsEntry,
} from '../lib/types';

export interface Session {
  userId: string;
  email: string | null;
  phone?: string | null;
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
}

export const DEFAULT_PREFS: UserPrefs = {
  theme: 'system',
  favoriteRecipes: [],
  rejectedRecipes: [],
  pantry: [],
  budgetTier: 2,
  recentRecipeIds: [],
};

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
  createFamily(name: string, myName: string, emoji: string | null): Promise<Membership>;
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
}

export class BackendError extends Error {
  constructor(public code: 'invalid_code' | 'not_configured' | 'auth' | 'network' | 'forbidden' | 'unknown', message?: string) {
    super(message ?? code);
  }
}

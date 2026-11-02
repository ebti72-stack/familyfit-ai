/**
 * Supabase backend (Postgres + Auth + RLS). Activated when EXPO_PUBLIC_SUPABASE_URL and
 * EXPO_PUBLIC_SUPABASE_ANON_KEY are set. The anon key is public by design; all protection
 * comes from Row Level Security in supabase/migrations.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { Product } from '../lib/openFoodFacts';
import type {
  ActivityLog, DailyGoals, Family, FoodLog, Habit, HealthProfile, HydrationLog, Member, MemberRole, PointsConfig, PointsEntry,
  GroupKind,
} from '../lib/types';
import {
  BackendError, DEFAULT_PREFS, type AnalyzeInput, type AnalyzeResult, type AuthCapability, type Backend, type FavoriteRecipe, type Membership, type NewFoodLog,
  type RecipeRating, type Session, type TranslateResult, type UserPrefs,
} from './types';
import type { BadgeCode, FastingAchievement, FastingLog, FastingProfile, FastingStatus } from '../lib/fasting';
import type { HijriDate } from '../lib/hijri';
import { BUILTIN_PREFIX, type DocLang, type UserRecipe } from '../lib/recipe';
import type { RecipeTranslation } from '../lib/recipeDoc';

const toMember = (r: any): Member => ({
  id: r.id, familyId: r.family_id, userId: r.user_id, displayName: r.display_name, avatarEmoji: r.avatar_emoji,
  role: r.role, managedBy: r.managed_by, shareHealthWithAdmin: r.share_health_with_admin,
});
const toFamily = (r: any): Family => ({ id: r.id, name: r.name, kind: r.kind ?? 'family', inviteCode: r.invite_code, pointsConfig: r.points_config });
const toNutrients = (r: any) => ({
  kcal: +r.kcal, protein: +r.protein_g, carbs: +r.carbs_g, fat: +r.fat_g, fiber: +r.fiber_g, sugar: +r.sugar_g, satFat: +r.sat_fat_g, sodium: +r.sodium_mg,
});
const fromNutrients = (n: FoodLog['totals']) => ({
  kcal: n.kcal, protein_g: n.protein, carbs_g: n.carbs, fat_g: n.fat, fiber_g: n.fiber, sugar_g: n.sugar, sat_fat_g: n.satFat, sodium_mg: n.sodium,
});

function check<T>(res: { data: T; error: any } | { data: any; error: any }): T {
  if (res.error) {
    const msg = res.error.message ?? String(res.error);
    if (/invalid invite code/i.test(msg)) throw new BackendError('invalid_code');
    if (res.error.code === '42501' || /forbidden|row-level security/i.test(msg)) throw new BackendError('forbidden', msg);
    if (/Invalid login credentials|JWT|not authenticated/i.test(msg)) throw new BackendError('auth', msg);
    throw new BackendError('unknown', msg);
  }
  return res.data;
}

export class SupabaseBackend implements Backend {
  readonly mode = 'supabase' as const;
  readonly sb: SupabaseClient;

  constructor(url: string, anonKey: string, private caps: AuthCapability[], private ai = false) {
    this.sb = createClient(url, anonKey, {
      auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }

  authCapabilities() {
    return this.caps;
  }

  private async uid(): Promise<string> {
    const { data } = await this.sb.auth.getSession();
    if (!data.session) throw new BackendError('auth', 'not signed in');
    return data.session.user.id;
  }

  async getSession(): Promise<Session | null> {
    const { data } = await this.sb.auth.getSession();
    const u = data.session?.user;
    return u ? { userId: u.id, email: u.email ?? null, phone: u.phone ?? null, displayName: (u.user_metadata?.display_name as string | undefined) ?? null } : null;
  }
  onAuthChange(cb: (s: Session | null) => void) {
    const { data } = this.sb.auth.onAuthStateChange((_e, s) => cb(s?.user ? { userId: s.user.id, email: s.user.email ?? null, phone: s.user.phone ?? null, displayName: (s.user.user_metadata?.display_name as string | undefined) ?? null } : null));
    return () => data.subscription.unsubscribe();
  }
  async signUpEmail(email: string, password: string, displayName: string) {
    const res = await this.sb.auth.signUp({ email, password, options: { data: { display_name: displayName, locale: 'ar' } } });
    check(res);
    return { needsConfirmation: !res.data.session };
  }
  async signInEmail(email: string, password: string) {
    check(await this.sb.auth.signInWithPassword({ email, password }));
  }
  async sendPhoneOtp(phone: string) {
    if (!this.caps.includes('phone')) throw new BackendError('not_configured', 'phone');
    check(await this.sb.auth.signInWithOtp({ phone }));
  }
  async verifyPhoneOtp(phone: string, code: string) {
    check(await this.sb.auth.verifyOtp({ phone, token: code, type: 'sms' }));
  }
  async signInApple() {
    if (!this.caps.includes('apple') || Platform.OS !== 'ios') throw new BackendError('not_configured', 'apple');
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!cred.identityToken) throw new BackendError('auth', 'no identity token');
    check(await this.sb.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken }));
  }
  async signInGoogle() {
    if (!this.caps.includes('google')) throw new BackendError('not_configured', 'google');
    const redirectTo = Linking.createURL('auth-callback');
    const { data, error } = await this.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: Platform.OS !== 'web' } });
    if (error) throw new BackendError('auth', error.message);
    if (Platform.OS === 'web') return; // browser redirects
    const result = await WebBrowser.openAuthSessionAsync(data.url!, redirectTo);
    if (result.type !== 'success') throw new BackendError('auth', 'cancelled');
    const params = new URLSearchParams(result.url.split('#')[1] ?? result.url.split('?')[1] ?? '');
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    const code = params.get('code');
    if (code) check(await this.sb.auth.exchangeCodeForSession(code));
    else if (access_token && refresh_token) check(await this.sb.auth.setSession({ access_token, refresh_token }));
    else throw new BackendError('auth', 'missing token');
  }
  async signOut() {
    await this.sb.auth.signOut();
  }
  async deleteMyData() {
    check(await this.sb.rpc('delete_my_data'));
    // Removing the auth user itself requires the service role: handled by the delete-account edge function.
    await this.sb.functions.invoke('delete-account').catch(() => undefined);
    await this.sb.auth.signOut();
  }

  // ---------------- family ----------------
  async myMemberships(): Promise<Membership[]> {
    const uid = await this.uid();
    const rows = check(await this.sb.from('family_members').select('*, families(*)').eq('user_id', uid)) as any[];
    return rows.map((r) => ({ member: toMember(r), family: toFamily(r.families) }));
  }
  async createFamily(name: string, myName: string, emoji: string | null, kind: GroupKind = 'family') {
    const m = check(await this.sb.rpc('create_family', { family_name: name, my_name: myName, my_emoji: emoji, group_kind: kind })) as any;
    const f = check(await this.sb.from('families').select('*').eq('id', m.family_id).single());
    return { member: toMember(m), family: toFamily(f) };
  }
  async updateGroup(familyId: string, patch: { name?: string; kind?: GroupKind }) {
    const row: any = {};
    if (patch.name) row.name = patch.name;
    if (patch.kind) row.kind = patch.kind;
    const { error } = await this.sb.from('families').update(row).eq('id', familyId);
    if (error) throw new BackendError(error.code === '42501' ? 'forbidden' : 'unknown', error.message);
  }
  async joinFamily(code: string, myName: string, role: MemberRole, emoji: string | null) {
    const m = check(await this.sb.rpc('join_family', { code, my_name: myName, my_role: role, my_emoji: emoji })) as any;
    const f = check(await this.sb.from('families').select('*').eq('id', m.family_id).single());
    return { member: toMember(m), family: toFamily(f) };
  }
  async listMembers(familyId: string) {
    return (check(await this.sb.from('family_members').select('*').eq('family_id', familyId).order('created_at')) as any[]).map(toMember);
  }
  async addManagedMember(familyId: string, name: string, role: MemberRole, emoji: string | null) {
    const uid = await this.uid();
    const row = check(
      await this.sb.from('family_members').insert({
        family_id: familyId, display_name: name, role, avatar_emoji: emoji, managed_by: uid, share_health_with_admin: true,
        parental_consent_at: new Date().toISOString(),
      }).select().single(),
    );
    return toMember(row);
  }
  async updateMember(memberId: string, patch: Partial<Pick<Member, 'displayName' | 'avatarEmoji' | 'shareHealthWithAdmin'>>) {
    const row: any = {};
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.avatarEmoji !== undefined) row.avatar_emoji = patch.avatarEmoji;
    if (patch.shareHealthWithAdmin !== undefined) row.share_health_with_admin = patch.shareHealthWithAdmin;
    check(await this.sb.from('family_members').update(row).eq('id', memberId));
  }
  async updatePointsConfig(familyId: string, cfg: PointsConfig) {
    check(await this.sb.from('families').update({ points_config: cfg }).eq('id', familyId));
  }

  // ---------------- health ----------------
  async getHealthProfile(memberId: string): Promise<HealthProfile | null> {
    const r = check(await this.sb.from('health_profiles').select('*').eq('member_id', memberId).maybeSingle()) as any;
    if (!r) return null;
    return {
      memberId, birthDate: r.birth_date, sex: r.sex, heightCm: +r.height_cm, weightKg: r.weight_kg == null ? null : +r.weight_kg,
      activityLevel: r.activity_level, goal: r.goal, dietaryPreferences: r.dietary_preferences, allergies: r.allergies,
      dislikedFoods: r.disliked_foods, declaredConditions: r.declared_conditions,
    };
  }
  async saveHealthProfile(p: HealthProfile) {
    check(
      await this.sb.from('health_profiles').upsert({
        member_id: p.memberId, birth_date: p.birthDate, sex: p.sex, height_cm: p.heightCm, weight_kg: p.weightKg,
        activity_level: p.activityLevel, goal: p.goal, dietary_preferences: p.dietaryPreferences, allergies: p.allergies,
        disliked_foods: p.dislikedFoods, declared_conditions: p.declaredConditions ?? null, updated_at: new Date().toISOString(),
      }),
    );
  }
  async getGoals(memberId: string): Promise<DailyGoals | null> {
    const r = check(await this.sb.from('daily_goals').select('*').eq('member_id', memberId).maybeSingle()) as any;
    if (!r) return null;
    return {
      kcal: r.kcal, protein: r.protein_g, carbs: r.carbs_g, fat: r.fat_g, fiber: r.fiber_g, sugarMax: r.sugar_g_max,
      satFatMax: r.sat_fat_g_max, sodiumMax: r.sodium_mg_max, waterMl: r.water_ml, steps: r.steps, activeMinutes: r.active_minutes,
      sleepHours: +r.sleep_hours, isCustom: r.is_custom, method: r.is_custom ? 'custom' : 'mifflin_st_jeor', notes: [],
    };
  }
  async saveGoals(memberId: string, g: DailyGoals) {
    check(
      await this.sb.from('daily_goals').upsert({
        member_id: memberId, kcal: Math.round(g.kcal), protein_g: g.protein, carbs_g: g.carbs, fat_g: g.fat, fiber_g: g.fiber,
        sugar_g_max: g.sugarMax, sat_fat_g_max: g.satFatMax, sodium_mg_max: g.sodiumMax, water_ml: g.waterMl, steps: g.steps,
        active_minutes: g.activeMinutes, sleep_hours: g.sleepHours, is_custom: g.isCustom, updated_at: new Date().toISOString(),
      }),
    );
  }
  async getPrefs(): Promise<UserPrefs> {
    const uid = await this.uid();
    const r = check(await this.sb.from('user_preferences').select('*').eq('user_id', uid).maybeSingle()) as any;
    const recent = JSON.parse((await AsyncStorage.getItem(`recent:${uid}`)) ?? '[]');
    if (!r) return { ...DEFAULT_PREFS, recentRecipeIds: recent };
    return {
      theme: r.theme, favoriteRecipes: r.favorite_recipes, rejectedRecipes: r.rejected_recipes, pantry: r.pantry,
      budgetTier: r.budget_tier, recentRecipeIds: recent, favoritesFirst: r.favorites_first ?? true,
    };
  }
  async savePrefs(p: UserPrefs) {
    const uid = await this.uid();
    await AsyncStorage.setItem(`recent:${uid}`, JSON.stringify(p.recentRecipeIds.slice(0, 20)));
    check(
      await this.sb.from('user_preferences').upsert({
        user_id: uid, theme: p.theme, favorite_recipes: p.favoriteRecipes, rejected_recipes: p.rejectedRecipes, pantry: p.pantry,
        budget_tier: p.budgetTier, favorites_first: p.favoritesFirst, updated_at: new Date().toISOString(),
      }),
    );
  }

  // ---------------- logs ----------------
  async listFoodLogs(memberId: string, from: string, to: string): Promise<FoodLog[]> {
    const rows = check(
      await this.sb.from('food_logs').select('*, meal_items(*)').eq('member_id', memberId).gte('log_date', from).lte('log_date', to).order('logged_at'),
    ) as any[];
    return rows.map((r) => ({
      id: r.id, memberId: r.member_id, logDate: r.log_date, loggedAt: r.logged_at, mealType: r.meal_type, title: r.title, source: r.source,
      dedupeKey: r.dedupe_key, totals: toNutrients(r),
      items: (r.meal_items ?? []).map((i: any) => ({ name: i.name, grams: +i.grams, foodItemId: i.food_item_id, productId: i.product_id, nutrients: toNutrients(i) })),
    }));
  }
  async addFoodLog(log: NewFoodLog): Promise<FoodLog> {
    const fam = check(await this.sb.from('family_members').select('family_id').eq('id', log.memberId).single()) as any;
    const ins = await this.sb.from('food_logs').insert({
      member_id: log.memberId, family_id: fam.family_id, log_date: log.logDate, meal_type: log.mealType, title: log.title,
      source: log.source, dedupe_key: log.dedupeKey,
    }).select().single();
    if (ins.error?.code === '23505') {
      // Already saved (double tap / retry): return the stored log instead of counting it twice.
      const existing = await this.listFoodLogs(log.memberId, log.logDate, log.logDate);
      const hit = existing.find((l) => l.dedupeKey === log.dedupeKey);
      if (hit) return hit;
    }
    const row = check(ins) as any;
    check(
      await this.sb.from('meal_items').insert(
        log.items.map((i) => ({
          food_log_id: row.id, name: i.name, grams: i.grams, food_item_id: i.foodItemId ?? null, product_id: i.productId ?? null, ...fromNutrients(i.nutrients),
        })),
      ),
    );
    const saved = await this.listFoodLogs(log.memberId, log.logDate, log.logDate);
    return saved.find((l) => l.id === row.id)!;
  }
  async deleteFoodLog(id: string) {
    check(await this.sb.from('food_logs').delete().eq('id', id));
  }
  async listWater(memberId: string, from: string, to: string): Promise<HydrationLog[]> {
    const rows = check(await this.sb.from('hydration_logs').select('*').eq('member_id', memberId).gte('log_date', from).lte('log_date', to).order('logged_at')) as any[];
    return rows.map((r) => ({ id: r.id, memberId: r.member_id, logDate: r.log_date, loggedAt: r.logged_at, ml: r.ml }));
  }
  async addWater(memberId: string, logDate: string, ml: number) {
    const fam = check(await this.sb.from('family_members').select('family_id').eq('id', memberId).single()) as any;
    check(await this.sb.from('hydration_logs').insert({ member_id: memberId, family_id: fam.family_id, log_date: logDate, ml }));
  }
  async deleteWater(id: string) {
    check(await this.sb.from('hydration_logs').delete().eq('id', id));
  }
  async listActivity(memberId: string, from: string, to: string): Promise<ActivityLog[]> {
    const rows = check(await this.sb.from('activity_logs').select('*').eq('member_id', memberId).gte('log_date', from).lte('log_date', to).order('logged_at')) as any[];
    return rows.map((r) => ({
      id: r.id, memberId: r.member_id, logDate: r.log_date, loggedAt: r.logged_at, activityType: r.activity_type, minutes: r.minutes,
      steps: r.steps, kcalEstimate: r.kcal_estimate == null ? null : +r.kcal_estimate, source: 'manual',
    }));
  }
  async addActivity(a: Omit<ActivityLog, 'id' | 'loggedAt'>) {
    const fam = check(await this.sb.from('family_members').select('family_id').eq('id', a.memberId).single()) as any;
    check(
      await this.sb.from('activity_logs').insert({
        member_id: a.memberId, family_id: fam.family_id, log_date: a.logDate, activity_type: a.activityType, minutes: a.minutes, steps: a.steps,
        kcal_estimate: a.kcalEstimate, source: 'manual',
      }),
    );
  }

  // ---------------- products ----------------
  async findProduct(familyId: string, barcode: string): Promise<Product | null> {
    const rows = check(
      await this.sb.from('food_barcodes').select('family_id, food_products(*)').eq('barcode', barcode).or(`family_id.is.null,family_id.eq.${familyId}`),
    ) as any[];
    // Prefer the family's own entry over the shared cache.
    const r = (rows.find((x) => x.family_id === familyId) ?? rows[0])?.food_products;
    if (!r) return null;
    return {
      barcode, name: r.name, brand: r.brand, imageUrl: r.image_url,
      per100: {
        kcal: +r.kcal_100g, protein: +r.protein_100g, carbs: +r.carbs_100g, fat: +r.fat_100g, fiber: +(r.fiber_100g ?? 0),
        sugar: +(r.sugar_100g ?? 0), satFat: +(r.sat_fat_100g ?? 0), sodium: +(r.sodium_mg_100g ?? 0),
      },
      servingGrams: r.serving_size_g == null ? null : +r.serving_size_g, servingLabel: r.serving_label, ingredientsText: r.ingredients_text,
      allergens: r.allergens ?? [],
      missing: (['fiber', 'sugar', 'satFat', 'sodium'] as const).filter((k) => r[{ fiber: 'fiber_100g', sugar: 'sugar_100g', satFat: 'sat_fat_100g', sodium: 'sodium_mg_100g' }[k]] == null),
      source: r.source, sourceUrl: r.source === 'open_food_facts' ? `https://world.openfoodfacts.org/product/${barcode}` : null,
    };
  }
  async saveProduct(familyId: string | null, p: Product) {
    const uid = await this.uid();
    const miss = (k: keyof Product['per100']) => (p.missing.includes(k) ? null : p.per100[k]);
    const row = check(
      await this.sb.from('food_products').insert({
        family_id: familyId, name: p.name, brand: p.brand, image_url: p.imageUrl, kcal_100g: p.per100.kcal, protein_100g: p.per100.protein,
        carbs_100g: p.per100.carbs, fat_100g: p.per100.fat, fiber_100g: miss('fiber'), sugar_100g: miss('sugar'), sat_fat_100g: miss('satFat'),
        sodium_mg_100g: miss('sodium'), serving_size_g: p.servingGrams, serving_label: p.servingLabel, ingredients_text: p.ingredientsText,
        allergens: p.allergens, source: familyId ? (p.source === 'open_food_facts' ? 'family_manual' : p.source) : 'open_food_facts', created_by: uid,
      }).select('id').single(),
    ) as any;
    check(await this.sb.from('food_barcodes').insert({ barcode: p.barcode, product_id: row.id, family_id: familyId }));
  }

  // ---------------- points ----------------
  async awardHabit(memberId: string, logDate: string, habit: Habit) {
    return (check(await this.sb.rpc('award_habit_points', { mid: memberId, day: logDate, habit })) as number) ?? 0;
  }
  async listPoints(familyId: string, from: string, to: string): Promise<PointsEntry[]> {
    const rows = check(await this.sb.from('leaderboard_points').select('member_id, log_date, reason, points').eq('family_id', familyId).gte('log_date', from).lte('log_date', to)) as any[];
    return rows.map((r) => ({ memberId: r.member_id, logDate: r.log_date, reason: r.reason, points: r.points }));
  }

  // ---------------- fasting ----------------
  async getFastingProfile(memberId: string): Promise<FastingProfile | null> {
    const p = check(await this.sb.from('fasting_profiles').select('*').eq('member_id', memberId).maybeSingle()) as any;
    const sch = check(await this.sb.from('fasting_schedules').select('*').eq('member_id', memberId).maybeSingle()) as any;
    if (!p && !sch) return null;
    return {
      memberId, enabled: p?.enabled ?? false, type: sch?.fasting_type ?? 'three_monthly', daysOfWeek: sch?.days_of_week ?? [], hijriDays: sch?.hijri_days ?? [13, 14, 15],
      startDate: sch?.start_date ?? null, endDate: sch?.end_date ?? null, suhoorTime: p?.suhoor_time?.slice(0, 5) ?? null, iftarTime: p?.iftar_time?.slice(0, 5) ?? null,
      hijriOffset: p?.hijri_offset ?? 0, monthlyGoal: p?.monthly_goal ?? 3, joinFamilyChallenge: p?.join_family_challenge ?? false,
      healthFlags: p?.health_flags ?? [], healthAck: p?.health_ack ?? false,
    };
  }
  async saveFastingProfile(p: FastingProfile) {
    check(await this.sb.from('fasting_profiles').upsert({
      member_id: p.memberId, enabled: p.enabled, hijri_offset: p.hijriOffset, monthly_goal: p.monthlyGoal, join_family_challenge: p.joinFamilyChallenge,
      health_flags: p.healthFlags, health_ack: p.healthAck, suhoor_time: p.suhoorTime, iftar_time: p.iftarTime,
    }));
    check(await this.sb.from('fasting_schedules').upsert({
      member_id: p.memberId, fasting_type: p.type, days_of_week: p.daysOfWeek, hijri_days: p.hijriDays, start_date: p.startDate, end_date: p.endDate,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'member_id' }));
  }
  async listFastingLogs(memberId: string, from: string, to: string): Promise<FastingLog[]> {
    const rows = check(await this.sb.from('fasting_logs').select('*').eq('member_id', memberId).gte('log_date', from).lte('log_date', to)) as any[];
    return rows.map((r) => ({
      id: r.id, memberId: r.member_id, logDate: r.log_date, status: r.status, hijriYear: r.hijri_year, hijriMonth: r.hijri_month, hijriDay: r.hijri_day,
      confirmedAt: r.confirmed_at, note: r.note,
    }));
  }
  async setFastingDay(memberId: string, date: string, status: FastingStatus | null, h: HijriDate) {
    if (!status) {
      check(await this.sb.from('fasting_logs').delete().eq('member_id', memberId).eq('log_date', date));
      return;
    }
    check(await this.sb.from('fasting_logs').upsert({
      member_id: memberId, log_date: date, status, hijri_year: h.y, hijri_month: h.m, hijri_day: h.d,
      confirmed_at: status === 'completed' ? new Date().toISOString() : null,
    }, { onConflict: 'member_id,log_date' }));
  }
  async evaluateFastingBadges(memberId: string) {
    const rows = check(await this.sb.rpc('evaluate_fasting_badges', { mid: memberId })) as any[];
    return (rows ?? []).map((r) => ({ badge: r.badge_code as BadgeCode, periodKey: r.period_key as string }));
  }
  async listFastingAchievements(memberId: string): Promise<FastingAchievement[]> {
    const rows = check(await this.sb.from('fasting_achievements').select('*').eq('member_id', memberId).order('earned_at', { ascending: false })) as any[];
    return rows.map((r) => ({ memberId: r.member_id, badge: r.badge_code, periodKey: r.period_key, earnedAt: r.earned_at }));
  }
  async familyFastingTotal(familyId: string, hy: number, hm: number) {
    const rows = check(await this.sb.rpc('family_fasting_total', { fid: familyId, hy, hm })) as any[];
    return { participants: rows?.[0]?.participants ?? 0, completedDays: rows?.[0]?.completed_days ?? 0 };
  }

  // ---------------- recipes ----------------
  private toRecipe(r: any): UserRecipe {
    return {
      id: r.id, ownerMemberId: r.owner_member_id, familyId: r.family_id, parentId: r.parent_id, versionKind: r.version_kind, lang: r.lang, title: r.title,
      description: r.description ?? '', emoji: r.emoji ?? '🍽️', imageUri: r.image_url, sourceKind: r.source_kind, sourceUrl: r.source_url, sourcePlatform: r.source_platform,
      servings: +r.servings, prepMinutes: r.prep_minutes, cookMinutes: r.cook_minutes, difficulty: r.difficulty, cookingMethod: r.cooking_method,
      ingredients: [...(r.recipe_ingredients ?? [])].sort((a: any, b: any) => a.position - b.position).map((i: any) => ({
        raw: i.raw, name: i.name, foodId: i.food_item_id, qty: i.qty == null ? null : +i.qty, unit: i.unit, grams: i.grams == null ? null : +i.grams,
        confidence: i.confidence, estimated: i.estimated, toTaste: i.to_taste, confirmed: i.confirmed,
      })),
      steps: (r.steps ?? []).map((x: any) => ({ text: x.text, minutes: x.minutes ?? null, tempC: x.temp_c ?? null })),
      tools: r.tools ?? [], notes: r.notes ?? '', servingTip: r.serving_tip ?? '', finalWeightG: r.final_weight_g == null ? null : +r.final_weight_g,
      mealTypes: r.meal_types ?? [], sharedWithFamily: !!(r.family_recipe_shares && (Array.isArray(r.family_recipe_shares) ? r.family_recipe_shares.length : true)),
      createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }
  private recipeSelect = '*, recipe_ingredients(*), family_recipe_shares(recipe_id)';
  async listRecipes(familyId: string) {
    const rows = check(await this.sb.from('user_recipes').select(this.recipeSelect).eq('family_id', familyId).order('updated_at', { ascending: false })) as any[];
    return rows.map((r) => this.toRecipe(r));
  }
  async getRecipe(id: string) {
    const r = check(await this.sb.from('user_recipes').select(this.recipeSelect).eq('id', id).maybeSingle());
    return r ? this.toRecipe(r) : null;
  }
  async saveRecipe(r: UserRecipe) {
    const row: any = {
      family_id: r.familyId, owner_member_id: r.ownerMemberId, parent_id: r.parentId, version_kind: r.versionKind, lang: r.lang, title: r.title,
      description: r.description, emoji: r.emoji, image_url: r.imageUri && /^https?:/.test(r.imageUri) ? r.imageUri : null, source_kind: r.sourceKind === 'builtin' ? 'manual' : r.sourceKind,
      source_url: r.sourceUrl, source_platform: r.sourcePlatform, servings: r.servings, prep_minutes: r.prepMinutes, cook_minutes: r.cookMinutes, difficulty: r.difficulty,
      cooking_method: r.cookingMethod, steps: r.steps.map((x) => ({ text: x.text, minutes: x.minutes, temp_c: x.tempC })), tools: r.tools, notes: r.notes,
      serving_tip: r.servingTip, final_weight_g: r.finalWeightG, meal_types: r.mealTypes,
    };
    if (r.id) row.id = r.id;
    const saved = check(await this.sb.from('user_recipes').upsert(row).select('id').single()) as any;
    check(await this.sb.from('recipe_ingredients').delete().eq('recipe_id', saved.id));
    if (r.ingredients.length) {
      check(await this.sb.from('recipe_ingredients').insert(r.ingredients.map((i, position) => ({
        recipe_id: saved.id, position, raw: i.raw, name: i.name, food_item_id: i.foodId, qty: i.qty, unit: i.unit, grams: i.grams, confidence: i.confidence,
        estimated: i.estimated, to_taste: i.toTaste, confirmed: i.confirmed,
      }))));
    }
    return (await this.getRecipe(saved.id))!;
  }
  async deleteRecipe(id: string) {
    check(await this.sb.from('user_recipes').delete().eq('id', id));
  }
  async setRecipeShared(id: string, shared: boolean, byMemberId: string) {
    if (!shared) {
      check(await this.sb.from('family_recipe_shares').delete().eq('recipe_id', id));
      return;
    }
    const r = check(await this.sb.from('user_recipes').select('family_id').eq('id', id).single()) as any;
    check(await this.sb.from('family_recipe_shares').upsert({ recipe_id: id, family_id: r.family_id, shared_by: byMemberId }));
  }
  private refCols(ref: string) {
    return ref.startsWith(BUILTIN_PREFIX) ? { builtin_recipe_id: ref.slice(BUILTIN_PREFIX.length), user_recipe_id: null } : { builtin_recipe_id: null, user_recipe_id: ref };
  }
  private refOf(r: any) {
    return r.builtin_recipe_id ? BUILTIN_PREFIX + r.builtin_recipe_id : r.user_recipe_id;
  }
  private refFilter(q: any, ref: string): any {
    return ref.startsWith(BUILTIN_PREFIX) ? q.eq('builtin_recipe_id', ref.slice(BUILTIN_PREFIX.length)) : q.eq('user_recipe_id', ref);
  }
  async listFavoriteRecipes(memberId: string): Promise<FavoriteRecipe[]> {
    const rows = check(await this.sb.from('favorite_recipes').select('*').eq('member_id', memberId)) as any[];
    return rows.map((r) => ({ ref: this.refOf(r), folders: r.folders ?? [], note: r.note ?? '', createdAt: r.created_at }));
  }
  async saveFavoriteRecipe(memberId: string, fav: Omit<FavoriteRecipe, 'createdAt'>) {
    const cols = this.refCols(fav.ref);
    check(await this.sb.from('favorite_recipes').upsert({ member_id: memberId, ...cols, folders: fav.folders, note: fav.note }, {
      onConflict: cols.builtin_recipe_id ? 'member_id,builtin_recipe_id' : 'member_id,user_recipe_id',
    }));
  }
  async removeFavoriteRecipe(memberId: string, ref: string) {
    check(await this.refFilter(this.sb.from('favorite_recipes').delete().eq('member_id', memberId), ref));
  }
  async listFavoriteIngredients(memberId: string) {
    const rows = check(await this.sb.from('favorite_ingredients').select('food_item_id').eq('member_id', memberId)) as any[];
    return rows.map((r) => r.food_item_id as string);
  }
  async setFavoriteIngredient(memberId: string, foodId: string, on: boolean) {
    if (on) check(await this.sb.from('favorite_ingredients').upsert({ member_id: memberId, food_item_id: foodId }));
    else check(await this.sb.from('favorite_ingredients').delete().eq('member_id', memberId).eq('food_item_id', foodId));
  }
  private toRating = (r: any): RecipeRating => ({ memberId: r.member_id, ref: this.refOf(r), stars: r.stars, comment: r.comment ?? '', createdAt: r.created_at });
  async listRatings(ref: string) {
    const rows = check(await this.refFilter(this.sb.from('recipe_ratings').select('*'), ref)) as any[];
    return rows.map(this.toRating);
  }
  async listMyRatings(memberId: string) {
    const rows = check(await this.sb.from('recipe_ratings').select('*').eq('member_id', memberId)) as any[];
    return rows.map(this.toRating);
  }
  async rateRecipe(memberId: string, ref: string, stars: number, comment: string) {
    const cols = this.refCols(ref);
    check(await this.sb.from('recipe_ratings').upsert({ member_id: memberId, ...cols, stars, comment, updated_at: new Date().toISOString() }, {
      onConflict: cols.builtin_recipe_id ? 'member_id,builtin_recipe_id' : 'member_id,user_recipe_id',
    }));
  }
  async getTranslation(memberId: string, ref: string, lang: DocLang): Promise<RecipeTranslation | null> {
    const r = check(await this.refFilter(this.sb.from('recipe_translations').select('*').eq('member_id', memberId).eq('lang', lang), ref).maybeSingle()) as any;
    if (!r) return null;
    return {
      recipeId: ref, lang, title: r.title, description: r.description, ingredientNames: r.ingredient_names, steps: r.steps, notes: r.notes, servingTip: r.serving_tip,
      pending: [], numberWarnings: r.number_warnings ?? [], machine: r.machine, edited: r.edited,
    };
  }
  async saveTranslation(memberId: string, ref: string, t: RecipeTranslation) {
    const cols = this.refCols(ref);
    check(await this.sb.from('recipe_translations').upsert({
      member_id: memberId, ...cols, lang: t.lang, title: t.title, description: t.description, ingredient_names: t.ingredientNames, steps: t.steps, notes: t.notes,
      serving_tip: t.servingTip, machine: t.machine, edited: t.edited, number_warnings: t.numberWarnings, updated_at: new Date().toISOString(),
    }, { onConflict: cols.builtin_recipe_id ? 'member_id,builtin_recipe_id,lang' : 'member_id,user_recipe_id,lang' }));
  }
  async logRecipeDocument(memberId: string, ref: string, lang: DocLang, options: Record<string, unknown>) {
    check(await this.sb.from('recipe_documents').insert({ member_id: memberId, ...this.refCols(ref), lang, options }));
  }

  // ---------------- AI services (Edge Functions; keys live in function secrets) ----------------
  aiAvailable() {
    return this.ai;
  }
  async analyzeRecipe(input: AnalyzeInput): Promise<AnalyzeResult> {
    if (!this.ai) throw new BackendError('not_configured', 'ai');
    const { data, error } = await this.sb.functions.invoke('analyze-recipe', { body: input });
    if (error) throw new BackendError('network', error.message);
    return data as AnalyzeResult;
  }
  async translateRecipe(source: TranslateResult, target: DocLang): Promise<TranslateResult> {
    if (!this.ai) throw new BackendError('not_configured', 'ai');
    const { data, error } = await this.sb.functions.invoke('translate-recipe', { body: { source, target } });
    if (error) throw new BackendError('network', error.message);
    return data as TranslateResult;
  }
}

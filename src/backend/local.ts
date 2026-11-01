/**
 * Local demo backend: everything is stored on this device (AsyncStorage).
 * Used automatically when Supabase keys are not configured, and always labelled in the UI
 * as "local demo mode — data stays on this device, no cloud sync".
 * It mirrors the server rules (dedupe, points verification, privacy) so behaviour matches.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { sumNutrients } from '../lib/nutrition';
import { ACTIVITY_MIN_MINUTES, DEFAULT_POINTS } from '../lib/points';
import { uid } from '../lib/dates';
import type { Product } from '../lib/openFoodFacts';
import type {
  ActivityLog, DailyGoals, Family, FoodLog, Habit, HealthProfile, HydrationLog, Member, MemberRole, PointsConfig, PointsEntry,
} from '../lib/types';
import { BackendError, DEFAULT_PREFS, type Backend, type Membership, type NewFoodLog, type Session, type UserPrefs } from './types';

interface LocalUser { id: string; email: string; passwordHash: string; displayName: string }
interface DB {
  users: LocalUser[];
  sessionUserId: string | null;
  families: Family[];
  members: Member[];
  profiles: HealthProfile[];
  goals: (DailyGoals & { memberId: string })[];
  prefs: Record<string, UserPrefs>;
  foodLogs: FoodLog[];
  water: HydrationLog[];
  activity: ActivityLog[];
  products: (Product & { familyId: string | null })[];
  points: (PointsEntry & { familyId: string })[];
}

const KEY = 'familyfit.local.v1';
const empty = (): DB => ({
  users: [], sessionUserId: null, families: [], members: [], profiles: [], goals: [], prefs: {},
  foodLogs: [], water: [], activity: [], products: [], points: [],
});

function inviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export class LocalBackend implements Backend {
  readonly mode = 'local' as const;
  private db: DB | null = null;
  private listeners = new Set<(s: Session | null) => void>();

  authCapabilities() {
    return ['email' as const];
  }

  private async load(): Promise<DB> {
    if (this.db) return this.db;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      this.db = raw ? { ...empty(), ...JSON.parse(raw) } : empty();
    } catch {
      this.db = empty();
    }
    return this.db!;
  }
  private async save() {
    if (this.db) await AsyncStorage.setItem(KEY, JSON.stringify(this.db));
  }
  private async me(): Promise<LocalUser> {
    const db = await this.load();
    const u = db.users.find((x) => x.id === db.sessionUserId);
    if (!u) throw new BackendError('auth', 'not signed in');
    return u;
  }
  private emit(s: Session | null) {
    this.listeners.forEach((l) => l(s));
  }
  private async canAccess(memberId: string): Promise<boolean> {
    const db = await this.load();
    const u = await this.me();
    const m = db.members.find((x) => x.id === memberId);
    if (!m) return false;
    if (m.userId === u.id) return true;
    const iAmAdmin = db.members.some((x) => x.familyId === m.familyId && x.userId === u.id && x.role === 'admin');
    return (m.userId === null && (m.managedBy === u.id || iAmAdmin)) || (m.shareHealthWithAdmin && iAmAdmin);
  }
  private async guard(memberId: string) {
    if (!(await this.canAccess(memberId))) throw new BackendError('forbidden');
  }

  // ---------------- auth ----------------
  async getSession(): Promise<Session | null> {
    const db = await this.load();
    const u = db.users.find((x) => x.id === db.sessionUserId);
    return u ? { userId: u.id, email: u.email } : null;
  }
  onAuthChange(cb: (s: Session | null) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
  private hash(email: string, password: string) {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `familyfit:${email.toLowerCase()}:${password}`);
  }
  async signUpEmail(email: string, password: string, displayName: string) {
    const db = await this.load();
    const e = email.trim().toLowerCase();
    if (db.users.some((u) => u.email === e)) throw new BackendError('auth', 'exists');
    const u: LocalUser = { id: uid(), email: e, passwordHash: await this.hash(e, password), displayName };
    db.users.push(u);
    db.sessionUserId = u.id;
    db.prefs[u.id] = { ...DEFAULT_PREFS };
    await this.save();
    this.emit({ userId: u.id, email: e });
    return { needsConfirmation: false };
  }
  async signInEmail(email: string, password: string) {
    const db = await this.load();
    const e = email.trim().toLowerCase();
    const u = db.users.find((x) => x.email === e);
    if (!u || u.passwordHash !== (await this.hash(e, password))) throw new BackendError('auth', 'invalid');
    db.sessionUserId = u.id;
    await this.save();
    this.emit({ userId: u.id, email: e });
  }
  async sendPhoneOtp(): Promise<void> {
    throw new BackendError('not_configured', 'phone');
  }
  async verifyPhoneOtp(): Promise<void> {
    throw new BackendError('not_configured', 'phone');
  }
  async signInApple(): Promise<void> {
    throw new BackendError('not_configured', 'apple');
  }
  async signInGoogle(): Promise<void> {
    throw new BackendError('not_configured', 'google');
  }
  async signOut() {
    const db = await this.load();
    db.sessionUserId = null;
    await this.save();
    this.emit(null);
  }
  async deleteMyData() {
    const db = await this.load();
    const u = await this.me();
    const myMembers = db.members.filter((m) => m.userId === u.id || m.managedBy === u.id).map((m) => m.id);
    const ownedFamilies = db.families.filter((f) => !db.members.some((m) => m.familyId === f.id && m.userId && m.userId !== u.id)).map((f) => f.id);
    const drop = (mid: string, fid?: string) => myMembers.includes(mid) || (fid ? ownedFamilies.includes(fid) : false);
    db.members = db.members.filter((m) => !drop(m.id, m.familyId));
    db.families = db.families.filter((f) => !ownedFamilies.includes(f.id));
    db.profiles = db.profiles.filter((p) => !myMembers.includes(p.memberId));
    db.goals = db.goals.filter((g) => !myMembers.includes(g.memberId));
    db.foodLogs = db.foodLogs.filter((l) => !myMembers.includes(l.memberId));
    db.water = db.water.filter((l) => !myMembers.includes(l.memberId));
    db.activity = db.activity.filter((l) => !myMembers.includes(l.memberId));
    db.points = db.points.filter((p) => !drop(p.memberId, p.familyId));
    db.users = db.users.filter((x) => x.id !== u.id);
    delete db.prefs[u.id];
    db.sessionUserId = null;
    await this.save();
    this.emit(null);
  }

  // ---------------- family ----------------
  async myMemberships(): Promise<Membership[]> {
    const db = await this.load();
    const u = await this.me();
    return db.members
      .filter((m) => m.userId === u.id)
      .map((m) => ({ member: m, family: db.families.find((f) => f.id === m.familyId)! }))
      .filter((x) => x.family);
  }
  async createFamily(name: string, myName: string, emoji: string | null): Promise<Membership> {
    const db = await this.load();
    const u = await this.me();
    const family: Family = { id: uid(), name, inviteCode: inviteCode(), pointsConfig: { ...DEFAULT_POINTS } };
    const member: Member = { id: uid(), familyId: family.id, userId: u.id, displayName: myName, avatarEmoji: emoji, role: 'admin', managedBy: null, shareHealthWithAdmin: false };
    db.families.push(family);
    db.members.push(member);
    await this.save();
    return { family, member };
  }
  async joinFamily(code: string, myName: string, role: MemberRole, emoji: string | null): Promise<Membership> {
    const db = await this.load();
    const u = await this.me();
    const family = db.families.find((f) => f.inviteCode === code.trim().toUpperCase());
    if (!family) throw new BackendError('invalid_code');
    let member = db.members.find((m) => m.familyId === family.id && m.userId === u.id);
    if (!member) {
      member = { id: uid(), familyId: family.id, userId: u.id, displayName: myName, avatarEmoji: emoji, role: role === 'admin' ? 'adult' : role, managedBy: null, shareHealthWithAdmin: false };
      db.members.push(member);
      await this.save();
    }
    return { family, member };
  }
  async listMembers(familyId: string): Promise<Member[]> {
    const db = await this.load();
    const u = await this.me();
    if (!db.members.some((m) => m.familyId === familyId && m.userId === u.id)) throw new BackendError('forbidden');
    return db.members.filter((m) => m.familyId === familyId);
  }
  async addManagedMember(familyId: string, name: string, role: MemberRole, emoji: string | null): Promise<Member> {
    const db = await this.load();
    const u = await this.me();
    if (!db.members.some((m) => m.familyId === familyId && m.userId === u.id && m.role === 'admin')) throw new BackendError('forbidden');
    const m: Member = { id: uid(), familyId, userId: null, displayName: name, avatarEmoji: emoji, role, managedBy: u.id, shareHealthWithAdmin: true };
    db.members.push(m);
    await this.save();
    return m;
  }
  async updateMember(memberId: string, patch: Partial<Pick<Member, 'displayName' | 'avatarEmoji' | 'shareHealthWithAdmin'>>) {
    const db = await this.load();
    const u = await this.me();
    const m = db.members.find((x) => x.id === memberId);
    if (!m) return;
    const admin = db.members.some((x) => x.familyId === m.familyId && x.userId === u.id && x.role === 'admin');
    if (m.userId !== u.id && !admin) throw new BackendError('forbidden');
    Object.assign(m, patch);
    await this.save();
  }
  async updatePointsConfig(familyId: string, cfg: PointsConfig) {
    const db = await this.load();
    const u = await this.me();
    if (!db.members.some((m) => m.familyId === familyId && m.userId === u.id && m.role === 'admin')) throw new BackendError('forbidden');
    const f = db.families.find((x) => x.id === familyId);
    if (f) f.pointsConfig = cfg;
    await this.save();
  }

  // ---------------- health ----------------
  async getHealthProfile(memberId: string) {
    await this.guard(memberId);
    return (await this.load()).profiles.find((p) => p.memberId === memberId) ?? null;
  }
  async saveHealthProfile(p: HealthProfile) {
    await this.guard(p.memberId);
    const db = await this.load();
    db.profiles = [...db.profiles.filter((x) => x.memberId !== p.memberId), p];
    await this.save();
  }
  async getGoals(memberId: string) {
    await this.guard(memberId);
    const g = (await this.load()).goals.find((x) => x.memberId === memberId);
    if (!g) return null;
    const { memberId: _m, ...rest } = g;
    return rest;
  }
  async saveGoals(memberId: string, g: DailyGoals) {
    await this.guard(memberId);
    const db = await this.load();
    db.goals = [...db.goals.filter((x) => x.memberId !== memberId), { ...g, memberId }];
    await this.save();
  }
  async getPrefs() {
    const db = await this.load();
    const u = await this.me();
    return { ...DEFAULT_PREFS, ...(db.prefs[u.id] ?? {}) };
  }
  async savePrefs(p: UserPrefs) {
    const db = await this.load();
    const u = await this.me();
    db.prefs[u.id] = p;
    await this.save();
  }

  // ---------------- logs ----------------
  async listFoodLogs(memberId: string, from: string, to: string) {
    await this.guard(memberId);
    return (await this.load()).foodLogs
      .filter((l) => l.memberId === memberId && l.logDate >= from && l.logDate <= to)
      .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  }
  async addFoodLog(log: NewFoodLog) {
    await this.guard(log.memberId);
    const db = await this.load();
    const existing = db.foodLogs.find((l) => l.memberId === log.memberId && l.dedupeKey === log.dedupeKey);
    if (existing) return existing;
    const full: FoodLog = { ...log, id: uid(), loggedAt: new Date().toISOString(), totals: sumNutrients(log.items.map((i) => i.nutrients)) };
    db.foodLogs.push(full);
    await this.save();
    return full;
  }
  async deleteFoodLog(id: string) {
    const db = await this.load();
    const l = db.foodLogs.find((x) => x.id === id);
    if (!l) return;
    await this.guard(l.memberId);
    db.foodLogs = db.foodLogs.filter((x) => x.id !== id);
    await this.save();
  }
  async listWater(memberId: string, from: string, to: string) {
    await this.guard(memberId);
    return (await this.load()).water.filter((l) => l.memberId === memberId && l.logDate >= from && l.logDate <= to);
  }
  async addWater(memberId: string, logDate: string, ml: number) {
    await this.guard(memberId);
    if (ml < 10 || ml > 2000) throw new BackendError('unknown', 'ml out of range');
    const db = await this.load();
    db.water.push({ id: uid(), memberId, logDate, ml, loggedAt: new Date().toISOString() });
    await this.save();
  }
  async deleteWater(id: string) {
    const db = await this.load();
    const l = db.water.find((x) => x.id === id);
    if (!l) return;
    await this.guard(l.memberId);
    db.water = db.water.filter((x) => x.id !== id);
    await this.save();
  }
  async listActivity(memberId: string, from: string, to: string) {
    await this.guard(memberId);
    return (await this.load()).activity.filter((l) => l.memberId === memberId && l.logDate >= from && l.logDate <= to);
  }
  async addActivity(a: Omit<ActivityLog, 'id' | 'loggedAt'>) {
    await this.guard(a.memberId);
    const db = await this.load();
    db.activity.push({ ...a, id: uid(), loggedAt: new Date().toISOString() });
    await this.save();
  }

  // ---------------- products ----------------
  async findProduct(familyId: string, barcode: string) {
    const db = await this.load();
    return db.products.find((p) => p.barcode === barcode && (p.familyId === familyId || p.familyId === null)) ?? null;
  }
  async saveProduct(familyId: string | null, p: Product) {
    const db = await this.load();
    db.products = [...db.products.filter((x) => !(x.barcode === p.barcode && x.familyId === familyId)), { ...p, familyId }];
    await this.save();
  }

  // ---------------- points ----------------
  async awardHabit(memberId: string, logDate: string, habit: Habit) {
    await this.guard(memberId);
    const db = await this.load();
    const m = db.members.find((x) => x.id === memberId)!;
    const fam = db.families.find((f) => f.id === m.familyId)!;
    const g = db.goals.find((x) => x.memberId === memberId);
    let ok = false;
    if (habit === 'water_goal') ok = !!g && db.water.filter((w) => w.memberId === memberId && w.logDate === logDate).reduce((s, w) => s + w.ml, 0) >= g.waterMl;
    if (habit === 'meal_logged') ok = db.foodLogs.some((l) => l.memberId === memberId && l.logDate === logDate);
    if (habit === 'activity') ok = db.activity.filter((a) => a.memberId === memberId && a.logDate === logDate).reduce((s, a) => s + a.minutes, 0) >= ACTIVITY_MIN_MINUTES;
    if (habit === 'steps_goal') ok = !!g && db.activity.filter((a) => a.memberId === memberId && a.logDate === logDate).reduce((s, a) => s + a.steps, 0) >= g.steps;
    if (!ok) return 0;
    if (db.points.some((p) => p.memberId === memberId && p.logDate === logDate && p.reason === habit)) return 0;
    const pts = fam.pointsConfig[habit] ?? 0;
    db.points.push({ familyId: fam.id, memberId, logDate, reason: habit, points: pts });
    await this.save();
    return pts;
  }
  async listPoints(familyId: string, from: string, to: string) {
    const db = await this.load();
    await this.listMembers(familyId); // membership check
    return db.points.filter((p) => p.familyId === familyId && p.logDate >= from && p.logDate <= to);
  }

  // ---------------- demo seed ----------------
  /** Creates a clearly-labelled demo family so the app can be explored without a backend. */
  async seedDemoFamily(myName: string): Promise<Membership> {
    const ms = await this.createFamily('عائلة تجريبية', myName, '👩');
    const db = await this.load();
    const today = new Date();
    const d = (n: number) => {
      const x = new Date(today);
      x.setDate(x.getDate() - n);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    };
    const demo: [string, MemberRole, string][] = [['أبو سالم (تجريبي)', 'adult', '👨'], ['ريم (تجريبي)', 'teen', '👧'], ['سالم (تجريبي)', 'child', '👦']];
    const ids: string[] = [];
    for (const [name, role, emoji] of demo) ids.push((await this.addManagedMember(ms.family.id, name, role, emoji)).id);
    const pattern: [number, Habit[]][] = [[0, ['water_goal', 'meal_logged']], [1, ['meal_logged', 'activity']], [2, ['water_goal', 'activity', 'steps_goal']]];
    const all = [ms.member.id, ...ids];
    all.forEach((mid, i) => {
      pattern.forEach(([ago, habits]) => {
        habits.slice(0, ((i + ago) % habits.length) + 1).forEach((h) => {
          if (mid === ms.member.id && ago === 0) return; // the real user's own "today" starts empty
          db.points.push({ familyId: ms.family.id, memberId: mid, logDate: d(ago), reason: h, points: DEFAULT_POINTS[h] });
        });
      });
    });
    await this.save();
    return ms;
  }
}

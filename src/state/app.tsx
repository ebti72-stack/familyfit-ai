import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { backend, DEFAULT_PREFS, type Membership, type Session, type UserPrefs } from '../backend';
import { dark, light, type Theme } from '../theme';
import type { Member } from '../lib/types';

interface AppCtx {
  booting: boolean;
  session: Session | null;
  membership: Membership | null;
  members: Member[];
  /** The member whose data is shown (self, or a supervised child selected by the admin). */
  viewingMember: Member | null;
  setViewingMemberId: (id: string | null) => void;
  prefs: UserPrefs;
  savePrefs: (p: Partial<UserPrefs>) => Promise<void>;
  theme: Theme;
  /** Bumped after any write so screens refetch. */
  version: number;
  bump: () => void;
  refreshFamily: () => Promise<void>;
  setMembership: (m: Membership | null) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const scheme = useColorScheme();
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [viewingId, setViewingMemberId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<UserPrefs>(DEFAULT_PREFS);
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const loadForSession = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setMembership(null);
      setMembers([]);
      setPrefs(DEFAULT_PREFS);
      return;
    }
    try {
      const [ms, p] = await Promise.all([backend.myMemberships(), backend.getPrefs()]);
      setPrefs(p);
      const m = ms[0] ?? null;
      setMembership(m);
      setMembers(m ? await backend.listMembers(m.family.id) : []);
    } catch {
      setMembership(null);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    backend
      .getSession()
      .then((s) => (alive ? loadForSession(s) : undefined))
      .finally(() => alive && setBooting(false));
    const off = backend.onAuthChange((s) => {
      loadForSession(s);
    });
    return () => {
      alive = false;
      off();
    };
  }, [loadForSession]);

  const refreshFamily = useCallback(async () => {
    if (!membership) return;
    const [ms, list] = await Promise.all([backend.myMemberships(), backend.listMembers(membership.family.id)]);
    const m = ms.find((x) => x.family.id === membership.family.id) ?? ms[0] ?? null;
    setMembership(m);
    setMembers(list);
    bump();
  }, [membership, bump]);

  const savePrefs = useCallback(
    async (patch: Partial<UserPrefs>) => {
      const next = { ...prefs, ...patch };
      setPrefs(next);
      await backend.savePrefs(next);
    },
    [prefs],
  );

  const setMembershipAndLoad = useCallback(
    (m: Membership | null) => {
      setMembership(m);
      if (m) backend.listMembers(m.family.id).then(setMembers).catch(() => undefined);
      bump();
    },
    [bump],
  );

  const theme = prefs.theme === 'dark' || (prefs.theme === 'system' && scheme === 'dark') ? dark : light;
  const viewingMember = members.find((m) => m.id === viewingId) ?? membership?.member ?? null;

  const value = useMemo<AppCtx>(
    () => ({
      booting, session, membership, members, viewingMember, setViewingMemberId, prefs, savePrefs, theme, version, bump, refreshFamily,
      setMembership: setMembershipAndLoad,
    }),
    [booting, session, membership, members, viewingMember, prefs, savePrefs, theme, version, bump, refreshFamily, setMembershipAndLoad],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}

export const useTheme = () => useApp().theme;

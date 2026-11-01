import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nManager, Platform } from 'react-native';
import { ar, en, type StringKey } from './strings';

export type Lang = 'ar' | 'en';
const KEY = 'familyfit.lang';
const dicts = { ar, en };

function applyDirection(lang: Lang) {
  const rtl = lang === 'ar';
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
  } else if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl); // takes full effect on next app launch
  }
}

interface I18nCtx {
  lang: Lang;
  rtl: boolean;
  t: (key: StringKey, params?: Record<string, string | number>) => string;
  /** Format a number with Western digits (clearer for nutrition data) and grouping. */
  n: (x: number, digits?: number) => string;
  setLang: (l: Lang) => Promise<void>;
  ready: boolean;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ar'); // Arabic is the default
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        const l: Lang = v === 'en' ? 'en' : 'ar';
        setLangState(l);
        applyDirection(l);
      })
      .catch(() => applyDirection('ar'))
      .finally(() => setReady(true));
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    setLangState(l);
    applyDirection(l);
    await AsyncStorage.setItem(KEY, l);
  }, []);

  const value = useMemo<I18nCtx>(() => {
    const d = dicts[lang];
    return {
      lang,
      rtl: lang === 'ar',
      ready,
      setLang,
      t: (key, params) => {
        let s: string = d[key] ?? ar[key] ?? key;
        if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
        return s;
      },
      n: (x, digits = 0) => {
        const v = Number.isFinite(x) ? x : 0;
        return v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
      },
    };
  }, [lang, ready, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useI18n outside provider');
  return c;
}

export type { StringKey };

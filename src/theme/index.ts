import { Platform } from 'react-native';

/** FamilyFit AI — Premium Modern HealthTech palette. */
export const brand = {
  forest: '#123D32',
  green: '#237B60',
  mint: '#E8F3EC',
  warmWhite: '#F8F8F5',
  gold: '#D9A441',
  water: '#83B8E5',
  coral: '#F1A47E',
  charcoal: '#292F2C',
  sage: '#8DB8A3',
};

export interface Theme {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  elevated: string;
  text: string;
  textMuted: string;
  textFaint: string;
  border: string;
  primary: string;
  primaryDeep: string;
  onPrimary: string;
  gold: string;
  water: string;
  coral: string;
  protein: string;
  carbs: string;
  fat: string;
  danger: string;
  track: string;
  shadow: string;
  aiFrom: string;
  aiTo: string;
}

export const light: Theme = {
  dark: false,
  bg: brand.warmWhite,
  surface: '#FFFFFF',
  surfaceAlt: brand.mint,
  elevated: '#FFFFFF',
  text: brand.charcoal,
  textMuted: '#66706B',
  textFaint: '#9AA39E',
  border: 'rgba(18,61,50,0.08)',
  primary: brand.green,
  primaryDeep: brand.forest,
  onPrimary: '#FFFFFF',
  gold: brand.gold,
  water: brand.water,
  coral: brand.coral,
  protein: brand.coral,
  carbs: brand.gold,
  fat: brand.sage,
  danger: '#C8553D',
  track: 'rgba(18,61,50,0.07)',
  shadow: '#123D32',
  aiFrom: brand.forest,
  aiTo: '#1E5C4A',
};

export const dark: Theme = {
  dark: true,
  bg: '#0C1613',
  surface: '#13201C',
  surfaceAlt: '#182A24',
  elevated: '#1A2B25',
  text: '#EDF2EE',
  textMuted: '#A3B0A9',
  textFaint: '#6F7C76',
  border: 'rgba(232,243,236,0.08)',
  primary: '#3E9E7E',
  primaryDeep: '#0A2A21',
  onPrimary: '#FFFFFF',
  gold: '#E2B35A',
  water: '#8FC1EA',
  coral: '#F3AE8C',
  protein: '#F3AE8C',
  carbs: '#E2B35A',
  fat: '#97C2AE',
  danger: '#E07A62',
  track: 'rgba(232,243,236,0.08)',
  shadow: '#000000',
  aiFrom: '#0A2A21',
  aiTo: '#174A3C',
};

export const radius = { sm: 12, md: 18, lg: 24, xl: 32, pill: 999 };
export const space = (n: number) => n * 4;

export const fonts = {
  regular: 'IBMPlexSansArabic_400Regular',
  medium: 'IBMPlexSansArabic_500Medium',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold',
};

export function cardShadow(t: Theme, level: 1 | 2 = 1) {
  if (t.dark) return {};
  return Platform.select({
    web: { boxShadow: level === 1 ? '0 1px 2px rgba(18,61,50,0.04), 0 8px 24px rgba(18,61,50,0.06)' : '0 2px 4px rgba(18,61,50,0.06), 0 16px 40px rgba(18,61,50,0.12)' } as any,
    default: { shadowColor: t.shadow, shadowOpacity: level === 1 ? 0.06 : 0.12, shadowRadius: level === 1 ? 16 : 28, shadowOffset: { width: 0, height: level === 1 ? 6 : 12 }, elevation: level === 1 ? 2 : 6 },
  });
}

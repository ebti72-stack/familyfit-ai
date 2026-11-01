import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useI18n, type StringKey } from '../i18n';
import type { Confidence, RecipeNutrition, UserRecipe } from '../lib/recipe';
import type { Nutrients } from '../lib/types';
import { useApp } from '../state/app';
import { brand, radius } from '../theme';
import { Card, Icon, IconButton, Pill, Row, Segmented, Txt } from './ui';

/** Back button + title used by every pushed screen. */
export function TopBar({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const { t } = useI18n();
  return (
    <Row gap={12} style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
      <IconButton icon="chevron-back" flipRtl label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} />
      <View style={{ flex: 1 }}>
        <Txt v="h2" numberOfLines={1}>{title}</Txt>
        {subtitle ? <Txt v="caption" muted numberOfLines={2}>{subtitle}</Txt> : null}
      </View>
      {right}
    </Row>
  );
}

export function ConfidencePill({ c }: { c: Confidence }) {
  const { t } = useI18n();
  const th = useApp().theme;
  const color = c === 'high' ? th.primary : c === 'medium' ? '#9A6B12' : th.danger;
  const bg = c === 'high' ? th.surfaceAlt : c === 'medium' ? (th.dark ? '#3A2B12' : '#FBF1DE') : th.dark ? '#3A1D16' : '#FBE6E0';
  return <Pill text={t('rd.confidence', { c: t(`rd.conf.${c}` as StringKey) })} color={color} bg={bg} icon={c === 'high' ? 'shield-checkmark' : 'alert-circle-outline'} />;
}

const ROWS: [keyof Nutrients, StringKey, 'kcal' | 'g' | 'mg'][] = [
  ['kcal', 'macro.kcal', 'kcal'], ['protein', 'macro.protein', 'g'], ['carbs', 'macro.carbs', 'g'], ['fat', 'macro.fat', 'g'],
  ['fiber', 'macro.fiber', 'g'], ['sugar', 'macro.sugar', 'g'], ['satFat', 'macro.satFat', 'g'], ['sodium', 'macro.sodium', 'mg'],
];

/** Eight nutrients for the whole recipe, one serving or 100 g — always computed, never estimated by AI. */
export function NutritionTable({ nut }: { nut: RecipeNutrition }) {
  const { t, n } = useI18n();
  const th = useApp().theme;
  const [mode, setMode] = useState<'serving' | 'whole' | 'per100'>('serving');
  const data = mode === 'serving' ? nut.perServing : mode === 'whole' ? nut.total : nut.per100g;
  const unit = (u: 'kcal' | 'g' | 'mg') => (u === 'kcal' ? t('common.kcal') : u === 'g' ? t('common.g') : t('common.mg'));
  return (
    <View style={{ gap: 12 }}>
      <Segmented value={mode} onChange={setMode} options={[{ value: 'serving', label: t('rd.perServing') }, { value: 'whole', label: t('rd.whole') }, { value: 'per100', label: t('rd.per100') }]} />
      {!data ? (
        <Txt v="caption" muted>{t('rd.per100Missing')}</Txt>
      ) : (
        <View style={{ borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: th.border }}>
          {ROWS.map(([k, label, u], i) => (
            <Row key={k} justify="space-between" style={{ paddingHorizontal: 14, paddingVertical: 9, backgroundColor: i % 2 ? th.surface : th.surfaceAlt }}>
              <Txt v={k === 'kcal' ? 'bodyStrong' : 'body'}>{t(label)}</Txt>
              <Txt v={k === 'kcal' ? 'number' : 'bodyStrong'}>{n(data[k], k === 'kcal' || k === 'sodium' ? 0 : 1)} <Txt v="caption" muted>{unit(u)}</Txt></Txt>
            </Row>
          ))}
        </View>
      )}
    </View>
  );
}

/** Library tile. */
export function RecipeTile({ r, kcal, fav, onPress, rating }: { r: UserRecipe; kcal: number | null; fav?: boolean; onPress: () => void; rating?: number | null }) {
  const { t, n } = useI18n();
  const th = useApp().theme;
  const mins = (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
  return (
    <Card onPress={onPress} padding={14}>
      <Row gap={12}>
        <View style={{ width: 58, height: 58, borderRadius: 18, backgroundColor: th.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 30 }}>{r.emoji || '🍽️'}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Txt v="h3" numberOfLines={2}>{r.title}</Txt>
          <Row gap={10} wrap>
            {kcal != null && <Txt v="caption" muted>{n(kcal)} {t('common.kcal')} · {t('rec.perServing')}</Txt>}
            {mins > 0 && <Row gap={3}><Icon name="time-outline" size={13} color={th.textMuted} /><Txt v="caption" muted>{t('common.minutes', { n: mins })}</Txt></Row>}
            {rating ? <Row gap={3}><Icon name="star" size={13} color={brand.gold} /><Txt v="caption" muted>{n(rating, 1)}</Txt></Row> : null}
          </Row>
          <Row gap={6} wrap>
            {r.versionKind === 'improved' && <Pill text={t('rec.improved')} icon="leaf" />}
            {r.sharedWithFamily && <Pill text={t('rec.shared')} icon="people" />}
          </Row>
        </View>
        {fav ? <Icon name="heart" size={20} color={th.coral} /> : <Icon name="chevron-forward" size={18} color={th.textFaint} flipRtl />}
      </Row>
    </Card>
  );
}

export function Stars({ value, onChange, size = 26 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <Row gap={4}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={onChange ? () => onChange(i) : undefined} disabled={!onChange} accessibilityLabel={`${i}`} hitSlop={4}>
          <Icon name={i <= value ? 'star' : 'star-outline'} size={size} color={brand.gold} />
        </Pressable>
      ))}
    </Row>
  );
}

/** Option row with a check mark, for single/multi selection lists. */
export function CheckRow({ label, sub, checked, onPress, right }: { label: string; sub?: string; checked: boolean; onPress: () => void; right?: ReactNode }) {
  const th = useApp().theme;
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <Row gap={12} style={{ paddingVertical: 10 }}>
        <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: checked ? th.primary : th.textFaint, backgroundColor: checked ? th.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {checked && <Icon name="checkmark" size={16} color="#fff" />}
        </View>
        <View style={{ flex: 1 }}>
          <Txt>{label}</Txt>
          {sub ? <Txt v="caption" muted>{sub}</Txt> : null}
        </View>
        {right}
      </Row>
    </Pressable>
  );
}

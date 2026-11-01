import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { TopBar } from '../../../components/recipe';
import { Banner, Button, Card, Icon, Row, Screen, Skeleton, Txt } from '../../../components/ui';
import { useI18n, type StringKey } from '../../../i18n';
import { computeRecipeNutrition } from '../../../lib/recipe';
import type { Nutrients } from '../../../lib/types';
import { useApp } from '../../../state/app';
import { useRecipe } from '../../../state/recipes';
import { brand, radius } from '../../../theme';

const KEYS: [keyof Nutrients, StringKey][] = [
  ['kcal', 'macro.kcal'], ['protein', 'macro.protein'], ['carbs', 'macro.carbs'], ['fat', 'macro.fat'], ['fiber', 'macro.fiber'], ['sugar', 'macro.sugar'], ['satFat', 'macro.satFat'], ['sodium', 'macro.sodium'],
];

export default function Compare() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, n } = useI18n();
  const th = useApp().theme;
  const { loading, recipe: r, parent } = useRecipe(id);

  if (loading) return <Screen header={<TopBar title={t('cmp.title')} />}><Skeleton height={200} r={24} /></Screen>;
  if (!r) return <Screen header={<TopBar title={t('cmp.title')} />}><Banner tone="warning" text={t('rd.notFound')} /></Screen>;
  if (!parent) return <Screen header={<TopBar title={t('cmp.title')} />}><Banner text={t('cmp.noParent')} /></Screen>;
  const a = computeRecipeNutrition(parent).perServing;
  const b = computeRecipeNutrition(r).perServing;
  const changes: string[] = [];
  r.ingredients.forEach((l, i) => {
    const o = parent.ingredients[i];
    if (!o) changes.push(`+ ${l.name}`);
    else if (o.foodId !== l.foodId || o.grams !== l.grams) changes.push(`${o.name}${o.grams != null ? ` (${n(o.grams)} ${t('common.g')})` : ''}  →  ${l.name}${l.grams != null ? ` (${n(l.grams)} ${t('common.g')})` : ''}`);
  });
  if (r.cookingMethod !== parent.cookingMethod) changes.push(t('cmp.method', { a: t(`rev.method.${parent.cookingMethod}` as StringKey), b: t(`rev.method.${r.cookingMethod}` as StringKey) }));

  return (
    <Screen header={<TopBar title={t('cmp.title')} subtitle={r.title} />}>
      <Card padding={0} style={{ overflow: 'hidden' }}>
        <Row style={{ backgroundColor: brand.forest, paddingHorizontal: 14, paddingVertical: 10 }}>
          <Txt v="label" color="#fff" style={{ flex: 1.3 }}>{t('rd.perServing')}</Txt>
          <Txt v="label" color="rgba(255,255,255,0.8)" style={{ flex: 1 }} center>{t('cmp.original')}</Txt>
          <Txt v="label" color={brand.gold} style={{ flex: 1 }} center>{t('cmp.improved')}</Txt>
        </Row>
        {KEYS.map(([k, label], i) => (
          <Row key={k} style={{ paddingHorizontal: 14, paddingVertical: 9, backgroundColor: i % 2 ? th.surface : th.surfaceAlt }}>
            <Txt style={{ flex: 1.3 }}>{t(label)}</Txt>
            <Txt style={{ flex: 1 }} center muted>{n(a[k], k === 'kcal' || k === 'sodium' ? 0 : 1)}</Txt>
            <Txt v="bodyStrong" style={{ flex: 1 }} center>{n(b[k], k === 'kcal' || k === 'sodium' ? 0 : 1)}</Txt>
          </Row>
        ))}
      </Card>
      <Card>
        <View style={{ gap: 8 }}>
          <Txt v="h3">{t('cmp.changes')}</Txt>
          {changes.map((c, i) => <Row key={i} gap={8} align="flex-start"><Icon name="swap-horizontal" size={16} color={th.primary} /><Txt style={{ flex: 1 }}>{c}</Txt></Row>)}
        </View>
      </Card>
      <Txt v="caption" faint>{t('sub.subtitle')}</Txt>
      <Row gap={10}>
        <View style={{ flex: 1 }}><Button kind="secondary" title={t('cmp.original')} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: parent.id } })} /></View>
        <View style={{ flex: 1 }}><Button title={t('cmp.improved')} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: r.id } })} /></View>
      </Row>
      <View style={{ borderRadius: radius.md }} />
    </Screen>
  );
}

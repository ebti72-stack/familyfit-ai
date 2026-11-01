import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { backend } from '../../backend';
import { Button, Card, ErrorState, Icon, IconButton, Pill, Row, Screen, Sheet, Skeleton, Txt } from '../../components/ui';
import { MacroBar, Ring } from '../../components/viz';
import { useI18n, type StringKey } from '../../i18n';
import type { FoodLog, MealType } from '../../lib/types';
import { useApp } from '../../state/app';
import { useDay } from '../../state/useDay';

const ORDER: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export default function Nutrition() {
  const { t, n } = useI18n();
  const { viewingMember, theme: th, bump } = useApp();
  const day = useDay(viewingMember?.id);
  const [selected, setSelected] = useState<FoodLog | null>(null);
  const g = day.goals;

  const remove = async (log: FoodLog) => {
    await backend.deleteFoodLog(log.id);
    setSelected(null);
    bump();
  };

  return (
    <Screen header={
      <Row justify="space-between" style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 }}>
        <Txt v="h1">{t('nut.title')}</Txt>
        <Row gap={8}>
          <IconButton icon="barcode-outline" label={t('nut.scan')} onPress={() => router.push('/scan')} />
          <IconButton icon="add" label={t('nut.addFood')} onPress={() => router.push('/add-food')} />
        </Row>
      </Row>
    }>
      {day.error ? <ErrorState onRetry={day.reload} /> : day.loading || !g ? <Skeleton height={260} r={24} /> : (
        <>
          <Card>
            <View style={{ gap: 16 }}>
              <Row gap={16}>
                <Ring size={110} stroke={11} progress={day.consumed.kcal / g.kcal} color={th.primary} gradientTo={th.gold}>
                  <Txt v="number" center>{n(day.remaining.kcal)}</Txt>
                  <Txt v="caption" faint center>{t('common.left')}</Txt>
                </Ring>
                <View style={{ flex: 1, gap: 8 }}>
                  <Stat label={t('common.goal')} value={`${n(g.kcal)} ${t('common.kcal')}`} />
                  <Stat label={t('common.consumed')} value={`${n(day.consumed.kcal)} ${t('common.kcal')}`} />
                  <Stat label={t('common.left')} value={`${n(day.remaining.kcal)} ${t('common.kcal')}`} strong />
                </View>
              </Row>
              <MacroBar label={t('macro.protein')} consumed={day.consumed.protein} goal={g.protein} color={th.protein} unit={t('common.g')} />
              <MacroBar label={t('macro.carbs')} consumed={day.consumed.carbs} goal={g.carbs} color={th.carbs} unit={t('common.g')} />
              <MacroBar label={t('macro.fat')} consumed={day.consumed.fat} goal={g.fat} color={th.fat} unit={t('common.g')} />
            </View>
          </Card>

          <Card>
            <View style={{ gap: 12 }}>
              <Txt v="h3">{t('nut.details')}</Txt>
              <MacroBar label={t('macro.fiber')} consumed={day.consumed.fiber} goal={g.fiber} color={th.primary} unit={t('common.g')} />
              <MacroBar label={t('macro.sugar')} consumed={day.consumed.sugar} goal={g.sugarMax} color={th.coral} unit={t('common.g')} limit />
              <MacroBar label={t('macro.satFat')} consumed={day.consumed.satFat} goal={g.satFatMax} color={th.fat} unit={t('common.g')} limit />
              <MacroBar label={t('macro.sodium')} consumed={day.consumed.sodium} goal={g.sodiumMax} color={th.water} unit="mg" limit />
            </View>
          </Card>

          <Txt v="h2">{t('nut.today')}</Txt>
          {day.foodLogs.length === 0 ? (
            <Card tone="alt">
              <View style={{ gap: 12, alignItems: 'center' }}>
                <Icon name="restaurant-outline" size={30} color={th.primary} />
                <Txt muted center>{t('nut.empty')}</Txt>
                <Button small full={false} title={t('ai.nextMeal')} icon="sparkles" onPress={() => router.push('/next-meal')} />
              </View>
            </Card>
          ) : ORDER.filter((m) => day.foodLogs.some((l) => l.mealType === m)).map((m) => (
            <View key={m} style={{ gap: 8 }}>
              <Txt v="label" muted>{t(`meal.${m}` as StringKey)}</Txt>
              {day.foodLogs.filter((l) => l.mealType === m).map((l) => (
                <Card key={l.id} padding={14} onPress={() => setSelected(l)}>
                  <Row justify="space-between" align="flex-start">
                    <View style={{ flex: 1, gap: 4 }}>
                      <Txt v="bodyStrong" numberOfLines={2}>{l.title}</Txt>
                      <Row gap={6} wrap>
                        <Pill text={t(`nut.source.${l.source}` as StringKey)} icon={l.source === 'barcode' ? 'barcode-outline' : l.source === 'next_meal' ? 'sparkles' : 'create-outline'} />
                        <Txt v="caption" muted>{t('macro.protein')} {n(l.totals.protein)} · {t('macro.carbs')} {n(l.totals.carbs)} · {t('macro.fat')} {n(l.totals.fat)} {t('common.g')}</Txt>
                      </Row>
                    </View>
                    <Txt v="number">{n(l.totals.kcal)}<Txt v="caption" muted> {t('common.kcal')}</Txt></Txt>
                  </Row>
                </Card>
              ))}
            </View>
          ))}
        </>
      )}

      <Sheet visible={!!selected} onClose={() => setSelected(null)} title={selected?.title}>
        {selected && (
          <>
            {selected.items.map((i, idx) => (
              <Row key={idx} justify="space-between">
                <Txt style={{ flex: 1 }}>{i.name}</Txt>
                <Txt muted>{n(i.grams)} {t('common.g')} · {n(i.nutrients.kcal)} {t('common.kcal')}</Txt>
              </Row>
            ))}
            <Button kind="danger" icon="trash-outline" title={t('common.delete')} onPress={() => remove(selected)} />
          </>
        )}
      </Sheet>
    </Screen>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Row justify="space-between">
      <Txt v="caption" muted>{label}</Txt>
      <Txt v={strong ? 'h3' : 'label'}>{value}</Txt>
    </Row>
  );
}

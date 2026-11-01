import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { backend } from '../backend';
import { Banner, Button, Card, Chip, ErrorState, Icon, IconButton, Pill, Row, Screen, Sheet, Skeleton, Toast, Txt } from '../components/ui';
import { MacroTriplet, Ring } from '../components/viz';
import { FOODS } from '../data/foods';
import { useI18n, type StringKey } from '../i18n';
import { localDate } from '../lib/dates';
import {
  fitPercent, recommendNextMeal, scaleAll, setIngredientGrams, swapIngredient, totalsOf, type MealSuggestion, type NextMealResult,
} from '../lib/nextMeal';
import type { MealType } from '../lib/types';
import { awardEarnedHabits, useToast } from '../state/actions';
import { useApp } from '../state/app';
import { useDay } from '../state/useDay';
import { brand, radius } from '../theme';

const KIND_COLOR = { best_fit: brand.gold, variety: brand.green, quick_budget: brand.coral } as const;

export default function NextMeal() {
  const { t, n, lang } = useI18n();
  const { viewingMember, prefs, savePrefs, bump, theme: th } = useApp();
  const day = useDay(viewingMember?.id);
  const toast = useToast();
  const [excluded, setExcluded] = useState<string[]>([]);
  const [mealOverride, setMealOverride] = useState<MealType | undefined>();
  const [cards, setCards] = useState<MealSuggestion[]>([]);
  const [result, setResult] = useState<NextMealResult | null>(null);

  const input = useMemo(() => {
    if (!day.goals || !day.profile) return null;
    return {
      dailyKcalGoal: day.goals.kcal,
      remaining: day.remaining,
      now: new Date(),
      mealsLoggedToday: Array.from(new Set(day.foodLogs.map((l) => l.mealType))),
      profile: { allergies: day.profile.allergies, dislikedFoods: day.profile.dislikedFoods, dietaryPreferences: day.profile.dietaryPreferences, isMinor: day.isMinor },
      prefs: { favorites: prefs.favoriteRecipes, rejected: prefs.rejectedRecipes, pantry: prefs.pantry, budgetTier: prefs.budgetTier },
      recentRecipeIds: prefs.recentRecipeIds,
      mealTypeOverride: mealOverride,
    };
  }, [day.goals, day.profile, day.remaining, day.foodLogs, day.isMinor, prefs, mealOverride]);

  useEffect(() => {
    if (!input) return;
    const r = recommendNextMeal({ ...input, excludeIds: excluded });
    setResult(r);
    setCards(r.suggestions);
    // excluded intentionally not a dependency: "another" replaces one card in place
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  const replaceCard = (idx: number) => {
    if (!input) return;
    const ex = [...excluded, ...cards.map((c) => c.recipe.id)];
    setExcluded((e) => [...e, cards[idx].recipe.id]);
    const r = recommendNextMeal({ ...input, excludeIds: ex });
    const pick = r.suggestions.find((s) => s.kind === cards[idx].kind) ?? r.suggestions[0];
    if (pick) setCards(cards.map((c, i) => (i === idx ? { ...pick, kind: c.kind } : c)));
  };

  const updateCard = (idx: number, ings: MealSuggestion['ingredients']) => {
    if (!result) return;
    setCards(cards.map((c, i) => (i === idx ? { ...c, ingredients: ings, totals: totalsOf(ings), fitPercent: fitPercent(totalsOf(ings), result.target) } : c)));
  };

  const addMeal = async (s: MealSuggestion) => {
    if (!viewingMember || !result) return;
    const sig = s.ingredients.map((i) => `${i.food}:${i.grams}`).join('|');
    await backend.addFoodLog({
      memberId: viewingMember.id, logDate: localDate(), mealType: result.mealType, title: s.recipe[lang], source: 'next_meal',
      dedupeKey: `next_meal:${localDate()}:${s.recipe.id}:${sig}`,
      items: s.ingredients.map((i) => ({ name: FOODS[i.food][lang], grams: i.grams, foodItemId: i.food, nutrients: i.nutrients })),
    });
    await savePrefs({ recentRecipeIds: [s.recipe.id, ...prefs.recentRecipeIds.filter((x) => x !== s.recipe.id)].slice(0, 20) });
    const pts = await awardEarnedHabits(viewingMember.id, localDate());
    toast.show(pts ? t('home.pointsEarned', { n: pts }) : t('nm.added'));
    bump();
  };

  const toggleFav = (id: string) =>
    savePrefs({ favoriteRecipes: prefs.favoriteRecipes.includes(id) ? prefs.favoriteRecipes.filter((x) => x !== id) : [...prefs.favoriteRecipes, id] });
  const reject = async (idx: number) => {
    const id = cards[idx].recipe.id;
    await savePrefs({ rejectedRecipes: [...prefs.rejectedRecipes, id] });
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen header={
        <Row gap={12} style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
          <IconButton icon="chevron-back" flipRtl label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} />
          <View style={{ flex: 1 }}>
            <Txt v="h2">{t('nm.title')}</Txt>
            {result && <Txt v="caption" muted>{t('nm.for', { meal: t(`meal.${result.mealType}` as StringKey) })}</Txt>}
          </View>
        </Row>
      }>
        {day.error ? <ErrorState onRetry={day.reload} /> : !result ? (
          <View style={{ gap: 12 }}><Skeleton height={120} r={24} /><Skeleton height={320} r={24} /><Skeleton height={320} r={24} /></View>
        ) : (
          <>
            <Row gap={8} wrap>
              {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((m) => (
                <Chip key={m} label={t(`meal.${m}` as StringKey)} selected={result.mealType === m} onPress={() => setMealOverride(m)} />
              ))}
            </Row>

            <LinearGradient colors={th.dark ? ['#0F2D24', '#0A1F19'] : [brand.forest, '#1B5646']} style={{ borderRadius: radius.lg, padding: 16, gap: 12 }}>
              <Row justify="space-between">
                <Txt v="label" color="rgba(255,255,255,0.75)">{t('nm.target')}</Txt>
                <Txt v="caption" color="rgba(255,255,255,0.6)">{t('nm.remaining')}: {n(day.remaining.kcal)} {t('common.kcal')}</Txt>
              </Row>
              <Row gap={8}>
                {([['kcal', result.target.kcal, brand.gold, t('common.kcal')], ['protein', result.target.protein, brand.coral, t('common.g')], ['carbs', result.target.carbs, '#F2D597', t('common.g')], ['fat', result.target.fat, brand.sage, t('common.g')]] as const).map(([k, v, c, u]) => (
                  <View key={k} style={{ flex: 1, gap: 2 }}>
                    <Txt v="caption" color="rgba(255,255,255,0.6)" numberOfLines={1}>{t(`macro.${k}` as StringKey)}</Txt>
                    <Txt v="number" color={c}>{n(v)}<Txt v="caption" color="rgba(255,255,255,0.6)"> {u}</Txt></Txt>
                  </View>
                ))}
              </Row>
            </LinearGradient>

            {result.mode !== 'normal' && <Banner tone="ai" text={t(result.mode === 'light' ? 'nm.mode.light' : 'nm.mode.goal_reached')} />}
            {cards.length === 0 && <Banner tone="warning" text={t('nm.empty')} />}

            {cards.map((s, idx) => (
              <MealCard
                key={`${s.kind}-${s.recipe.id}`}
                s={s}
                fav={prefs.favoriteRecipes.includes(s.recipe.id)}
                onFav={() => toggleFav(s.recipe.id)}
                onAdd={() => addMeal(s)}
                onAnother={() => replaceCard(idx)}
                onReject={() => reject(idx)}
                onChange={(ings) => updateCard(idx, ings)}
              />
            ))}
            <Txt v="caption" faint center>{t('nm.source')} · {t('ai.engineNote')}</Txt>
          </>
        )}
      </Screen>
      <Toast text={toast.msg ?? ''} visible={!!toast.msg} />
    </View>
  );
}

function MealCard({ s, fav, onFav, onAdd, onAnother, onReject, onChange }: {
  s: MealSuggestion; fav: boolean; onFav: () => void; onAdd: () => void; onAnother: () => void; onReject: () => void; onChange: (i: MealSuggestion['ingredients']) => void;
}) {
  const { t, n, lang } = useI18n();
  const th = useApp().theme;
  const [showRecipe, setShowRecipe] = useState(false);
  const [swapIdx, setSwapIdx] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const accent = KIND_COLOR[s.kind];

  return (
    <Card padding={0} style={{ overflow: 'hidden' }}>
      <LinearGradient colors={th.dark ? ['#1B3A30', '#13201C'] : ['#E8F3EC', '#F8F8F5']} style={{ padding: 18, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: th.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 42 }}>{s.recipe.emoji}</Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Pill text={t(`nm.kind.${s.kind}` as StringKey)} color={th.dark ? '#fff' : brand.forest} bg={accent + '40'} icon={s.kind === 'best_fit' ? 'star' : s.kind === 'variety' ? 'leaf' : 'flash'} />
          <Txt v="h3" numberOfLines={2}>{s.recipe[lang]}</Txt>
          <Row gap={10}>
            <Row gap={4}><Icon name="time-outline" size={14} color={th.textMuted} /><Txt v="caption" muted>{t('nm.prep', { n: s.recipe.prepMinutes })}</Txt></Row>
            <Txt v="caption" muted>{'$'.repeat(s.recipe.cost)}</Txt>
          </Row>
        </View>
        <Ring size={58} stroke={6} progress={s.fitPercent / 100} color={accent}>
          <Txt v="label" center style={{ fontSize: 12 }}>{s.fitPercent}%</Txt>
        </Ring>
      </LinearGradient>

      <View style={{ padding: 18, gap: 14 }}>
        <Row justify="space-between">
          <Txt v="numberLg" style={{ fontSize: 30, lineHeight: 36 }}>{n(s.totals.kcal)}<Txt v="caption" muted> {t('common.kcal')}</Txt></Txt>
          <Pressable onPress={onFav} accessibilityLabel={t('nm.favorite')} hitSlop={10}>
            <Icon name={fav ? 'heart' : 'heart-outline'} size={24} color={fav ? th.coral : th.textMuted} />
          </Pressable>
        </Row>
        <MacroTriplet protein={s.totals.protein} carbs={s.totals.carbs} fat={s.totals.fat} />

        <View style={{ gap: 4 }}>
          {s.reasons.map((r, i) => (
            <Row key={i} gap={6} align="flex-start"><Icon name="checkmark-circle" size={15} color={th.primary} /><Txt v="caption" muted style={{ flex: 1 }}>{t(r.key as StringKey, r.params)}</Txt></Row>
          ))}
        </View>

        <View style={{ gap: 8 }}>
          <Row justify="space-between">
            <Txt v="label">{t('nm.ingredients')}</Txt>
            <Row gap={6}>
              <Txt v="caption" muted>{t('nm.portion')}</Txt>
              <IconButton size={30} tone="alt" icon="remove" label="-" onPress={() => onChange(scaleAll(s.ingredients, 0.9))} />
              <IconButton size={30} tone="alt" icon="add" label="+" onPress={() => onChange(scaleAll(s.ingredients, 1.1))} />
            </Row>
          </Row>
          {s.ingredients.map((ing, i) => (
            <Row key={`${ing.food}-${i}`} gap={8} style={{ backgroundColor: th.surfaceAlt, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }}>
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong" numberOfLines={1}>{FOODS[ing.food][lang]}</Txt>
                <Txt v="caption" muted>{n(ing.nutrients.kcal)} {t('common.kcal')} · {t('macro.protein')} {n(ing.nutrients.protein, 1)} {t('common.g')}</Txt>
              </View>
              <IconButton size={28} tone="surface" icon="remove" label="-" onPress={() => onChange(setIngredientGrams(s.ingredients, i, ing.grams - 10))} />
              <Txt v="label" style={{ minWidth: 48 }} center>{n(ing.grams)} {t('common.g')}</Txt>
              <IconButton size={28} tone="surface" icon="add" label="+" onPress={() => onChange(setIngredientGrams(s.ingredients, i, ing.grams + 10))} />
              {ing.swaps.length > 0 && <IconButton size={28} tone="surface" icon="swap-horizontal" label={t('nm.swap')} onPress={() => setSwapIdx(i)} />}
            </Row>
          ))}
        </View>

        <Pressable onPress={() => setShowRecipe(!showRecipe)}>
          <Row gap={6}><Icon name={showRecipe ? 'chevron-up' : 'book-outline'} size={16} color={th.primary} /><Txt v="label" color={th.primary}>{showRecipe ? t('nm.hideRecipe') : t('nm.showRecipe')}</Txt></Row>
        </Pressable>
        {showRecipe && (
          <View style={{ gap: 8 }}>
            {(lang === 'ar' ? s.recipe.stepsAr : s.recipe.stepsEn).map((step, i) => (
              <Row key={i} gap={10} align="flex-start">
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: th.primary, alignItems: 'center', justifyContent: 'center' }}><Txt v="caption" color="#fff" center>{i + 1}</Txt></View>
                <Txt style={{ flex: 1 }}>{step}</Txt>
              </Row>
            ))}
          </View>
        )}

        <Button title={t('nm.add')} icon="add-circle-outline" loading={adding} onPress={async () => { setAdding(true); try { await onAdd(); } finally { setAdding(false); } }} />
        <Row gap={10}>
          <View style={{ flex: 1 }}><Button small kind="secondary" icon="refresh" title={t('nm.another')} onPress={onAnother} /></View>
          <View style={{ flex: 1 }}><Button small kind="ghost" icon="close-circle-outline" title={t('nm.notForMe')} onPress={onReject} /></View>
        </Row>
      </View>

      <Sheet visible={swapIdx !== null} onClose={() => setSwapIdx(null)} title={t('nm.swap')}>
        {swapIdx !== null && s.ingredients[swapIdx]?.swaps.map((f) => (
          <Card key={f} padding={14} onPress={() => { onChange(swapIngredient(s.ingredients, swapIdx, f)); setSwapIdx(null); }}>
            <Row justify="space-between">
              <Txt v="bodyStrong">{FOODS[f][lang]}</Txt>
              <Txt v="caption" muted>{n(FOODS[f].per100.kcal)} {t('common.kcal')} / 100 {t('common.g')} · {t('macro.protein')} {n(FOODS[f].per100.protein, 1)} {t('common.g')}</Txt>
            </Row>
          </Card>
        ))}
      </Sheet>
    </Card>
  );
}

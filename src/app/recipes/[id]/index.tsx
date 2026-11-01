import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Switch, Text, View } from 'react-native';
import { backend, type RecipeRating } from '../../../backend';
import { ConfidencePill, NutritionTable, Stars, TopBar } from '../../../components/recipe';
import { Banner, Button, Card, Chip, Field, Icon, IconButton, Pill, PressableScale, Row, Screen, Sheet, Skeleton, Toast, Txt } from '../../../components/ui';
import { FOODS } from '../../../data/foods';
import { useI18n, type StringKey } from '../../../i18n';
import { localDate } from '../../../lib/dates';
import { fitPercent, mealTypeForTime } from '../../../lib/nextMeal';
import { scaleNutrients } from '../../../lib/nutrition';
import { computeRecipeNutrition, isBuiltinRef, scaleNutrientsBy, SERVING_OPTIONS, type UserRecipe } from '../../../lib/recipe';
import type { MealType } from '../../../lib/types';
import { awardEarnedHabits, useToast } from '../../../state/actions';
import { useApp } from '../../../state/app';
import { useFasting } from '../../../state/fasting';
import { setDraft } from '../../../state/recipeDraft';
import { editableCopy, FOLDERS, useRecipe } from '../../../state/recipes';
import { useDay } from '../../../state/useDay';
import { brand, radius } from '../../../theme';

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, n, lang } = useI18n();
  const { viewingMember, membership, members, bump, theme: th } = useApp();
  const { loading, recipe: r, fav } = useRecipe(id);
  const day = useDay(viewingMember?.id);
  const fasting = useFasting(viewingMember?.id);
  const toast = useToast();
  const [portion, setPortion] = useState(1);
  const [confirmAdd, setConfirmAdd] = useState(false);
  const [meal, setMeal] = useState<MealType>(mealTypeForTime(new Date()));
  const [favOpen, setFavOpen] = useState(false);
  const [folders, setFolders] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [ratings, setRatings] = useState<RecipeRating[]>([]);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nut = useMemo(() => (r ? computeRecipeNutrition(r) : null), [r]);

  useEffect(() => {
    if (!id) return;
    backend.listRatings(id).then((list) => {
      setRatings(list);
      const mine = list.find((x) => x.memberId === viewingMember?.id);
      if (mine) { setStars(mine.stars); setComment(mine.comment); }
    }).catch(() => setRatings([]));
  }, [id, viewingMember]);
  useEffect(() => {
    setFolders(fav?.folders ?? []);
    setNote(fav?.note ?? '');
  }, [fav]);
  useEffect(() => {
    if (fasting.fastingToday) setMeal(new Date().getHours() < 5 ? 'suhoor' : 'iftar');
  }, [fasting.fastingToday]);

  if (loading) return <Screen header={<TopBar title="" />}><Skeleton height={200} r={24} /></Screen>;
  if (!r || !nut || !viewingMember || !membership) return <Screen header={<TopBar title="" />}><Banner tone="warning" text={t('rd.notFound')} /></Screen>;

  const isOwner = !isBuiltinRef(r.id) && r.ownerMemberId === viewingMember.id;
  const adds = scaleNutrientsBy(nut.perServing, portion);
  const target = day.remaining;
  const fit = day.goals ? fitPercent(adds, target) : null;
  const mins = (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
  const avg = ratings.length ? ratings.reduce((s, x) => s + x.stars, 0) / ratings.length : 0;
  const nameOf = (mid: string) => members.find((m) => m.id === mid)?.displayName ?? '';

  const saveFav = async () => {
    await backend.saveFavoriteRecipe(viewingMember.id, { ref: r.id, folders, note });
    setFavOpen(false);
    bump();
    toast.show(t('common.saved'));
  };
  const removeFav = async () => {
    await backend.removeFavoriteRecipe(viewingMember.id, r.id);
    setFavOpen(false);
    bump();
  };

  const addToPlan = async () => {
    const f = portion / Math.max(1, r.servings);
    const items = r.ingredients.filter((l) => l.foodId && FOODS[l.foodId] && l.grams).map((l) => {
      const g = Math.round(l.grams! * f * 10) / 10;
      return { name: l.name, grams: g, foodItemId: l.foodId, nutrients: scaleNutrients(FOODS[l.foodId!].per100, g) };
    }).filter((i) => i.grams > 0);
    if (nut.absorbedOilG > 0) {
      const g = Math.round(nut.absorbedOilG * f * 10) / 10;
      items.push({ name: FOODS.veg_oil[lang], grams: g, foodItemId: 'veg_oil', nutrients: scaleNutrients(FOODS.veg_oil.per100, g) });
    }
    await backend.addFoodLog({
      memberId: viewingMember.id, logDate: localDate(), mealType: meal, title: r.title, source: 'recipe',
      dedupeKey: `recipe:${localDate()}:${r.id}:${portion}:${Math.floor(Date.now() / 60000)}`, items,
    });
    const pts = await awardEarnedHabits(viewingMember.id, localDate());
    setConfirmAdd(false);
    toast.show(pts ? t('home.pointsEarned', { n: pts }) : t('rd.added'));
    bump();
  };

  const rate = async () => {
    if (!stars) return;
    await backend.rateRecipe(viewingMember.id, r.id, stars, comment.trim());
    setRatings(await backend.listRatings(r.id));
    bump();
    toast.show(t('common.saved'));
  };

  const edit = () => {
    setDraft({ recipe: editableCopy(r, viewingMember.id, membership.family.id) as UserRecipe, sourceText: null, alternatives: [], message: null });
    router.push('/recipes/review');
  };

  const Action = ({ icon, label, onPress, color }: { icon: any; label: string; onPress: () => void; color: string }) => (
    <View style={{ width: '48%', flexGrow: 1 }}>
      <Card padding={14} onPress={onPress}>
        <Row gap={10}><Icon name={icon} size={20} color={color} /><Txt v="label" style={{ flex: 1 }} numberOfLines={2}>{label}</Txt></Row>
      </Card>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Screen header={<TopBar title={r.title} right={<IconButton icon={fav ? 'heart' : 'heart-outline'} label={t('rd.favorite')} onPress={() => setFavOpen(true)} />} />}>
        <Card>
          <Row gap={14}>
            <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: th.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 42 }}>{r.emoji}</Text></View>
            <View style={{ flex: 1, gap: 6 }}>
              <Txt v="h3">{r.title}</Txt>
              <Row gap={10} wrap>
                <Txt v="caption" muted>{t('common.servings', { n: r.servings })}</Txt>
                {mins > 0 && <Txt v="caption" muted>{t('common.minutes', { n: mins })}</Txt>}
                {r.cookingMethod !== 'none' && <Txt v="caption" muted>{t(`rev.method.${r.cookingMethod}` as StringKey)}</Txt>}
                {avg > 0 && <Row gap={3}><Icon name="star" size={13} color={brand.gold} /><Txt v="caption" muted>{n(avg, 1)} ({ratings.length})</Txt></Row>}
              </Row>
              <Row gap={6} wrap>
                <ConfidencePill c={nut.confidence} />
                {r.versionKind === 'improved' && <Pill text={t('rec.improved')} icon="leaf" />}
              </Row>
            </View>
          </Row>
        </Card>

        {/* Translation for the home helper: prominent */}
        <PressableScale onPress={() => router.push({ pathname: '/recipes/[id]/translate', params: { id: r.id, lang: 'fil' } })} accessibilityLabel={t('rd.translateFil')}>
          <View style={{ backgroundColor: brand.forest, borderRadius: radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(217,164,65,0.2)', alignItems: 'center', justifyContent: 'center' }}><Icon name="language" size={22} color={brand.gold} /></View>
            <View style={{ flex: 1 }}>
              <Txt v="h3" color="#fff">{t('rd.translateFil')}</Txt>
              <Txt v="caption" color="rgba(255,255,255,0.75)">{t('tr.filipinoBody')}</Txt>
            </View>
            <Icon name="arrow-forward" size={20} color={brand.gold} flipRtl />
          </View>
        </PressableScale>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Action icon="document-text-outline" label={t('rd.document')} color={th.primary} onPress={() => router.push({ pathname: '/recipes/[id]/document', params: { id: r.id } })} />
          <Action icon="leaf-outline" label={t('rd.substitutions')} color={th.primary} onPress={() => router.push({ pathname: '/recipes/[id]/substitutions', params: { id: r.id } })} />
          {r.parentId ? <Action icon="git-compare-outline" label={t('rd.compare')} color={th.coral} onPress={() => router.push({ pathname: '/recipes/[id]/compare', params: { id: r.id } })} /> : null}
          <Action icon="globe-outline" label={t('rd.translate')} color={th.water} onPress={() => router.push({ pathname: '/recipes/[id]/translate', params: { id: r.id } })} />
        </View>

        {/* Fit with remaining macros + add to plan */}
        {day.goals && (
          <Card>
            <View style={{ gap: 12 }}>
              <Row justify="space-between">
                <Txt v="h3">{t('rd.fit')}</Txt>
                {fit != null && <Pill text={t('rd.fitPct', { p: fit })} icon="analytics-outline" />}
              </Row>
              <Row gap={6} wrap>
                <Txt v="label" muted>{t('rd.portion')}</Txt>
                {SERVING_OPTIONS.map((p) => <Chip key={p} label={t('rd.portionN', { n: p })} selected={portion === p} onPress={() => setPortion(p)} />)}
              </Row>
              <Row gap={8}>
                {([['kcal', t('common.kcal')], ['protein', t('common.g')], ['carbs', t('common.g')], ['fat', t('common.g')]] as const).map(([k, u]) => (
                  <View key={k} style={{ flex: 1, backgroundColor: th.surfaceAlt, borderRadius: radius.md, padding: 10, gap: 2 }}>
                    <Txt v="caption" muted numberOfLines={1} style={{ fontSize: 11 }}>{t(`macro.${k}` as StringKey)}</Txt>
                    <Txt v="bodyStrong" style={{ writingDirection: 'ltr' }}>+{n(adds[k])}</Txt>
                    <Txt v="caption" faint style={{ fontSize: 11 }}>{t('rd.leftAfter')}: {n(Math.max(0, target[k] - adds[k]))} {u}</Txt>
                  </View>
                ))}
              </Row>
              {nut.uncounted.length > 0 ? <Banner tone="warning" text={t('rd.cantLog')} /> : (
                <Button icon="add-circle-outline" title={t('rd.addToPlan')} onPress={() => setConfirmAdd(true)} />
              )}
            </View>
          </Card>
        )}

        <Card>
          <View style={{ gap: 12 }}>
            <Row justify="space-between"><Txt v="h3">{t('rd.nutrition')}</Txt><ConfidencePill c={nut.confidence} /></Row>
            <NutritionTable nut={nut} />
            <Txt v="caption" muted>{t(`rd.conf.${nut.confidence}Body` as StringKey)}</Txt>
            {nut.uncounted.length > 0 && <Txt v="caption" color={th.coral}>{t('rd.uncounted', { list: nut.uncounted.join('، ') })}</Txt>}
            {nut.absorbedOilG > 0 && <Txt v="caption" muted>{t('rd.oil', { g: n(nut.absorbedOilG) })}</Txt>}
            <Txt v="caption" faint>{t('rd.source')}</Txt>
          </View>
        </Card>

        <Card>
          <View style={{ gap: 8 }}>
            <Txt v="h3">{t('rd.ingredients')}</Txt>
            {r.ingredients.map((l, i) => (
              <Row key={i} gap={10}>
                <Icon name="ellipse" size={7} color={th.primary} />
                <Txt style={{ flex: 1 }}>{l.name}</Txt>
                <Txt v="caption" muted>{l.grams != null ? `${n(l.grams)} ${t('common.g')}` : l.toTaste ? t('rev.toTaste') : '—'}</Txt>
              </Row>
            ))}
            {r.tools.length > 0 && <Txt v="caption" muted>{t('rd.tools')}: {r.tools.join('، ')}</Txt>}
          </View>
        </Card>

        {r.steps.length > 0 && (
          <Card>
            <View style={{ gap: 10 }}>
              <Txt v="h3">{t('rd.steps')}</Txt>
              {r.steps.map((s, i) => (
                <Row key={i} gap={10} align="flex-start">
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: th.primary, alignItems: 'center', justifyContent: 'center' }}><Txt v="caption" color="#fff" center>{i + 1}</Txt></View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Txt>{s.text}</Txt>
                    <Row gap={6}>
                      {s.minutes ? <Pill text={t('common.minutes', { n: s.minutes })} icon="time-outline" /> : null}
                      {s.tempC ? <Pill text={`${s.tempC}°C`} icon="thermometer-outline" /> : null}
                    </Row>
                  </View>
                </Row>
              ))}
            </View>
          </Card>
        )}

        {r.sourceUrl && <Button small kind="ghost" icon="open-outline" title={t('rd.openSource')} onPress={() => Linking.openURL(r.sourceUrl!).catch(() => undefined)} />}

        {isOwner && (
          <Card>
            <View style={{ gap: 6 }}>
              <Row justify="space-between">
                <Txt v="h3" style={{ flex: 1 }}>{t('rd.shareFamily')}</Txt>
                <Switch value={r.sharedWithFamily} onValueChange={async (v) => { await backend.setRecipeShared(r.id, v, viewingMember.id); bump(); }} trackColor={{ true: th.primary }} />
              </Row>
              <Txt v="caption" muted>{t('rd.shareFamilyHint')}</Txt>
            </View>
          </Card>
        )}

        <Card>
          <View style={{ gap: 10 }}>
            <Txt v="h3">{t('rd.rating')}</Txt>
            {ratings.filter((x) => x.memberId !== viewingMember.id).length === 0 ? <Txt v="caption" muted>{t('rd.noRatings')}</Txt> : ratings.filter((x) => x.memberId !== viewingMember.id).map((x) => (
              <View key={x.memberId} style={{ gap: 2 }}>
                <Row gap={8}><Txt v="bodyStrong">{nameOf(x.memberId)}</Txt><Stars value={x.stars} size={14} /></Row>
                {x.comment ? <Txt v="caption" muted>{x.comment}</Txt> : null}
              </View>
            ))}
            <Txt v="label" muted>{t('rd.yourRating')}</Txt>
            <Stars value={stars} onChange={setStars} />
            <Field label={t('rd.comment')} value={comment} onChangeText={setComment} />
            <Button small kind="secondary" title={t('rd.sendRating')} disabled={!stars} onPress={rate} />
          </View>
        </Card>

        {(isOwner || isBuiltinRef(r.id)) && <Button kind="secondary" icon="create-outline" title={t('rd.editRecipe')} onPress={edit} />}
        {isOwner && <Button kind="danger" icon="trash-outline" title={t('rd.deleteRecipe')} onPress={() => setConfirmDelete(true)} />}
      </Screen>

      <Sheet visible={confirmAdd} onClose={() => setConfirmAdd(false)} title={t('rd.addToPlan')}>
        <Row gap={6} wrap>
          {(['breakfast', 'lunch', 'dinner', 'snack', 'suhoor', 'iftar'] as MealType[]).map((m) => <Chip key={m} label={t(`meal.${m}` as StringKey)} selected={meal === m} onPress={() => setMeal(m)} />)}
        </Row>
        <Txt>{t('rd.addConfirm', { n: portion, k: n(adds.kcal), m: t(`meal.${meal}` as StringKey) })}</Txt>
        <Button title={t('common.confirm')} icon="checkmark" onPress={addToPlan} />
        <Button kind="secondary" title={t('common.cancel')} onPress={() => setConfirmAdd(false)} />
      </Sheet>

      <Sheet visible={favOpen} onClose={() => setFavOpen(false)} title={t('rd.folders')}>
        <Row gap={6} wrap>
          {FOLDERS.map((f) => <Chip key={f} label={t(`rec.folder.${f}` as StringKey)} selected={folders.includes(f)} onPress={() => setFolders(folders.includes(f) ? folders.filter((x) => x !== f) : [...folders, f])} />)}
        </Row>
        <Field label={t('rd.note')} value={note} onChangeText={setNote} multiline />
        <Button icon="heart" title={t('common.save')} onPress={saveFav} />
        {fav && <Button kind="ghost" title={t('rd.unfavorite')} onPress={removeFav} />}
      </Sheet>

      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title={t('rd.deleteRecipe')}>
        <Txt>{t('rd.deleteConfirm')}</Txt>
        <Button kind="danger" title={t('common.delete')} onPress={async () => { await backend.deleteRecipe(r.id); bump(); router.back(); }} />
        <Button kind="secondary" title={t('common.cancel')} onPress={() => setConfirmDelete(false)} />
      </Sheet>
      <Toast text={toast.msg ?? ''} visible={!!toast.msg} />
    </View>
  );
}

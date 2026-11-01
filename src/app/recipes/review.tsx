import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { backend } from '../../backend';
import { blankLine, IngredientEditor } from '../../components/IngredientEditor';
import { ConfidencePill, TopBar } from '../../components/recipe';
import { Banner, Button, Card, Chip, Field, Icon, IconButton, Pill, Row, Screen, Txt } from '../../components/ui';
import { useI18n, type StringKey } from '../../i18n';
import { computeRecipeNutrition, minutesIn, needsReview, tempIn, type CookingMethod, type RecipeIngredientLine, type UserRecipe } from '../../lib/recipe';
import type { MealType } from '../../lib/types';
import { useApp } from '../../state/app';
import { getDraft, setDraft } from '../../state/recipeDraft';
import { fonts, radius } from '../../theme';

const METHODS: CookingMethod[] = ['none', 'boiled', 'baked', 'grilled', 'pan_fried', 'deep_fried', 'air_fried', 'steamed'];
const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack', 'suhoor', 'iftar'];

export default function Review() {
  const { t, n, rtl } = useI18n();
  const { bump, theme: th } = useApp();
  const initial = getDraft();
  const [r, setR] = useState<UserRecipe | null>(initial?.recipe ?? null);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const nut = useMemo(() => (r ? computeRecipeNutrition(r) : null), [r]);

  if (!r || !nut) {
    return (
      <Screen header={<TopBar title={t('rev.title')} />}>
        <Banner tone="warning" text={t('rd.notFound')} />
        <Button title={t('imp.title')} onPress={() => router.replace('/recipes/import')} />
      </Screen>
    );
  }
  const up = (p: Partial<UserRecipe>) => setR({ ...r, ...p });
  const review = r.ingredients.filter(needsReview).length;
  const intOrNull = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null);
  const editing = editIdx != null ? (editIdx === -1 ? blankLine() : r.ingredients[editIdx]) : null;

  const saveLine = (l: RecipeIngredientLine) => {
    if (editIdx === -1) up({ ingredients: [...r.ingredients, l] });
    else if (editIdx != null) up({ ingredients: r.ingredients.map((x, i) => (i === editIdx ? l : x)) });
    setEditIdx(null);
  };

  const save = async () => {
    if (!r.title.trim()) return setErr(t('rev.titleRequired'));
    setBusy(true);
    setErr(null);
    try {
      const steps = r.steps.filter((s) => s.text.trim()).map((s) => ({ text: s.text.trim(), minutes: minutesIn(s.text), tempC: tempIn(s.text) }));
      const saved = await backend.saveRecipe({ ...r, title: r.title.trim(), steps });
      setDraft(null);
      bump();
      router.replace({ pathname: '/recipes/[id]', params: { id: saved.id } });
    } catch {
      setErr(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen header={<TopBar title={t('rev.title')} />}>
        {initial?.message ? <Banner tone="ai" text={initial.message} /> : null}
        {review > 0 ? <Banner tone="warning" text={t('rev.reviewBanner', { n: review })} /> : <Banner text={t('rev.allGood')} />}

        <Card>
          <View style={{ gap: 12 }}>
            <Field label={t('rev.recipeName')} value={r.title} onChangeText={(v) => up({ title: v })} />
            <Row gap={10}>
              <View style={{ flex: 1 }}><Field label={t('rev.servings')} value={String(r.servings)} onChangeText={(v) => up({ servings: Math.max(1, intOrNull(v) ?? 1) })} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label={t('rev.prep')} value={r.prepMinutes != null ? String(r.prepMinutes) : ''} onChangeText={(v) => up({ prepMinutes: intOrNull(v) })} keyboardType="number-pad" /></View>
              <View style={{ flex: 1 }}><Field label={t('rev.cook')} value={r.cookMinutes != null ? String(r.cookMinutes) : ''} onChangeText={(v) => up({ cookMinutes: intOrNull(v) })} keyboardType="number-pad" /></View>
            </Row>
            <Txt v="label" muted>{t('rev.method')}</Txt>
            <Row gap={6} wrap>{METHODS.map((m) => <Chip key={m} label={t(`rev.method.${m}` as StringKey)} selected={r.cookingMethod === m} onPress={() => up({ cookingMethod: m })} />)}</Row>
            <Txt v="label" muted>{t('rd.folders')}</Txt>
            <Row gap={6} wrap>{MEALS.map((m) => <Chip key={m} label={t(`meal.${m}` as StringKey)} selected={r.mealTypes.includes(m)} onPress={() => up({ mealTypes: r.mealTypes.includes(m) ? r.mealTypes.filter((x) => x !== m) : [...r.mealTypes, m] })} />)}</Row>
            <Field label={t('rev.finalWeight')} hint={t('rev.finalWeightHint')} value={r.finalWeightG != null ? String(r.finalWeightG) : ''} onChangeText={(v) => up({ finalWeightG: intOrNull(v) })} keyboardType="number-pad" />
          </View>
        </Card>

        <Row justify="space-between">
          <Txt v="h2">{t('rev.extracted')}</Txt>
          <ConfidencePill c={nut.confidence} />
        </Row>
        <Card padding={6}>
          {r.ingredients.map((l, i) => {
            const flag = needsReview(l);
            const status = !l.foodId ? t('rev.unknownFood') : l.toTaste && l.grams == null ? t('rev.toTaste') : l.grams == null ? t('rev.needsQty') : l.estimated && !l.confirmed ? t('rev.estimated') : null;
            return (
              <Pressable key={i} onPress={() => setEditIdx(i)}>
                <Row gap={10} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                  <Icon name={flag ? 'alert-circle' : 'checkmark-circle'} size={20} color={flag ? th.coral : th.primary} />
                  <View style={{ flex: 1 }}>
                    <Txt v="bodyStrong">{l.name || l.raw}</Txt>
                    <Txt v="caption" muted>{l.grams != null ? `${n(l.grams)} ${t('common.g')}` : '—'}{l.raw && l.raw !== l.name ? ` · ${l.raw}` : ''}</Txt>
                  </View>
                  {status && <Pill text={status} color={flag ? th.coral : th.textMuted} />}
                  <Icon name="create-outline" size={18} color={th.textFaint} />
                </Row>
              </Pressable>
            );
          })}
          <View style={{ padding: 8 }}><Button small kind="secondary" icon="add" title={t('rev.addIngredient')} onPress={() => setEditIdx(-1)} /></View>
        </Card>
        {nut.uncounted.length > 0 && <Txt v="caption" color={th.coral}>{t('rd.uncounted', { list: nut.uncounted.join('، ') })}</Txt>}
        <Card tone="alt">
          <Row justify="space-between">
            <Txt v="label">{t('rd.perServing')}</Txt>
            <Txt v="number">{n(nut.perServing.kcal)} <Txt v="caption" muted>{t('common.kcal')}</Txt></Txt>
          </Row>
          <Txt v="caption" muted>{t('macro.protein')} {n(nut.perServing.protein, 1)} · {t('macro.carbs')} {n(nut.perServing.carbs, 1)} · {t('macro.fat')} {n(nut.perServing.fat, 1)} {t('common.g')}</Txt>
        </Card>

        <Txt v="h2">{t('rev.steps')}</Txt>
        {r.steps.map((s, i) => (
          <Row key={i} gap={8} align="flex-start">
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: th.primary, alignItems: 'center', justifyContent: 'center', marginTop: 10 }}><Txt v="caption" color="#fff" center>{i + 1}</Txt></View>
            <TextInput
              value={s.text} multiline onChangeText={(v) => up({ steps: r.steps.map((x, j) => (j === i ? { ...x, text: v } : x)) })}
              style={{ flex: 1, minHeight: 48, borderRadius: radius.md, backgroundColor: th.surface, borderWidth: 1, borderColor: th.border, padding: 12, color: th.text, fontFamily: fonts.regular, fontSize: 15, textAlign: rtl ? 'right' : 'left' }}
            />
            <IconButton size={34} tone="alt" icon="trash-outline" label={t('rev.remove')} onPress={() => up({ steps: r.steps.filter((_, j) => j !== i) })} />
          </Row>
        ))}
        <Button small kind="secondary" icon="add" title={t('rev.addStep')} onPress={() => up({ steps: [...r.steps, { text: '', minutes: null, tempC: null }] })} />

        {initial?.sourceText ? (
          <Card tone="alt">
            <Pressable onPress={() => setShowSource(!showSource)}><Row gap={6}><Icon name={showSource ? 'chevron-up' : 'document-text-outline'} size={16} color={th.primary} /><Txt v="label" color={th.primary}>{t('rev.sourceText')}</Txt></Row></Pressable>
            {showSource && <Txt v="caption" muted style={{ marginTop: 8 }}>{initial.sourceText}</Txt>}
          </Card>
        ) : null}
        {r.sourceUrl ? <Txt v="caption" faint>{t('rev.source')}: {r.sourceUrl}</Txt> : null}
        {err && <Banner tone="warning" text={err} />}
        <Button title={t('rev.save')} icon="checkmark-circle-outline" loading={busy} onPress={save} />
        <Txt v="caption" faint center>{t('rd.source')}</Txt>
      </Screen>
      <IngredientEditor
        line={editing} visible={editIdx != null} onClose={() => setEditIdx(null)} onSave={saveLine}
        onRemove={editIdx != null && editIdx >= 0 ? () => { up({ ingredients: r.ingredients.filter((_, i) => i !== editIdx) }); setEditIdx(null); } : undefined}
      />
    </View>
  );
}

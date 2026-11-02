import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { backend } from '../backend';
import { Banner, Button, Card, Chip, Field, IconButton, Row, Screen, Toast, Txt } from '../components/ui';
import { MacroTriplet } from '../components/viz';
import { FOODS, type FoodItem } from '../data/foods';
import { useI18n, type StringKey } from '../i18n';
import { localDate, uid } from '../lib/dates';
import { mealTypeForTime } from '../lib/nextMeal';
import { scaleNutrients } from '../lib/nutrition';
import type { MealType } from '../lib/types';
import { awardEarnedHabits, useToast } from '../state/actions';
import { useApp } from '../state/app';

const norm = (s: string) => s.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').trim();

export default function AddFood() {
  const { t, n, lang } = useI18n();
  const { viewingMember, bump, theme: th } = useApp();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<FoodItem | null>(null);
  const [grams, setGrams] = useState('100');
  const [meal, setMeal] = useState<MealType>(mealTypeForTime(new Date()));
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const results = useMemo(() => {
    const k = norm(q);
    const all = Object.values(FOODS);
    return k ? all.filter((f) => norm(f.ar).includes(k) || norm(f.en).includes(k)) : all.slice(0, 12);
  }, [q]);

  const g = parseFloat(grams) || 0;
  const nut = picked ? scaleNutrients(picked.per100, g) : null;

  const add = async () => {
    if (!picked || !nut || !viewingMember || g <= 0) return;
    setBusy(true);
    try {
      await backend.addFoodLog({
        memberId: viewingMember.id, logDate: localDate(), mealType: meal, title: `${picked[lang]} · ${n(g)} ${t('common.g')}`, source: 'manual',
        dedupeKey: `manual:${uid()}`, items: [{ name: picked[lang], grams: g, foodItemId: picked.id, nutrients: nut }],
      });
      const pts = await awardEarnedHabits(viewingMember.id, localDate());
      bump();
      toast.show(pts ? t('home.pointsEarned', { n: pts }) : t('nm.added'));
      setPicked(null);
      setQ('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen header={<Row gap={12} style={{ paddingHorizontal: 20, paddingTop: 8 }}><IconButton icon="chevron-back" flipRtl label={t('common.back')} onPress={() => router.back()} /><Txt v="h2">{t('add.title')}</Txt></Row>}>
        <Field label={t('add.search')} value={q} onChangeText={setQ} placeholder={t('add.search')} />
        {picked && nut ? (
          <Card>
            <View style={{ gap: 14 }}>
              <Row justify="space-between">
                <Txt v="h3" style={{ flex: 1 }}>{picked[lang]}</Txt>
                <Txt v="number">{n(nut.kcal)} <Txt v="caption" muted>{t('common.kcal')}</Txt></Txt>
              </Row>
              <MacroTriplet protein={nut.protein} carbs={nut.carbs} fat={nut.fat} />
              <Row gap={8} wrap>{[50, 100, 150, 200].map((v) => <Chip key={v} label={`${v} ${t('common.g')}`} selected={g === v} onPress={() => setGrams(String(v))} />)}</Row>
              <Field label={t('add.grams')} value={grams} onChangeText={(v) => setGrams(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
              <Txt v="label" muted>{t('add.mealType')}</Txt>
              <Row gap={8} wrap>{(['breakfast', 'lunch', 'dinner', 'snack', 'suhoor', 'iftar'] as MealType[]).map((m) => <Chip key={m} label={t(`meal.${m}` as StringKey)} selected={meal === m} onPress={() => setMeal(m)} />)}</Row>
              <Button title={t('add.toDay')} icon="add-circle-outline" loading={busy} disabled={g <= 0 || g > 3000} onPress={add} />
              <Txt v="caption" faint>{t('add.source')}</Txt>
            </View>
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            {results.map((f) => (
              <Card key={f.id} padding={14} onPress={() => { setPicked(f); setGrams('100'); }}>
                <Row justify="space-between">
                  <Txt v="bodyStrong" style={{ flex: 1 }}>{f[lang]}</Txt>
                  <Txt v="caption" muted>{n(f.per100.kcal)} {t('common.kcal')} / 100 {t('common.g')}</Txt>
                </Row>
              </Card>
            ))}
            {results.length === 0 && <Banner text={t('add.noResults')} />}
            <Button kind="secondary" icon="barcode-outline" title={t('nut.scan')} onPress={() => router.push('/scan')} />
          </View>
        )}
      </Screen>
      <Toast text={toast.msg ?? ''} visible={!!toast.msg} />
    </View>
  );
}

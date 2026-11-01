import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { backend } from '../backend';
import { Banner, Button, Card, Field, IconButton, Row, Screen, Txt } from '../components/ui';
import { useI18n } from '../i18n';
import { computeGoals } from '../lib/nutrition';
import type { DailyGoals } from '../lib/types';
import { useApp } from '../state/app';

type Key = 'kcal' | 'protein' | 'carbs' | 'fat' | 'waterMl' | 'steps';

export default function GoalsScreen() {
  const { memberId: param } = useLocalSearchParams<{ memberId?: string }>();
  const { t } = useI18n();
  const { viewingMember, bump } = useApp();
  const memberId = param ?? viewingMember?.id ?? '';
  const [goals, setGoals] = useState<DailyGoals | null>(null);
  const [form, setForm] = useState<Record<Key, string>>({ kcal: '', protein: '', carbs: '', fat: '', waterMl: '', steps: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    backend.getGoals(memberId).then((g) => {
      if (!g) return;
      setGoals(g);
      setForm({ kcal: String(g.kcal), protein: String(g.protein), carbs: String(g.carbs), fat: String(g.fat), waterMl: String(g.waterMl), steps: String(g.steps) });
    });
  }, [memberId]);

  const num = (k: Key) => parseInt(form[k], 10);
  const valid = num('kcal') >= 600 && num('kcal') <= 6000 && num('protein') > 0 && num('carbs') >= 0 && num('fat') > 0 && num('waterMl') >= 300 && num('waterMl') <= 6000 && num('steps') >= 0;
  const macroKcal = num('protein') * 4 + num('carbs') * 4 + num('fat') * 9;
  const mismatch = valid && Math.abs(macroKcal - num('kcal')) > num('kcal') * 0.1;

  const save = async () => {
    if (!goals) return;
    setBusy(true);
    await backend.saveGoals(memberId, { ...goals, kcal: num('kcal'), protein: num('protein'), carbs: num('carbs'), fat: num('fat'), waterMl: num('waterMl'), steps: num('steps'), isCustom: true, method: 'custom' });
    bump();
    setBusy(false);
    router.back();
  };
  const reset = async () => {
    const p = await backend.getHealthProfile(memberId);
    if (!p) return;
    await backend.saveGoals(memberId, computeGoals(p));
    bump();
    router.back();
  };

  const f = (k: Key, label: string) => (
    <View style={{ flex: 1, minWidth: 140 }}>
      <Field label={label} value={form[k]} keyboardType="number-pad" onChangeText={(v) => setForm({ ...form, [k]: v.replace(/[^0-9]/g, '') })} />
    </View>
  );

  return (
    <Screen header={<Row style={{ paddingHorizontal: 20, paddingTop: 8 }}><IconButton icon="chevron-back" flipRtl label={t('common.back')} onPress={() => router.back()} /></Row>}>
      <Txt v="h1">{t('goals.customize')}</Txt>
      <Card>
        <View style={{ gap: 12 }}>
          <Row wrap gap={10} align="flex-start">{f('kcal', `${t('macro.kcal')} (${t('common.kcal')})`)}{f('protein', `${t('macro.protein')} (${t('common.g')})`)}</Row>
          <Row wrap gap={10} align="flex-start">{f('carbs', `${t('macro.carbs')} (${t('common.g')})`)}{f('fat', `${t('macro.fat')} (${t('common.g')})`)}</Row>
          <Row wrap gap={10} align="flex-start">{f('waterMl', `${t('goals.water')} (${t('common.ml')})`)}{f('steps', t('goals.steps'))}</Row>
        </View>
      </Card>
      {mismatch && <Banner tone="warning" text={`${t('macro.protein')}×4 + ${t('macro.carbs')}×4 + ${t('macro.fat')}×9 = ${macroKcal} ≠ ${num('kcal')}`} />}
      <Banner text={t('water.goalNote')} />
      <Button title={t('common.save')} disabled={!valid} loading={busy} onPress={save} />
      <Button kind="ghost" title={t('goals.reset')} onPress={reset} />
    </Screen>
  );
}

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { backend } from '../../backend';
import { GoalsSummary } from '../../components/GoalsSummary';
import { Banner, Button, Card, Chip, Field, IconButton, Row, Screen, Segmented, Txt } from '../../components/ui';
import { FOODS } from '../../data/foods';
import { useI18n, type StringKey } from '../../i18n';
import { ageOn, computeGoals } from '../../lib/nutrition';
import type { ActivityLevel, DailyGoals, HealthGoal, HealthProfile, Sex } from '../../lib/types';
import { useApp } from '../../state/app';

const LEVELS: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const GOALS: HealthGoal[] = ['healthy_lifestyle', 'healthy_habits', 'fitness', 'more_activity', 'hydration_sleep', 'weight_loss', 'weight_gain'];
const ALLERGENS = ['milk', 'eggs', 'fish', 'shellfish', 'tree_nuts', 'peanuts', 'gluten', 'soy', 'sesame'];
const DISLIKE_OPTIONS = ['broccoli', 'mushrooms', 'spinach', 'salmon', 'tuna', 'shrimp', 'lean_beef', 'chickpeas', 'lentils', 'avocado', 'cottage', 'feta', 'quinoa', 'bulgur'];

export default function ProfileScreen() {
  const { memberId: paramId, edit } = useLocalSearchParams<{ memberId?: string; edit?: string }>();
  const { t, lang } = useI18n();
  const { membership, members, bump, theme } = useApp();
  const memberId = paramId ?? membership?.member.id ?? '';
  const member = members.find((m) => m.id === memberId) ?? membership?.member;
  const isChildRole = member?.role === 'child' || member?.role === 'teen';

  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [sex, setSex] = useState<Sex>('female');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [level, setLevel] = useState<ActivityLevel>('light');
  const [goal, setGoal] = useState<HealthGoal>('healthy_lifestyle');
  const [diet, setDiet] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [conditions, setConditions] = useState('');
  const [busy, setBusy] = useState(false);
  const [computed, setComputed] = useState<DailyGoals | null>(null);

  useEffect(() => {
    if (!memberId) return;
    backend.getHealthProfile(memberId).then((p) => {
      if (!p) return;
      setYear(p.birthDate.slice(0, 4));
      setMonth(String(+p.birthDate.slice(5, 7)));
      setSex(p.sex);
      setHeight(String(p.heightCm));
      setWeight(p.weightKg ? String(p.weightKg) : '');
      setLevel(p.activityLevel);
      setGoal(p.goal);
      setDiet(p.dietaryPreferences);
      setAllergies(p.allergies);
      setDisliked(p.dislikedFoods);
      setConditions(p.declaredConditions ?? '');
    }).catch(() => undefined);
  }, [memberId]);

  const nowYear = new Date().getFullYear();
  const y = parseInt(year, 10);
  const mo = parseInt(month || '1', 10);
  const h = parseFloat(height);
  const w = weight ? parseFloat(weight) : null;
  const valid = y >= nowYear - 110 && y <= nowYear - 2 && mo >= 1 && mo <= 12 && h >= 50 && h <= 250 && (w === null || (w >= 8 && w <= 350));
  const birthDate = valid ? `${y}-${String(mo).padStart(2, '0')}-01` : '';
  const isMinor = valid ? ageOn(birthDate) < 18 : isChildRole;

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const profile: HealthProfile | null = useMemo(() => valid ? {
    memberId, birthDate, sex, heightCm: h, weightKg: w, activityLevel: level,
    goal: isMinor && (goal === 'weight_loss' || goal === 'weight_gain') ? 'healthy_habits' : goal,
    dietaryPreferences: diet, allergies, dislikedFoods: disliked, declaredConditions: conditions.trim() || null,
  } : null, [valid, memberId, birthDate, sex, h, w, level, goal, isMinor, diet, allergies, disliked, conditions]);

  const save = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      await backend.saveHealthProfile(profile);
      const existing = await backend.getGoals(memberId);
      const g = computeGoals(profile);
      // Keep user-customised goals; otherwise store the freshly computed ones.
      if (!existing?.isCustom) await backend.saveGoals(memberId, g);
      setComputed(existing?.isCustom ? existing : g);
      bump();
    } finally {
      setBusy(false);
    }
  };

  const finish = () => (edit || paramId ? router.back() : router.replace('/(tabs)'));

  if (computed) {
    return (
      <Screen>
        <Txt v="h1" style={{ marginTop: 12 }}>{t('goals.title')}</Txt>
        <GoalsSummary goals={computed} />
        <Button title={t('common.continue')} onPress={finish} />
        <Button kind="secondary" title={t('goals.customize')} onPress={() => router.push({ pathname: '/goals', params: { memberId } })} />
      </Screen>
    );
  }

  const allowedGoals = GOALS.filter((g) => !(isMinor && (g === 'weight_loss' || g === 'weight_gain')));

  return (
    <Screen header={(edit || paramId) ? <Row style={{ paddingHorizontal: 20, paddingTop: 8 }}><IconButton icon="chevron-back" flipRtl label={t('common.back')} onPress={() => router.back()} /></Row> : undefined}>
      <View style={{ gap: 6, marginTop: 8 }}>
        <Txt v="h1">{t('profile.title')}{member && paramId ? ` · ${member.displayName}` : ''}</Txt>
        <Txt muted>{t('profile.subtitle')}</Txt>
      </View>
      <Card>
        <View style={{ gap: 14 }}>
          <Row gap={10} align="flex-start">
            <View style={{ flex: 1.3 }}><Field label={t('profile.birthYear')} value={year} onChangeText={setYear} keyboardType="number-pad" placeholder="1990" maxLength={4} /></View>
            <View style={{ flex: 1 }}><Field label={lang === 'ar' ? 'الشهر' : 'Month'} value={month} onChangeText={setMonth} keyboardType="number-pad" placeholder="1–12" maxLength={2} /></View>
          </Row>
          <View style={{ gap: 6 }}>
            <Txt v="label" muted>{t('profile.sex')}</Txt>
            <Segmented value={sex} onChange={setSex} options={[{ value: 'female', label: t('profile.female') }, { value: 'male', label: t('profile.male') }]} />
          </View>
          <Row gap={10} align="flex-start">
            <View style={{ flex: 1 }}><Field label={t('profile.height')} value={height} onChangeText={setHeight} keyboardType="decimal-pad" placeholder="165" /></View>
            <View style={{ flex: 1 }}><Field label={t('profile.weight')} hint={t('profile.weightHint')} value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="—" /></View>
          </Row>
        </View>
      </Card>

      <Card>
        <View style={{ gap: 10 }}>
          <Txt v="h3">{t('profile.activity')}</Txt>
          <Row wrap gap={8}>{LEVELS.map((l) => <Chip key={l} label={t(`act.${l}` as StringKey)} selected={level === l} onPress={() => setLevel(l)} />)}</Row>
          <Txt v="h3" style={{ marginTop: 6 }}>{t('profile.goal')}</Txt>
          <Row wrap gap={8}>{allowedGoals.map((g) => <Chip key={g} label={t(`goal.${g}` as StringKey)} selected={goal === g} onPress={() => setGoal(g)} />)}</Row>
          {isMinor && <Banner text={t('profile.childNote')} />}
        </View>
      </Card>

      <Card>
        <View style={{ gap: 10 }}>
          <Txt v="h3">{t('profile.diet')}</Txt>
          <Row wrap gap={8}>{['vegetarian', 'pescatarian'].map((d) => <Chip key={d} label={t(`diet.${d}` as StringKey)} selected={diet.includes(d)} onPress={() => toggle(diet, setDiet, d)} />)}</Row>
          <Txt v="h3" style={{ marginTop: 6 }}>{t('profile.allergies')}</Txt>
          <Row wrap gap={8}>{ALLERGENS.map((a) => <Chip key={a} color={theme.danger} label={t(`allergen.${a}` as StringKey)} selected={allergies.includes(a)} onPress={() => toggle(allergies, setAllergies, a)} />)}</Row>
          <Txt v="h3" style={{ marginTop: 6 }}>{t('profile.disliked')}</Txt>
          <Row wrap gap={8}>{DISLIKE_OPTIONS.map((f) => <Chip key={f} color={theme.textMuted} label={FOODS[f][lang]} selected={disliked.includes(f)} onPress={() => toggle(disliked, setDisliked, f)} />)}</Row>
        </View>
      </Card>

      <Card>
        <Field label={`${t('profile.conditions')} (${t('common.optional')})`} hint={t('profile.conditionsHint')} value={conditions} onChangeText={setConditions} multiline />
      </Card>

      <Button title={t('profile.calc')} icon="sparkles" disabled={!valid} loading={busy} onPress={save} />
    </Screen>
  );
}

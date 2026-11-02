import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { backend } from '../../../backend';
import { CheckRow, TopBar } from '../../../components/recipe';
import { Banner, Button, Card, Icon, Row, Screen, Skeleton, Txt } from '../../../components/ui';
import { FOODS } from '../../../data/foods';
import { useI18n, type StringKey } from '../../../i18n';
import { isBuiltinRef } from '../../../lib/recipe';
import { applySubstitutions, diff, suggestSubstitutions, type SubSuggestion } from '../../../lib/substitutions';
import type { Nutrients } from '../../../lib/types';
import { useApp } from '../../../state/app';
import { editableCopy, useRecipe } from '../../../state/recipes';
import { useDay } from '../../../state/useDay';
import { radius } from '../../../theme';

const KEYS: [keyof Nutrients, StringKey][] = [['kcal', 'macro.kcal'], ['protein', 'macro.protein'], ['carbs', 'macro.carbs'], ['fat', 'macro.fat'], ['fiber', 'macro.fiber'], ['satFat', 'macro.satFat']];

export default function Substitutions() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, n, lang } = useI18n();
  const { viewingMember, membership, bump, theme: th } = useApp();
  const { loading, recipe: r } = useRecipe(id);
  const day = useDay(viewingMember?.id);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const subs = useMemo(() => (r ? suggestSubstitutions(r, lang, day.profile?.allergies ?? []) : []), [r, lang, day.profile]);

  if (loading) return <Screen header={<TopBar title={t('sub.title')} />}><Skeleton height={200} r={24} /></Screen>;
  if (!r || !viewingMember || !membership) return <Screen header={<TopBar title={t('sub.title')} />}><Banner tone="warning" text={t('rd.notFound')} /></Screen>;

  const lineOf = (k: string) => subs.find((s) => s.key === k)?.lineIndex;
  const toggle = (s: SubSuggestion) => {
    if (chosen.includes(s.key)) return setChosen(chosen.filter((k) => k !== s.key));
    // one swap per ingredient line / one method change
    setChosen([...chosen.filter((k) => (s.kind === 'method' ? !k.startsWith('method:') : lineOf(k) !== s.lineIndex)), s.key]);
  };

  const apply = async () => {
    setBusy(true);
    try {
      // Built-in recipes are first copied into the member's library so the improved version can point to an original.
      let original = r;
      if (isBuiltinRef(r.id)) original = await backend.saveRecipe(editableCopy(r, viewingMember.id, membership.family.id));
      const improved = applySubstitutions({ ...original, ownerMemberId: viewingMember.id, familyId: membership.family.id }, chosen, lang, '', new Date().toISOString());
      const saved = await backend.saveRecipe(improved);
      bump();
      router.replace({ pathname: '/recipes/[id]/compare', params: { id: saved.id } });
    } finally {
      setBusy(false);
    }
  };

  const name = (s: SubSuggestion, side: 'from' | 'to') => {
    if (s.kind === 'method') return t(`rev.method.${side === 'from' ? s.fromMethod : s.toMethod}` as StringKey);
    const f = side === 'from' ? s.fromFood : s.toFood;
    if (side === 'to' && s.toFood === s.fromFood) return t('sub.useLess');
    return f ? FOODS[f][lang] : '';
  };

  return (
    <Screen header={<TopBar title={t('sub.title')} subtitle={r.title} />}>
      <Banner text={t('sub.subtitle')} icon="information-circle-outline" />
      {subs.length === 0 ? <Card tone="alt"><Txt muted center>{t('sub.none')}</Txt></Card> : (
        <>
          <Txt v="caption" muted>{t('sub.selectHint')}</Txt>
          {subs.map((s) => {
            const d = diff(s.before, s.after);
            return (
              <Card key={s.key}>
                <View style={{ gap: 10 }}>
                  <CheckRow
                    checked={chosen.includes(s.key)} onPress={() => toggle(s)}
                    label={`${name(s, 'from')}  →  ${name(s, 'to')}`}
                    sub={s.kind === 'method' ? t('sub.method') : `${t('sub.original')}: ${s.lineIndex != null ? r.ingredients[s.lineIndex].name : ''}`}
                  />
                  <Row gap={8} align="flex-start"><Icon name="bulb-outline" size={16} color={th.primary} /><Txt v="caption" style={{ flex: 1 }}><Txt v="caption" color={th.primary}>{t('sub.reason')}: </Txt>{s.reason[lang]}</Txt></Row>
                  <Row gap={8} align="flex-start"><Icon name="restaurant-outline" size={16} color={th.coral} /><Txt v="caption" style={{ flex: 1 }}><Txt v="caption" color={th.coral}>{t('sub.taste')}: </Txt>{s.taste[lang]}</Txt></Row>
                  <View style={{ borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: th.border }}>
                    <Row style={{ backgroundColor: th.surfaceAlt, paddingHorizontal: 10, paddingVertical: 6 }}>
                      <Txt v="caption" muted style={{ flex: 1.4 }}> </Txt>
                      <Txt v="caption" muted style={{ flex: 1 }} center>{t('sub.before')}</Txt>
                      <Txt v="caption" muted style={{ flex: 1 }} center>{t('sub.after')}</Txt>
                      <Txt v="caption" muted style={{ flex: 1 }} center>±</Txt>
                    </Row>
                    {KEYS.map(([k, label]) => (
                      <Row key={k} style={{ paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Txt v="caption" style={{ flex: 1.4 }}>{t(label)}</Txt>
                        <Txt v="caption" style={{ flex: 1 }} center>{n(s.before[k], k === 'kcal' ? 0 : 1)}</Txt>
                        <Txt v="caption" style={{ flex: 1 }} center>{n(s.after[k], k === 'kcal' ? 0 : 1)}</Txt>
                        <Txt v="caption" muted style={{ flex: 1, writingDirection: 'ltr' }} center>{d[k] > 0 ? '+' : ''}{n(d[k], k === 'kcal' ? 0 : 1)}</Txt>
                      </Row>
                    ))}
                  </View>
                </View>
              </Card>
            );
          })}
          <Txt v="caption" faint>{t('sub.perServingNote')}</Txt>
          <Button icon="color-wand-outline" title={chosen.length > 1 ? t('sub.applyN', { n: chosen.length }) : t('sub.apply')} disabled={!chosen.length} loading={busy} onPress={apply} />
        </>
      )}
    </Screen>
  );
}

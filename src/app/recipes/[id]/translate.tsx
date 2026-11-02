import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { backend } from '../../../backend';
import { TopBar } from '../../../components/recipe';
import { Banner, Button, Card, Chip, Field, Icon, Row, Screen, Skeleton, Toast, Txt } from '../../../components/ui';
import { DOC_LANGS } from '../../../data/recipeI18n';
import { useI18n, type StringKey } from '../../../i18n';
import type { DocLang } from '../../../lib/recipe';
import { checkNumbers, formatQty, isRtl } from '../../../lib/recipeDoc';
import { useToast } from '../../../state/actions';
import { useApp } from '../../../state/app';
import { useRecipe, useTranslation } from '../../../state/recipes';
import { brand, fonts, radius } from '../../../theme';

export default function Translate() {
  const { id, lang: initial } = useLocalSearchParams<{ id: string; lang?: DocLang }>();
  const { t } = useI18n();
  const { viewingMember, bump, theme: th } = useApp();
  const { loading, recipe: r } = useRecipe(id);
  const [lang, setLang] = useState<DocLang>(initial ?? 'fil');
  const { tr, setTr } = useTranslation(r, lang);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  const ai = backend.aiAvailable();

  if (loading || !tr) return <Screen header={<TopBar title={t('tr.title')} />}><Skeleton height={200} r={24} /></Screen>;
  if (!r || !viewingMember) return <Screen header={<TopBar title={t('tr.title')} />}><Banner tone="warning" text={t('rd.notFound')} /></Screen>;
  const rtl = isRtl(lang);
  const inputStyle = { borderRadius: radius.md, backgroundColor: th.surface, borderWidth: 1, borderColor: th.border, padding: 12, color: th.text, fontFamily: fonts.regular, fontSize: 15, textAlign: rtl ? 'right' : 'left' } as const;
  const sourceSteps = r.steps.map((s) => s.text);
  const edit = (patch: Partial<typeof tr>) => {
    const next = { ...tr, ...patch, edited: true };
    setTr({ ...next, numberWarnings: checkNumbers(sourceSteps, next.steps) });
  };

  const useService = async () => {
    setBusy(true);
    setErr(null);
    try {
      const out = await backend.translateRecipe({ title: r.title, description: r.description, ingredientNames: r.ingredients.map((i) => i.name), steps: sourceSteps, notes: r.notes, servingTip: r.servingTip }, lang);
      setTr({ ...tr, ...out, pending: [], machine: true, edited: false, numberWarnings: checkNumbers(sourceSteps, out.steps) });
    } catch {
      setErr(t('imp.unreachable'));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    await backend.saveTranslation(viewingMember.id, r.id, tr);
    bump();
    toast.show(t('tr.saved'));
  };

  const pendingNames = tr.pending.map((p) => t(`tr.field.${p}` as StringKey)).join('، ');

  return (
    <View style={{ flex: 1 }}>
      <Screen header={<TopBar title={t('tr.title')} subtitle={r.title} />}>
        <Card tone={lang === 'fil' ? 'deep' : 'surface'} onPress={() => setLang('fil')}>
          <Row gap={12}>
            <Icon name="language" size={24} color={lang === 'fil' ? brand.gold : th.primary} />
            <View style={{ flex: 1 }}>
              <Txt v="h3" color={lang === 'fil' ? '#fff' : undefined}>{t('tr.filipinoCta')}</Txt>
              <Txt v="caption" color={lang === 'fil' ? 'rgba(255,255,255,0.75)' : th.textMuted}>{t('tr.filipinoBody')}</Txt>
            </View>
            {lang === 'fil' && <Icon name="checkmark-circle" size={22} color={brand.gold} />}
          </Row>
        </Card>
        <Txt v="label" muted>{t('tr.other')}</Txt>
        <Row gap={6} wrap>{DOC_LANGS.filter((l) => l.code !== 'fil').map((l) => <Chip key={l.code} label={l.native} selected={lang === l.code} onPress={() => setLang(l.code)} />)}</Row>

        {tr.pending.length > 0 && <Banner tone="warning" text={t('tr.pending', { list: pendingNames })} />}
        {tr.pending.length > 0 && (ai ? <Button kind="secondary" icon="sparkles" title={t('tr.useService')} loading={busy} onPress={useService} /> : <Banner icon="cloud-offline-outline" text={t('tr.serviceOff')} />)}
        {tr.machine && <Banner tone="ai" text={t('tr.machine')} />}
        {err && <Banner tone="warning" text={err} />}

        <Txt v="h2">{t('tr.preview')}</Txt>
        <Field label={t('tr.field.title')} value={tr.title} onChangeText={(v) => edit({ title: v })} style={{ textAlign: rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' }} />
        <Card>
          <View style={{ gap: 10 }}>
            <Row gap={6}><Icon name="lock-closed-outline" size={14} color={th.textMuted} /><Txt v="caption" muted>{t('tr.fixedQty')}</Txt></Row>
            {r.ingredients.map((l, i) => (
              <Row key={i} gap={8}>
                <View style={{ width: 96, flexShrink: 0, backgroundColor: th.surfaceAlt, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 6 }}><Txt v="caption" color={th.primary} center style={{ writingDirection: rtl ? 'rtl' : 'ltr' }}>{formatQty(l, lang, false)}</Txt></View>
                <TextInput value={tr.ingredientNames[i] ?? ''} onChangeText={(v) => edit({ ingredientNames: tr.ingredientNames.map((x, j) => (j === i ? v : x)) })} style={[inputStyle, { flex: 1, minWidth: 0, padding: 8 }]} />
              </Row>
            ))}
          </View>
        </Card>
        {tr.steps.map((s, i) => (
          <View key={i} style={{ gap: 4 }}>
            <Txt v="caption" muted>{i + 1}. {sourceSteps[i]}</Txt>
            <TextInput multiline value={s} onChangeText={(v) => edit({ steps: tr.steps.map((x, j) => (j === i ? v : x)) })} style={[inputStyle, { minHeight: 56, borderColor: tr.numberWarnings.includes(i) ? th.coral : th.border }]} />
            {tr.numberWarnings.includes(i) && <Txt v="caption" color={th.coral}>{t('tr.numberWarn', { n: i + 1 })}</Txt>}
          </View>
        ))}
        {(r.notes || tr.notes) ? <Field label={t('tr.field.notes')} value={tr.notes} onChangeText={(v) => edit({ notes: v })} multiline /> : null}

        <Button icon="save-outline" title={t('tr.save')} onPress={save} />
        <Button kind="secondary" icon="document-text-outline" title={t('tr.export')} onPress={async () => { await save(); router.push({ pathname: '/recipes/[id]/document', params: { id: r.id, lang } }); }} />
      </Screen>
      <Toast text={toast.msg ?? ''} visible={!!toast.msg} />
    </View>
  );
}

import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { Linking, Platform, Switch, Text, View } from 'react-native';
import { backend } from '../../../backend';
import { TopBar } from '../../../components/recipe';
import { Banner, Button, Card, Chip, Icon, Row, Screen, Skeleton, Toast, Txt, type IconName } from '../../../components/ui';
import { DOC_LANGS } from '../../../data/recipeI18n';
import { FOODS } from '../../../data/foods';
import { useI18n } from '../../../i18n';
import { computeRecipeNutrition, type DocLang } from '../../../lib/recipe';
import { buildDocModel, docHtml, docText, type DocOptions } from '../../../lib/recipeDoc';
import { suggestSubstitutions } from '../../../lib/substitutions';
import { useToast } from '../../../state/actions';
import { useApp } from '../../../state/app';
import { useRecipe, useTranslation } from '../../../state/recipes';
import { brand, radius } from '../../../theme';

export default function RecipeDocument() {
  const { id, lang: initial } = useLocalSearchParams<{ id: string; lang?: DocLang }>();
  const { t, lang: uiLang, rtl: uiRtl } = useI18n();
  const { viewingMember, bump, theme: th } = useApp();
  const { loading, recipe: r, fav } = useRecipe(id);
  const [opts, setOpts] = useState<DocOptions>({ lang: initial ?? uiLang, checkable: true, showGrams: true, includeNutrition: true });
  const { tr, saved } = useTranslation(r, opts.lang);
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const model = useMemo(() => {
    if (!r || !tr) return null;
    const alts = opts.lang === 'ar' || opts.lang === 'en'
      ? suggestSubstitutions(r, opts.lang, []).filter((s) => s.kind === 'ingredient' && s.toFood !== s.fromFood).slice(0, 4).map((s) => `${FOODS[s.fromFood!][opts.lang as 'ar' | 'en']} → ${FOODS[s.toFood!][opts.lang as 'ar' | 'en']}: ${s.reason[opts.lang as 'ar' | 'en']}`)
      : [];
    return buildDocModel(r, computeRecipeNutrition(r), tr, opts, alts);
  }, [r, tr, opts]);

  if (loading || !tr) return <Screen header={<TopBar title={t('doc.title')} />}><Skeleton height={300} r={24} /></Screen>;
  if (!r || !model || !viewingMember) return <Screen header={<TopBar title={t('doc.title')} />}><Banner tone="warning" text={t('rd.notFound')} /></Screen>;

  const log = (via: string) => backend.logRecipeDocument(viewingMember.id, r.id, opts.lang, { ...opts, via }).catch(() => undefined);
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      await log(key);
    } catch {
      toast.show(t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  const pdf = () => run('pdf', async () => {
    const html = docHtml(model);
    if (Platform.OS === 'web') return Print.printAsync({ html });
    const { uri } = await Print.printToFileAsync({ html });
    const named = await namedPdf(uri, model.title);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(named, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: model.title });
    else toast.show(t('doc.shareUnavailable'));
  });
  const print = () => run('print', async () => { await Print.printAsync({ html: docHtml(model) }); });
  const whatsapp = () => run('whatsapp', async () => {
    const text = encodeURIComponent(docText(model));
    const app = `whatsapp://send?text=${text}`;
    if (Platform.OS !== 'web' && (await Linking.canOpenURL(app))) return Linking.openURL(app);
    try {
      await Linking.openURL(`https://wa.me/?text=${text}`);
    } catch {
      toast.show(t('doc.whatsappMissing'));
    }
  });
  const email = () => run('email', async () => { await Linking.openURL(`mailto:?subject=${encodeURIComponent(model.title)}&body=${encodeURIComponent(docText(model))}`); });
  const library = () => run('library', async () => {
    if (opts.lang !== r.lang && !saved) await backend.saveTranslation(viewingMember.id, r.id, tr);
    await backend.saveFavoriteRecipe(viewingMember.id, { ref: r.id, folders: fav?.folders ?? [], note: fav?.note ?? '' });
    bump();
    toast.show(t('doc.savedLibrary'));
  });

  const Toggle = ({ k, label }: { k: 'checkable' | 'showGrams' | 'includeNutrition'; label: string }) => (
    <Row justify="space-between"><Txt style={{ flex: 1 }}>{label}</Txt><Switch value={opts[k]} onValueChange={(v) => setOpts({ ...opts, [k]: v })} trackColor={{ true: th.primary }} /></Row>
  );
  const Export = ({ k, icon, label, onPress, color }: { k: string; icon: IconName; label: string; onPress: () => void; color?: string }) => (
    <View style={{ width: '31%', flexGrow: 1 }}>
      <Button small kind="secondary" icon={icon} title={label} loading={busy === k} onPress={onPress} />
      {color ? <View style={{ height: 2, backgroundColor: color, marginTop: 2, borderRadius: 1 }} /> : null}
    </View>
  );
  const dir = model.rtl ? 'right' : 'left';
  // Flex rows follow the app's direction; flip them when the document's direction differs.
  const rowDir = model.rtl === uiRtl ? 'row' : 'row-reverse';

  return (
    <View style={{ flex: 1 }}>
      <Screen header={<TopBar title={t('doc.title')} subtitle={r.title} />}>
        <Card>
          <View style={{ gap: 12 }}>
            <Txt v="label" muted>{t('doc.language')}</Txt>
            <Row gap={6} wrap>{DOC_LANGS.map((l) => <Chip key={l.code} label={l.native} selected={opts.lang === l.code} onPress={() => setOpts({ ...opts, lang: l.code })} />)}</Row>
            <Toggle k="checkable" label={t('doc.checkable')} />
            <Toggle k="showGrams" label={t('doc.showGrams')} />
            <Toggle k="includeNutrition" label={t('doc.includeNutrition')} />
          </View>
        </Card>
        {tr.pending.length > 0 && (
          <Card tone="alt">
            <View style={{ gap: 8 }}>
              <Txt v="caption">{t('doc.pendingTr')}</Txt>
              <Button small kind="secondary" icon="language" title={t('tr.title')} onPress={() => router.push({ pathname: '/recipes/[id]/translate', params: { id: r.id, lang: opts.lang } })} />
            </View>
          </Card>
        )}
        {tr.numberWarnings.length > 0 && <Banner tone="warning" text={t('doc.numberWarn')} />}

        <Button icon="document-outline" title={t('doc.exportPdf')} loading={busy === 'pdf'} onPress={pdf} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Export k="whatsapp" icon="logo-whatsapp" label={t('doc.whatsapp')} onPress={whatsapp} />
          <Export k="email" icon="mail-outline" label={t('doc.email')} onPress={email} />
          <Export k="print" icon="print-outline" label={t('doc.print')} onPress={print} />
          {Platform.OS !== 'web' && <Export k="phone" icon="download-outline" label={t('doc.savePhone')} onPress={pdf} />}
          <Export k="library" icon="bookmark-outline" label={t('doc.saveLibrary')} onPress={library} />
        </View>

        <Txt v="h2">{t('doc.preview')}</Txt>
        <View style={{ backgroundColor: '#fff', borderRadius: radius.lg, padding: 14, gap: 12, borderWidth: 1, borderColor: th.border }}>
          <View style={{ backgroundColor: brand.forest, borderRadius: 16, padding: 14, flexDirection: rowDir, gap: 12, alignItems: 'center' }}>
            <Text style={{ fontSize: 30 }}>{model.emoji}</Text>
            <Text style={{ flex: 1, color: '#fff', fontSize: 20, fontWeight: '700', textAlign: dir }}>{model.title}</Text>
          </View>
          <View style={{ flexDirection: rowDir, flexWrap: 'wrap', gap: 6 }}>
            {model.meta.map((m) => <Text key={m.label} style={{ backgroundColor: brand.mint, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, fontSize: 12, color: brand.charcoal }}>{m.label}: {m.value}</Text>)}
          </View>
          <Text style={{ color: brand.forest, fontSize: 16, fontWeight: '700', textAlign: dir, borderBottomWidth: 2, borderColor: brand.gold, paddingBottom: 4 }}>{model.labels.ingredients}</Text>
          {model.ingredients.map((i, k) => (
            <View key={k} style={{ flexDirection: rowDir, gap: 8, alignItems: 'center' }}>
              {model.checkable && <View style={{ width: 14, height: 14, borderWidth: 2, borderColor: brand.green, borderRadius: 3 }} />}
              <Text style={{ flex: 1, color: brand.charcoal, textAlign: dir }}><Text style={{ color: brand.green, fontWeight: '700' }}>{i.qty}</Text> — {i.name}</Text>
            </View>
          ))}
          <Text style={{ color: brand.forest, fontSize: 16, fontWeight: '700', textAlign: dir, borderBottomWidth: 2, borderColor: brand.gold, paddingBottom: 4 }}>{model.labels.steps}</Text>
          {model.steps.map((s, k) => (
            <View key={k} style={{ flexDirection: rowDir, gap: 8, alignItems: 'flex-start' }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: brand.green, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{k + 1}</Text></View>
              <Text style={{ flex: 1, color: brand.charcoal, textAlign: dir }}>{s.text}{s.extra ? `  (${s.extra})` : ''}</Text>
            </View>
          ))}
          {model.alternatives.length > 0 && (
            <>
              <Text style={{ color: brand.forest, fontSize: 16, fontWeight: '700', textAlign: dir }}>{model.labels.alternatives}</Text>
              {model.alternatives.map((a, k) => <Text key={k} style={{ color: brand.charcoal, textAlign: dir, fontSize: 13 }}>• {a}</Text>)}
            </>
          )}
          {model.nutrition && (
            <>
              <Text style={{ color: brand.forest, fontSize: 16, fontWeight: '700', textAlign: dir, borderBottomWidth: 2, borderColor: brand.gold, paddingBottom: 4 }}>{model.labels.nutrition} · {model.labels.perServing}</Text>
              {model.nutrition.rows.map((row) => (
                <View key={row.label} style={{ flexDirection: rowDir, justifyContent: 'space-between' }}>
                  <Text style={{ color: brand.charcoal }}>{row.label}</Text>
                  <Text style={{ color: brand.charcoal, fontWeight: '700' }}>{row.perServing}</Text>
                </View>
              ))}
              <Text style={{ color: '#6B746F', fontSize: 11, textAlign: dir }}>{model.nutrition.confidence} · {model.labels.sourceNote}</Text>
            </>
          )}
        </View>
        <Row gap={6}><Icon name="shield-checkmark-outline" size={14} color={th.textMuted} /><Txt v="caption" muted style={{ flex: 1 }}>{t('rd.source')}</Txt></Row>
      </Screen>
      <Toast text={toast.msg ?? ''} visible={!!toast.msg} />
    </View>
  );
}

/** Give the printed PDF the recipe's name instead of a random id (falls back to the original file). */
async function namedPdf(uri: string, title: string): Promise<string> {
  try {
    const safe = title.replace(/[\\/:*?"<>|\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'FamilyFit recipe';
    const dest = new File(Paths.cache, `${safe}.pdf`);
    if (dest.exists) dest.delete();
    await new File(uri).move(dest);
    return dest.uri;
  } catch {
    return uri;
  }
}

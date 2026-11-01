import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { backend } from '../../../backend';
import { TopBar } from '../../../components/recipe';
import { Banner, Button, Card, Field, Icon, Row, Screen, Txt } from '../../../components/ui';
import { useI18n } from '../../../i18n';
import { applyAnalysis, applyParsed, captionToText, fetchPublicCaption, parseRecipeText, platformOf, PLATFORM_NAMES } from '../../../lib/importFlow';
import { useApp } from '../../../state/app';
import { setDraft } from '../../../state/recipeDraft';
import { emptyRecipe } from '../../../state/recipes';

type Stage = 'idle' | 'fetch' | 'extract' | 'match';

export default function ImportLink() {
  const { t, lang } = useI18n();
  const { viewingMember, membership, theme: th } = useApp();
  const [url, setUrl] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const ai = backend.aiAvailable();

  const go = async () => {
    setError(null);
    const platform = platformOf(url);
    if (!platform) return setError(t('imp.invalidLink'));
    if (!viewingMember || !membership) return;
    const base = emptyRecipe(viewingMember.id, membership.family.id, lang, { sourceKind: 'link', sourceUrl: url.trim(), sourcePlatform: platform });
    setStage('fetch');
    try {
      if (ai) {
        const r = await backend.analyzeRecipe({ mode: 'link', url: url.trim(), lang });
        setStage('match');
        if (r.status === 'unsupported') return setError(t('imp.unsupported', { p: PLATFORM_NAMES[platform] }));
        if (r.status === 'unreachable') return setError(r.message ? `${t('imp.unreachable')}\n${r.message}` : t('imp.unreachable'));
        if (r.status === 'no_recipe' || !r.ingredients.length) return setError(t('imp.noRecipe'));
        setDraft({ recipe: applyAnalysis(base, r), sourceText: r.sourceText, alternatives: r.alternatives, message: r.message });
        router.replace('/recipes/review');
        return;
      }
      // No server: only official public oEmbed captions can be read from the device.
      if (platform !== 'tiktok' && platform !== 'youtube') return setError(t('imp.unsupported', { p: PLATFORM_NAMES[platform] }));
      const caption = await fetchPublicCaption(url.trim(), platform);
      if (!caption) return setError(t('imp.unreachable'));
      setStage('extract');
      const parsed = parseRecipeText(captionToText(caption));
      setStage('match');
      if (!parsed.ingredients.length) return setError(t('imp.noRecipe'));
      setDraft({ recipe: applyParsed(base, parsed), sourceText: caption, alternatives: [], message: null });
      router.replace('/recipes/review');
    } catch {
      setError(t('imp.unreachable'));
    } finally {
      setStage('idle');
    }
  };

  const steps: [Stage, string][] = [['fetch', t('imp.steps.fetch')], ['extract', t('imp.steps.extract')], ['match', t('imp.steps.match')]];
  const order = ['fetch', 'extract', 'match'];

  return (
    <Screen header={<TopBar title={t('imp.link')} subtitle={t('imp.linkBody')} />}>
      <Field label={t('imp.linkLabel')} placeholder={t('imp.linkPlaceholder')} value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={{ textAlign: 'left', writingDirection: 'ltr' }} />
      <Row gap={10}>
        <View style={{ flex: 1 }}><Button kind="secondary" icon="clipboard-outline" title={t('imp.paste')} onPress={async () => setUrl((await Clipboard.getStringAsync().catch(() => '')) || url)} /></View>
        <View style={{ flex: 1 }}><Button icon="sparkles" title={t('imp.analyze')} loading={stage !== 'idle'} disabled={!url.trim()} onPress={go} /></View>
      </Row>
      {!ai && <Banner text={t('imp.linkLocal')} icon="phone-portrait-outline" />}
      {stage !== 'idle' && (
        <Card>
          <View style={{ gap: 10 }}>
            <Txt v="h3">{t('imp.analyzing')}</Txt>
            {steps.map(([k, label]) => {
              const done = order.indexOf(k) < order.indexOf(stage);
              const active = k === stage;
              return (
                <Row key={k} gap={8}>
                  <Icon name={done ? 'checkmark-circle' : active ? 'ellipse' : 'ellipse-outline'} size={18} color={done || active ? th.primary : th.textFaint} />
                  <Txt muted={!active}>{label}</Txt>
                </Row>
              );
            })}
          </View>
        </Card>
      )}
      {error && (
        <Card tone="alt">
          <View style={{ gap: 10 }}>
            <Row gap={8} align="flex-start"><Icon name="information-circle" size={20} color={th.coral} /><Txt style={{ flex: 1 }}>{error}</Txt></Row>
            {ai && <Button small kind="secondary" icon="videocam-outline" title={t('imp.video')} onPress={() => router.replace({ pathname: '/recipes/import/media', params: { kind: 'video' } })} />}
            {ai && <Button small kind="secondary" icon="phone-portrait-outline" title={t('imp.screen')} onPress={() => router.replace({ pathname: '/recipes/import/media', params: { kind: 'screen' } })} />}
            <Button small kind="secondary" icon="document-text-outline" title={t('imp.text')} onPress={() => router.replace('/recipes/import/text')} />
          </View>
        </Card>
      )}
      <Banner text={t('imp.legal')} icon="shield-checkmark-outline" />
      <Txt v="caption" faint>{t('imp.speechNote')}</Txt>
    </Screen>
  );
}

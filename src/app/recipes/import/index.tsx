import { router } from 'expo-router';
import { View } from 'react-native';
import { backend } from '../../../backend';
import { TopBar } from '../../../components/recipe';
import { Banner, Card, Icon, Pill, Row, Screen, Txt, type IconName } from '../../../components/ui';
import { useI18n, type StringKey } from '../../../i18n';
import { useApp } from '../../../state/app';
import { setDraft } from '../../../state/recipeDraft';
import { emptyRecipe } from '../../../state/recipes';

export default function ImportHub() {
  const { t, lang } = useI18n();
  const { viewingMember, membership, theme: th } = useApp();
  const ai = backend.aiAvailable();

  const Option = ({ icon, title, body, color, onPress, needsAi }: { icon: IconName; title: StringKey; body: StringKey; color: string; onPress: () => void; needsAi?: boolean }) => (
    <Card onPress={onPress}>
      <Row gap={14} align="flex-start">
        <View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: th.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={22} color={color} /></View>
        <View style={{ flex: 1, gap: 3 }}>
          <Txt v="h3">{t(title)}</Txt>
          <Txt v="caption" muted>{t(body)}</Txt>
          {needsAi && !ai ? <Pill text={t('common.needsService')} icon="cloud-offline-outline" color={th.textMuted} /> : null}
        </View>
        <Icon name="chevron-forward" size={18} color={th.textFaint} flipRtl />
      </Row>
    </Card>
  );

  const manual = () => {
    if (!viewingMember || !membership) return;
    setDraft({ recipe: emptyRecipe(viewingMember.id, membership.family.id, lang, { sourceKind: 'manual' }), sourceText: null, alternatives: [], message: null });
    router.push('/recipes/review');
  };

  return (
    <Screen header={<TopBar title={t('imp.title')} subtitle={t('imp.subtitle')} />}>
      <Option icon="link" title="imp.link" body="imp.linkBody" color={th.primary} onPress={() => router.push('/recipes/import/link')} />
      <Option icon="videocam-outline" title="imp.video" body="imp.videoBody" color={th.coral} needsAi onPress={() => router.push({ pathname: '/recipes/import/media', params: { kind: 'video' } })} />
      <Option icon="phone-portrait-outline" title="imp.screen" body="imp.screenBody" color={th.water} needsAi onPress={() => router.push({ pathname: '/recipes/import/media', params: { kind: 'screen' } })} />
      <Option icon="document-text-outline" title="imp.text" body="imp.textBody" color={th.gold} onPress={() => router.push('/recipes/import/text')} />
      <Option icon="images-outline" title="imp.photos" body="imp.photosBody" color={th.primary} needsAi onPress={() => router.push({ pathname: '/recipes/import/media', params: { kind: 'photos' } })} />
      <Option icon="create-outline" title="imp.manual" body="imp.manualBody" color={th.textMuted} onPress={manual} />
      <Banner text={t('imp.legal')} icon="shield-checkmark-outline" />
      <Banner text={t('imp.shareHint')} icon="share-outline" />
    </Screen>
  );
}

import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Icon, Pill, PressableScale, Row, Txt, type IconName } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/app';
import { useDay } from '../../state/useDay';
import { brand, radius } from '../../theme';
import { ScrollView } from 'react-native';

export default function AIHub() {
  const { t, n } = useI18n();
  const { viewingMember, theme: th } = useApp();
  const day = useDay(viewingMember?.id);

  const Feature = ({ icon, title, body, color, onPress, phase }: { icon: IconName; title: string; body: string; color: string; onPress?: () => void; phase?: number }) => (
    <Card onPress={phase ? undefined : onPress} style={phase ? { opacity: 0.62 } : undefined}>
      <Row gap={14} align="flex-start">
        <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: th.surfaceAlt }}>
          <Icon name={icon} size={23} color={color} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Row justify="space-between" align="flex-start">
            <Txt v="h3" style={{ flex: 1 }}>{title}</Txt>
            {phase ? <Pill text={t('common.phase', { n: phase })} icon="time-outline" color={th.textMuted} /> : <Icon name="chevron-forward" size={18} color={th.textFaint} flipRtl />}
          </Row>
          <Txt v="caption" muted>{body}</Txt>
          {phase ? <Txt v="caption" faint>{t('ai.notYet', { phase: t('common.phase', { n: phase }) })}</Txt> : null}
        </View>
      </Row>
    </Card>
  );

  return (
    <View style={{ flex: 1, backgroundColor: th.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={th.dark ? ['#0A2A21', '#0C1613'] : [brand.forest, '#1E5C4A']} style={{ borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl }}>
          <SafeAreaView edges={['top']} style={{ paddingHorizontal: 20, paddingBottom: 26, paddingTop: 12, gap: 16, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
            <Row gap={12}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(217,164,65,0.18)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(217,164,65,0.4)' }}>
                <Icon name="sparkles" size={26} color={brand.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="h1" color="#fff">{t('ai.title')}</Txt>
                <Txt v="caption" color="rgba(232,243,236,0.8)">{t('ai.subtitle')}</Txt>
              </View>
            </Row>
            {day.goals && (
              <Row gap={10}>
                {[
                  [t('macro.kcal'), n(day.remaining.kcal), brand.gold],
                  [t('macro.protein'), `${n(day.remaining.protein)} ${t('common.g')}`, brand.coral],
                  [t('macro.carbs'), `${n(day.remaining.carbs)} ${t('common.g')}`, '#F2D597'],
                  [t('macro.fat'), `${n(day.remaining.fat)} ${t('common.g')}`, brand.sage],
                ].map(([l, v, c]) => (
                  <View key={l} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.md, padding: 10, gap: 2 }}>
                    <Txt v="caption" color="rgba(255,255,255,0.65)" style={{ fontSize: 11 }}>{l}</Txt>
                    <Txt v="number" color={c}>{v}</Txt>
                  </View>
                ))}
              </Row>
            )}
            <PressableScale onPress={() => router.push('/next-meal')} accessibilityLabel={t('ai.nextMeal')}>
              <View style={{ backgroundColor: brand.gold, borderRadius: radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Icon name="restaurant" size={24} color={brand.forest} />
                <View style={{ flex: 1 }}>
                  <Txt v="h3" color={brand.forest}>{t('ai.nextMeal')}</Txt>
                  <Txt v="caption" color="#4A3A12">{t('ai.nextMealBody')}</Txt>
                </View>
                <Icon name="arrow-forward" size={20} color={brand.forest} flipRtl />
              </View>
            </PressableScale>
          </SafeAreaView>
        </LinearGradient>

        <View style={{ padding: 20, gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
          <Feature icon="barcode-outline" title={t('ai.scan')} body={t('ai.scanBody')} color={th.primary} onPress={() => router.push('/scan')} />
          <Feature icon="camera-outline" title={t('ai.photo')} body={t('ai.photoBody')} color={th.coral} phase={4} />
          <Feature icon="snow-outline" title={t('ai.fridge')} body={t('ai.fridgeBody')} color={th.water} phase={5} />
          <Feature icon="chatbubbles-outline" title={t('ai.coach')} body={t('ai.coachBody')} color={th.gold} phase={8} />
          <Row gap={8} align="flex-start" style={{ paddingHorizontal: 4 }}>
            <Icon name="shield-checkmark-outline" size={16} color={th.textMuted} />
            <Txt v="caption" muted style={{ flex: 1 }}>{t('ai.engineNote')}</Txt>
          </Row>
        </View>
      </ScrollView>
    </View>
  );
}

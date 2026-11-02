import { router } from 'expo-router';
import { View } from 'react-native';
import { CrescentBadge } from '../../components/CrescentBadge';
import { TopBar } from '../../components/recipe';
import { Card, Icon, Row, Screen, Txt, type IconName } from '../../components/ui';
import { useI18n, type StringKey } from '../../i18n';
import { FASTING_BADGES } from '../../lib/fasting';
import { fmtDate, hijriPeriodLabel } from '../../lib/format';
import { useApp } from '../../state/app';
import { useFasting } from '../../state/fasting';
import { brand, radius } from '../../theme';

export default function FastingAchievements() {
  const { t, n, lang } = useI18n();
  const { viewingMember, theme: th } = useApp();
  const f = useFasting(viewingMember?.id);
  const count = (code: string) => f.achievements.filter((a) => a.badge === code).length;

  return (
    <Screen header={<TopBar title={t('fast.achievements')} />}>
      <Card onPress={() => router.push('/fasting/badge')} tone="deep">
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 6 }}>
          <CrescentBadge size={128} earned={count('three_month') > 0} />
          <Txt v="h2" color="#fff" center>{t('badge.three_month')}</Txt>
          <Txt v="caption" color="rgba(255,255,255,0.75)" center>{count('three_month') ? t('fast.earnedTimes', { n: count('three_month') }) : t('fast.locked')}</Txt>
        </View>
      </Card>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {FASTING_BADGES.filter((b) => !b.premium).map((b) => {
          const c = count(b.code);
          return (
            <View key={b.code} style={{ width: '48%', flexGrow: 1 }}>
              <Card padding={14} style={{ opacity: c ? 1 : 0.6 }}>
                <View style={{ gap: 6 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c ? brand.forest : th.track, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={b.icon as IconName} size={22} color={c ? brand.gold : th.textFaint} />
                  </View>
                  <Txt v="bodyStrong">{t(`badge.${b.code}` as StringKey)}</Txt>
                  <Txt v="caption" muted>{t(`badge.${b.code}.desc` as StringKey)}</Txt>
                  <Txt v="caption" color={c ? th.primary : th.textFaint}>{c ? t('fast.earnedTimes', { n: n(c) }) : t('fast.locked')}</Txt>
                </View>
              </Card>
            </View>
          );
        })}
      </View>

      <Txt v="h2">{t('fast.achHistory')}</Txt>
      {f.achievements.length === 0 ? <Txt v="caption" muted>{t('fast.noLogs')}</Txt> : (
        <Card padding={6}>
          {f.achievements.map((a) => (
            <Row key={`${a.badge}-${a.periodKey}`} gap={10} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: radius.pill, backgroundColor: brand.forest, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={(FASTING_BADGES.find((b) => b.code === a.badge)?.icon ?? 'ribbon') as IconName} size={16} color={brand.gold} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="bodyStrong">{t(`badge.${a.badge}` as StringKey)}</Txt>
                <Txt v="caption" muted>{[hijriPeriodLabel(a.periodKey, lang), fmtDate(a.earnedAt.slice(0, 10), lang, { day: 'numeric', month: 'short', year: 'numeric' })].filter(Boolean).join(' · ')}</Txt>
              </View>
            </Row>
          ))}
        </Card>
      )}
    </Screen>
  );
}

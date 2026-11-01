import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';
import { CrescentBadge } from '../../components/CrescentBadge';
import { TopBar } from '../../components/recipe';
import { Card, Icon, Row, Screen, Txt } from '../../components/ui';
import { useI18n } from '../../i18n';
import { localDate } from '../../lib/dates';
import { isCompleted } from '../../lib/fasting';
import { hijriPeriodLabel } from '../../lib/format';
import { toHijri } from '../../lib/hijri';
import { useApp } from '../../state/app';
import { useFasting } from '../../state/fasting';
import { brand, radius } from '../../theme';

export default function PremiumBadge() {
  const { t, n, lang } = useI18n();
  const { viewingMember, theme: th } = useApp();
  const f = useFasting(viewingMember?.id);
  const h = toHijri(localDate(), f.profile?.hijriOffset ?? 0);
  const done = f.logs.filter((l) => isCompleted(l) && l.hijriYear === h.y && l.hijriMonth === h.m).length;
  const months = f.achievements.filter((a) => a.badge === 'three_month');

  return (
    <Screen header={<TopBar title={t('badge.three_month')} />}>
      <LinearGradient colors={th.dark ? ['#0F2D24', '#0A1F19'] : [brand.forest, '#1B5646']} style={{ borderRadius: radius.xl, padding: 24, alignItems: 'center', gap: 10 }}>
        <CrescentBadge size={180} earned={months.length > 0} />
        <Txt v="h2" color="#fff" center>{t('badge.three_month')}</Txt>
        <Txt v="caption" color="rgba(255,255,255,0.75)" center>{months.length ? t('fast.earnedTimes', { n: n(months.length) }) : t('fast.locked')}</Txt>
        <Row gap={10} style={{ marginTop: 6 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: brand.gold, backgroundColor: i <= done ? brand.gold : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={i <= done ? 'checkmark' : 'star-outline'} size={18} color={i <= done ? brand.forest : brand.gold} />
            </View>
          ))}
        </Row>
        <Txt v="label" color={brand.gold} center>{t('fast.badgeProgress', { n: Math.min(3, done) })}</Txt>
      </LinearGradient>
      <Card>
        <View style={{ gap: 6 }}>
          <Txt v="h3">{t('fast.howEarn')}</Txt>
          <Txt muted>{t('fast.howEarnBody')}</Txt>
        </View>
      </Card>
      {months.length > 0 && (
        <Card>
          <View style={{ gap: 8 }}>
            <Txt v="h3">{t('fast.achHistory')}</Txt>
            {months.map((a) => (
              <Row key={a.periodKey} gap={8}><Icon name="moon" size={16} color={brand.gold} /><Txt>{hijriPeriodLabel(a.periodKey, lang)}</Txt></Row>
            ))}
          </View>
        </Card>
      )}
    </Screen>
  );
}

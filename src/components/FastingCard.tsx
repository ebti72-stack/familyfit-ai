import { router } from 'expo-router';
import { Pressable, Switch, View } from 'react-native';
import { useI18n } from '../i18n';
import { localDate } from '../lib/dates';
import { hijriLabel } from '../lib/format';
import { useApp } from '../state/app';
import { useFasting } from '../state/fasting';
import { brand } from '../theme';
import { CrescentBadge } from './CrescentBadge';
import { Avatar, Card, Icon, Row, Txt } from './ui';

/**
 * "I'm fasting today" — on the dashboard and in the profile.
 * Never shown as a toggle for a child/teen until a guardian enabled fasting with the health acknowledgement.
 */
export function FastingCard({ variant }: { variant: 'dashboard' | 'profile' }) {
  const { t, lang } = useI18n();
  const { viewingMember, membership, theme: th } = useApp();
  const member = variant === 'profile' ? membership?.member : viewingMember;
  const f = useFasting(member?.id);
  if (!member || f.loading) return null;
  const minor = member.role === 'child' || member.role === 'teen';
  const allowed = !minor || (f.profile?.enabled && f.profile.healthAck);
  const status = f.todayLog?.status ?? null;
  const today = localDate();
  const premium = f.achievements.some((a) => a.badge === 'three_month');

  const toggle = (on: boolean) => {
    if (status === 'completed' || status === 'broken') return router.push('/fasting');
    f.setDay(today, on ? 'fasting' : null).catch(() => undefined);
  };

  const body = (
    <View style={{ gap: 10 }}>
      {variant === 'profile' && (
        <Row gap={12}>
          <Avatar emoji={member.avatarEmoji} name={member.displayName} size={52} ring={th.gold} />
          <View style={{ flex: 1 }}>
            <Txt v="h3">{member.displayName}</Txt>
            <Txt v="caption" muted>{hijriLabel(today, f.profile?.hijriOffset ?? 0, lang)}</Txt>
          </View>
          {premium && <CrescentBadge size={52} />}
        </Row>
      )}
      {premium && variant === 'profile' && <Txt v="caption" color={brand.gold}>{t('badge.three_month')}</Txt>}
      {allowed ? (
        <Row gap={12}>
          {variant === 'dashboard' && <CrescentBadge size={44} earned={premium || status === 'completed'} />}
          <View style={{ flex: 1 }}>
            <Txt v="h3">{t('fast.imFasting')}</Txt>
            <Txt v="caption" muted>
              {status === 'completed' ? t('fast.completedToday') : status === 'broken' ? t('fast.brokenToday') : status === 'fasting' ? (f.profile?.iftarTime ? t('fast.iftarAt', { t: f.profile.iftarTime }) : t('fast.nutritionHint')) : t('fast.subtitle')}
            </Txt>
          </View>
          {status === 'completed' ? <Icon name="checkmark-circle" size={26} color={brand.gold} /> : (
            <Switch value={status === 'fasting'} onValueChange={toggle} trackColor={{ true: th.primary }} accessibilityLabel={t('fast.imFasting')} />
          )}
        </Row>
      ) : (
        <Pressable onPress={() => router.push('/fasting')} accessibilityRole="link">
          <Row gap={8}><Icon name="moon-outline" size={18} color={th.primary} /><Txt v="caption" muted style={{ flex: 1 }}>{t('fast.profileEntry')}</Txt><Icon name="chevron-forward" size={18} color={th.textFaint} flipRtl /></Row>
        </Pressable>
      )}
      {allowed && (
        <Pressable onPress={() => router.push('/fasting')} accessibilityRole="link">
          <Row gap={6}><Txt v="label" color={th.primary}>{status === 'fasting' ? t('fast.completeQ') : t('fast.profileEntry')}</Txt><Icon name="arrow-forward" size={14} color={th.primary} flipRtl /></Row>
        </Pressable>
      )}
    </View>
  );
  if (variant === 'dashboard' && minor && !allowed) return null;
  return <Card>{body}</Card>;
}

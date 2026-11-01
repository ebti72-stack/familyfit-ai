import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { backend, isLocal } from '../../backend';
import { Avatar, Banner, Button, Card, Chip, Icon, IconButton, PressableScale, Row, Screen, Skeleton, Toast, Txt, type IconName } from '../../components/ui';
import { Ring, useAnimatedNumber } from '../../components/viz';
import { useI18n, type StringKey } from '../../i18n';
import { localDate, periodRange } from '../../lib/dates';
import { mealTypeForTime } from '../../lib/nextMeal';
import { buildLeaderboard } from '../../lib/points';
import type { LeaderboardRow } from '../../lib/types';
import { awardEarnedHabits, useToast } from '../../state/actions';
import { useApp } from '../../state/app';
import { useDay } from '../../state/useDay';
import { brand, radius } from '../../theme';

export default function Dashboard() {
  const { t, n } = useI18n();
  const th = useApp().theme;
  const { membership, members, viewingMember, setViewingMemberId, bump, version } = useApp();
  const day = useDay(viewingMember?.id);
  const toast = useToast();
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const isAdmin = membership?.member.role === 'admin';
  const switchable = members.filter((m) => m.id === membership?.member.id || (isAdmin && m.userId === null));

  useEffect(() => {
    if (!membership) return;
    const [from, to] = periodRange('week');
    backend.listPoints(membership.family.id, '2000-01-01', to)
      .then((pts) => setBoard(buildLeaderboard(members, pts, from, to, localDate())))
      .catch(() => setBoard([]));
  }, [membership, members, version]);

  const addWater = async (ml: number) => {
    if (!viewingMember) return;
    await backend.addWater(viewingMember.id, localDate(), ml);
    const pts = await awardEarnedHabits(viewingMember.id, localDate());
    toast.show(pts ? t('home.pointsEarned', { n: pts }) : `+${ml} ${t('common.ml')}`);
    bump();
  };

  const hour = new Date().getHours();
  const greet = hour < 12 ? t('home.greeting.morning') : t('home.greeting.evening');
  const g = day.goals;
  const kcalLeft = useAnimatedNumber(day.remaining.kcal);
  const over = g ? Math.max(0, day.consumed.kcal - g.kcal) : 0;
  const myRow = board.find((r) => r.memberId === viewingMember?.id);
  const myRank = myRow ? board.indexOf(myRow) + 1 : null;

  return (
    <View style={{ flex: 1 }}>
      <Screen header={
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6, gap: 12 }}>
          <Row justify="space-between">
            <Row gap={12}>
              <Avatar emoji={viewingMember?.avatarEmoji} name={viewingMember?.displayName ?? ''} size={46} ring={th.gold} />
              <View>
                <Txt v="caption" muted>{greet}</Txt>
                <Txt v="h2">{viewingMember?.displayName ?? ''}</Txt>
              </View>
            </Row>
            <IconButton icon="settings-outline" label={t('settings.title')} onPress={() => router.push('/settings')} />
          </Row>
          {switchable.length > 1 && (
            <Row gap={8} wrap>
              {switchable.map((m) => (
                <Chip key={m.id} label={`${m.avatarEmoji ?? ''} ${m.id === membership?.member.id ? t('fam.you') : m.displayName}`} selected={m.id === viewingMember?.id} onPress={() => setViewingMemberId(m.id)} />
              ))}
            </Row>
          )}
        </View>
      }>
        {isLocal && <Banner tone="warning" icon="phone-portrait-outline" text={t('local.banner')} />}

        {day.loading ? (
          <View style={{ gap: 12 }}><Skeleton height={230} r={24} /><Skeleton height={130} r={24} /></View>
        ) : !g ? (
          <Card tone="alt">
            <View style={{ gap: 12 }}>
              <Txt v="h3">{t('home.noProfile')}</Txt>
              <Button title={t('home.completeProfile')} onPress={() => router.push({ pathname: '/onboarding/profile', params: { memberId: viewingMember?.id, edit: '1' } })} />
            </View>
          </Card>
        ) : (
          <>
            {/* Hero: calories + macros */}
            <PressableScale onPress={() => router.push('/(tabs)/nutrition')} accessibilityLabel={t('macro.kcal')}>
              <LinearGradient colors={th.dark ? ['#0F2D24', '#0A1F19'] : [brand.forest, '#1B5646']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.xl, padding: 20, gap: 18 }}>
                <Row gap={18}>
                  <Ring size={136} stroke={13} progress={g.kcal ? day.consumed.kcal / g.kcal : 0} color={brand.gold} gradientTo="#F2D597" track="rgba(255,255,255,0.12)">
                    <Txt v="numberLg" color="#fff" center style={{ fontSize: 32, lineHeight: 38 }}>{n(kcalLeft)}</Txt>
                    <Txt v="caption" color="rgba(255,255,255,0.72)" center>{t('home.kcalLeft')}</Txt>
                  </Ring>
                  <View style={{ flex: 1, gap: 10 }}>
                    <View>
                      <Txt v="caption" color="rgba(255,255,255,0.65)">{t('home.eaten')}</Txt>
                      <Txt v="h2" color="#fff">{n(day.consumed.kcal)} <Txt v="caption" color="rgba(255,255,255,0.65)">/ {n(g.kcal)} {t('common.kcal')}</Txt></Txt>
                    </View>
                    {over > 0 && <Txt v="caption" color={brand.coral}>{t('home.over', { n: n(over) })}</Txt>}
                    <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    <View>
                      <Txt v="caption" color="rgba(255,255,255,0.65)">{t('home.goalsProgress')}</Txt>
                      <Txt v="h3" color={brand.gold}>{n(day.goalCompletion * 100)}%</Txt>
                    </View>
                  </View>
                </Row>
                <View style={{ gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.md, padding: 14 }}>
                  <DarkMacro label={t('macro.protein')} v={day.consumed.protein} goal={g.protein} color={brand.coral} unit={t('common.g')} />
                  <DarkMacro label={t('macro.carbs')} v={day.consumed.carbs} goal={g.carbs} color={brand.gold} unit={t('common.g')} />
                  <DarkMacro label={t('macro.fat')} v={day.consumed.fat} goal={g.fat} color={brand.sage} unit={t('common.g')} />
                </View>
              </LinearGradient>
            </PressableScale>

            {/* Water + activity */}
            <Row gap={12} align="stretch">
              <Card style={{ flex: 1 }} padding={16}>
                <View style={{ gap: 10, alignItems: 'center' }}>
                  <Row justify="space-between" style={{ alignSelf: 'stretch' }}>
                    <Txt v="label">{t('home.water')}</Txt>
                    <Icon name="water" size={18} color={th.water} />
                  </Row>
                  <Ring size={96} stroke={10} progress={day.waterMl / g.waterMl} color={th.water} gradientTo="#B9D8F2">
                    <Txt v="number" center>{n(day.waterMl)}</Txt>
                    <Txt v="caption" faint center>/ {n(g.waterMl)}</Txt>
                  </Ring>
                  <Button small kind="secondary" icon="add" title={t('home.quick.water')} onPress={() => addWater(250)} />
                </View>
              </Card>
              <Card style={{ flex: 1 }} padding={16} onPress={() => router.push('/(tabs)/activity')}>
                <View style={{ gap: 10, alignItems: 'center' }}>
                  <Row justify="space-between" style={{ alignSelf: 'stretch' }}>
                    <Txt v="label">{t('home.activity')}</Txt>
                    <Icon name="flame" size={18} color={th.coral} />
                  </Row>
                  <Ring size={96} stroke={10} progress={day.activeMinutes / g.activeMinutes} color={th.coral} gradientTo="#F7C9AF">
                    <Txt v="number" center>{n(day.activeMinutes)}</Txt>
                    <Txt v="caption" faint center>{t('common.min')}</Txt>
                  </Ring>
                  <Txt v="caption" muted center>{n(day.steps)} {t('home.steps')}</Txt>
                </View>
              </Card>
            </Row>

            {/* AI next meal */}
            <Card tone="alt" onPress={() => router.push('/next-meal')}>
              <Row gap={14} align="flex-start">
                <LinearGradient colors={[brand.green, brand.forest]} style={{ width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="sparkles" size={22} color={brand.gold} />
                </LinearGradient>
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt v="h3">{t('home.nextMealTitle')}</Txt>
                  <Txt v="caption" muted>{t('home.nextMealBody', { kcal: n(day.remaining.kcal), p: n(day.remaining.protein), meal: t(`meal.${mealTypeForTime(new Date())}` as StringKey) })}</Txt>
                  <Row gap={4} style={{ marginTop: 6 }}><Txt v="label" color={th.primary}>{t('home.nextMealCta')}</Txt><Icon name="arrow-forward" size={15} color={th.primary} flipRtl /></Row>
                </View>
              </Row>
            </Card>

            {/* Quick log */}
            <Row gap={10}>
              <Quick icon="restaurant-outline" label={t('home.quick.food')} color={th.primary} onPress={() => router.push('/add-food')} />
              <Quick icon="barcode-outline" label={t('home.quick.scan')} color={th.primaryDeep} onPress={() => router.push('/scan')} />
              <Quick icon="water-outline" label={t('home.quick.water')} color={th.water} onPress={() => addWater(250)} />
              <Quick icon="walk-outline" label={t('home.quick.activity')} color={th.coral} onPress={() => router.push({ pathname: '/(tabs)/activity', params: { log: '1' } })} />
            </Row>
          </>
        )}

        {/* Family */}
        <Card onPress={() => router.push('/(tabs)/family')}>
          <View style={{ gap: 12 }}>
            <Row justify="space-between">
              <Txt v="h3">{t('home.family')}</Txt>
              <Row gap={6}>
                <Icon name="trophy" size={16} color={th.gold} />
                <Txt v="label" muted>{myRank ? `${t('home.rank')} #${myRank} · ${n(myRow?.points ?? 0)} ${t('home.points')}` : ''}</Txt>
              </Row>
            </Row>
            <Row gap={10} justify="space-between">
              {board.slice(0, 4).map((r, i) => (
                <View key={r.memberId} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
                  <Avatar emoji={r.avatarEmoji} name={r.displayName} size={44} ring={i === 0 ? th.gold : undefined} />
                  <Txt v="caption" numberOfLines={1} center>{r.displayName.replace(/\s*\(.*\)$/, '')}</Txt>
                  <Txt v="label" color={th.primary} center>{n(r.points)}</Txt>
                </View>
              ))}
            </Row>
          </View>
        </Card>
      </Screen>
      <Toast text={toast.msg ?? ''} visible={!!toast.msg} />
    </View>
  );
}

function DarkMacro({ label, v, goal, color, unit }: { label: string; v: number; goal: number; color: string; unit: string }) {
  const { n } = useI18n();
  const w = useAnimatedNumber(goal ? Math.min(1, v / goal) : 0);
  return (
    <View style={{ gap: 5 }}>
      <Row justify="space-between">
        <Txt v="caption" color="rgba(255,255,255,0.8)">{label}</Txt>
        <Txt v="caption" color="#fff">{n(v)} / {n(goal)} {unit}</Txt>
      </Row>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden', flexDirection: 'row' }}>
        <View style={{ width: `${w * 100}%`, backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
}

function Quick({ icon, label, color, onPress }: { icon: IconName; label: string; color: string; onPress: () => void }) {
  const th = useApp().theme;
  return (
    <Pressable style={{ flex: 1 }} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View style={{ alignItems: 'center', gap: 6, backgroundColor: th.surface, borderRadius: radius.md, paddingVertical: 14, borderWidth: 1, borderColor: th.border }}>
        <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: th.surfaceAlt }}>
          <Icon name={icon} size={19} color={color} />
        </View>
        <Txt v="caption" center numberOfLines={1}>{label}</Txt>
      </View>
    </Pressable>
  );
}


import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { backend } from '../../backend';
import { CrescentBadge } from '../../components/CrescentBadge';
import { TopBar } from '../../components/recipe';
import { Banner, Button, Card, Icon, IconButton, Pill, Row, Screen, Segmented, Sheet, Skeleton, Toast, Txt } from '../../components/ui';
import { useI18n, type StringKey } from '../../i18n';
import { addDays, localDate } from '../../lib/dates';
import { canConfirmCompletion, fastingWarnings, isCompleted, plannedDates, type BadgeCode, type FastingStatus } from '../../lib/fasting';
import { datesOfHijriMonth, HIJRI_MONTHS, nextHijriMonth, toHijri } from '../../lib/hijri';
import { useToast } from '../../state/actions';
import { useApp } from '../../state/app';
import { useFasting } from '../../state/fasting';
import { fmtDate, hijriLabel } from '../../lib/format';
import { brand, radius } from '../../theme';

function gregMonthDates(y: number, m: number): string[] {
  const out: string[] = [];
  for (let d = `${y}-${String(m).padStart(2, '0')}-01`; Number(d.slice(5, 7)) === m; d = addDays(d, 1)) out.push(d);
  return out;
}

export default function FastingHome() {
  const { t, n, lang } = useI18n();
  const { viewingMember, membership, theme: th } = useApp();
  const f = useFasting(viewingMember?.id);
  const toast = useToast();
  const today = localDate();
  const offset = f.profile?.hijriOffset ?? 0;
  const hToday = toHijri(today, offset);
  const [cal, setCal] = useState<'hijri' | 'greg'>('hijri');
  const [hm, setHm] = useState({ y: hToday.y, m: hToday.m });
  const [gm, setGm] = useState({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) });
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newBadge, setNewBadge] = useState<BadgeCode | null>(null);
  const [family, setFamily] = useState<{ participants: number; completedDays: number } | null>(null);
  const isMinorRole = viewingMember?.role === 'child' || viewingMember?.role === 'teen';
  const blocked = isMinorRole && !(f.profile?.enabled && f.profile.healthAck);

  useEffect(() => {
    if (!membership || !f.profile?.joinFamilyChallenge) return setFamily(null);
    backend.familyFastingTotal(membership.family.id, hToday.y, hToday.m).then(setFamily).catch(() => setFamily(null));
  }, [membership, f.profile?.joinFamilyChallenge, hToday.y, hToday.m, f.logs]);

  const dates = useMemo(() => (cal === 'hijri' ? datesOfHijriMonth(hm.y, hm.m, offset) : gregMonthDates(gm.y, gm.m)), [cal, hm, gm, offset]);
  const planned = useMemo(() => (f.profile ? plannedDates(f.profile, dates[0], dates[dates.length - 1]) : []), [f.profile, dates]);
  const byDate = useMemo(() => new Map(f.logs.map((l) => [l.logDate, l])), [f.logs]);
  const summary = useMemo(() => {
    const inRange = dates.map((d) => byDate.get(d)).filter((x) => !!x);
    const completed = inRange.filter((l) => isCompleted(l!)).length;
    const plannedOpen = new Set([...planned, ...inRange.filter((l) => l!.status === 'planned').map((l) => l!.logDate)].filter((d) => {
      const s = byDate.get(d)?.status;
      return s !== 'completed' && s !== 'broken';
    }));
    const goal = f.profile?.monthlyGoal ?? 3;
    return { completed, planned: plannedOpen.size, broken: inRange.filter((l) => l!.status === 'broken').length, goal, remaining: Math.max(0, goal - completed) };
  }, [dates, byDate, planned, f.profile]);
  const thisHijriCompleted = f.logs.filter((l) => isCompleted(l) && l.hijriYear === hToday.y && l.hijriMonth === hToday.m).length;
  const plannedSet = new Set(planned);

  const act = async (date: string, status: FastingStatus | null) => {
    try {
      const fresh = await f.setDay(date, status);
      setDayOpen(null);
      setConfirmOpen(false);
      const premium = fresh.find((b) => b.badge === 'three_month');
      if (fresh.length) setNewBadge(premium ? 'three_month' : fresh[0].badge);
      else toast.show(t('common.saved'));
    } catch {
      toast.show(t('common.error'));
    }
  };

  const warnings = f.profile ? fastingWarnings(f.profile, viewingMember?.role ?? 'adult', null) : isMinorRole ? [viewingMember?.role === 'child' ? 'child' : 'teen'] : [];
  const status = f.todayLog?.status;
  const monthTitle = cal === 'hijri' ? `${HIJRI_MONTHS[lang][hm.m - 1]} ${hm.y}` : fmtDate(dates[0], lang, { month: 'long', year: 'numeric' });
  const lead = new Date(dates[0] + 'T12:00:00').getDay();
  const shift = (d: number) => (cal === 'hijri' ? setHm(nextHijriMonth(hm.y, hm.m, d)) : setGm(({ y, m }) => ({ y: m + d > 12 ? y + 1 : m + d < 1 ? y - 1 : y, m: ((m + d + 11) % 12) + 1 })));

  return (
    <View style={{ flex: 1 }}>
      <Screen header={<TopBar title={t('fast.title')} subtitle={t('fast.subtitle')} right={<IconButton icon="options-outline" label={t('fast.settings')} onPress={() => router.push('/fasting/settings')} />} />}>
        {f.loading ? <Skeleton height={220} r={24} /> : (
          <>
            {/* Today */}
            <LinearGradient colors={th.dark ? ['#0F2D24', '#0A1F19'] : [brand.forest, '#1B5646']} style={{ borderRadius: radius.xl, padding: 20, gap: 14 }}>
              <Row gap={14}>
                <CrescentBadge size={62} earned />
                <View style={{ flex: 1 }}>
                  <Txt v="caption" color="rgba(255,255,255,0.7)">{fmtDate(today, lang, { weekday: 'long', day: 'numeric', month: 'long' })}</Txt>
                  <Txt v="h3" color={brand.gold}>{hijriLabel(today, offset, lang)}</Txt>
                  {f.profile?.iftarTime && status === 'fasting' ? <Txt v="caption" color="rgba(255,255,255,0.8)">{t('fast.iftarAt', { t: f.profile.iftarTime })}</Txt> : null}
                </View>
              </Row>
              {blocked ? (
                <>
                  <Txt v="caption" color="rgba(255,255,255,0.85)">{t('fast.warn.child')}</Txt>
                  <Button kind="onDark" small title={t('fast.settings')} icon="options-outline" onPress={() => router.push('/fasting/settings')} />
                </>
              ) : status === 'completed' ? (
                <Row gap={8}><Icon name="checkmark-circle" size={22} color={brand.gold} /><Txt v="h3" color="#fff">{t('fast.completedToday')}</Txt></Row>
              ) : status === 'broken' ? (
                <>
                  <Txt color="rgba(255,255,255,0.85)">{t('fast.brokenToday')}</Txt>
                  <Button kind="onDark" small title={t('fast.day.clear')} onPress={() => act(today, null)} />
                </>
              ) : status === 'fasting' ? (
                <>
                  <Row gap={8}><Icon name="moon" size={18} color={brand.gold} /><Txt v="h3" color="#fff">{t('fast.fastingNow')}</Txt></Row>
                  <Txt v="caption" color="rgba(255,255,255,0.75)">{t('fast.nutritionHint')}</Txt>
                  <Button kind="gold" title={t('fast.completeQ')} icon="checkmark-circle-outline" onPress={() => setConfirmOpen(true)} />
                  <Row gap={10}>
                    <View style={{ flex: 1 }}><Button kind="onDark" small title={t('fast.notCompleted')} onPress={() => act(today, 'broken')} /></View>
                    <View style={{ flex: 1 }}><Button kind="onDark" small title={t('fast.day.clear')} onPress={() => act(today, null)} /></View>
                  </Row>
                </>
              ) : (
                <>
                  {(status === 'planned' || plannedSet.has(today)) && <Txt v="caption" color="rgba(255,255,255,0.8)">{t('fast.plannedToday')}</Txt>}
                  <Button kind="gold" title={t('fast.imFasting')} icon="moon-outline" onPress={() => act(today, 'fasting')} />
                </>
              )}
            </LinearGradient>

            {warnings.length > 0 && <Banner tone="warning" text={warnings.includes('child') ? t('fast.warn.child') : warnings.includes('teen') ? t('fast.warn.teen') : t('fast.warn.flagged')} />}

            {/* Premium badge progress */}
            <Card onPress={() => router.push('/fasting/badge')}>
              <Row gap={14}>
                <CrescentBadge size={64} earned={f.achievements.some((a) => a.badge === 'three_month')} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt v="h3">{t('badge.three_month')}</Txt>
                  <Txt v="caption" muted>{t('fast.badgeProgress', { n: Math.min(3, thisHijriCompleted) })}</Txt>
                  <View style={{ height: 6, borderRadius: 3, backgroundColor: th.track, overflow: 'hidden', flexDirection: 'row' }}>
                    <View style={{ width: `${(Math.min(3, thisHijriCompleted) / 3) * 100}%`, backgroundColor: brand.gold, borderRadius: 3 }} />
                  </View>
                </View>
                <Icon name="chevron-forward" size={18} color={th.textFaint} flipRtl />
              </Row>
            </Card>

            {/* Calendar */}
            <Card>
              <View style={{ gap: 12 }}>
                <Segmented value={cal} onChange={setCal} options={[{ value: 'hijri', label: t('fast.hijri') }, { value: 'greg', label: t('fast.gregorian') }]} />
                <Row justify="space-between">
                  <IconButton size={36} tone="alt" icon="chevron-back" flipRtl label="prev" onPress={() => shift(-1)} />
                  <Txt v="h3">{monthTitle}</Txt>
                  <IconButton size={36} tone="alt" icon="chevron-forward" flipRtl label="next" onPress={() => shift(1)} />
                </Row>
                <Row gap={0}>
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => <Txt key={d} v="caption" muted center style={{ flex: 1 }} numberOfLines={1}>{t(`fast.dow.${d}` as StringKey).slice(0, lang === 'ar' ? 3 : 2)}</Txt>)}
                </Row>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {Array.from({ length: lead }).map((_, i) => <View key={`b${i}`} style={{ width: `${100 / 7}%`, height: 50 }} />)}
                  {dates.map((d) => {
                    const l = byDate.get(d);
                    const s = l?.status ?? (plannedSet.has(d) ? 'planned' : null);
                    const h = toHijri(d, offset);
                    const main = cal === 'hijri' ? h.d : Number(d.slice(8));
                    const sub = cal === 'hijri' ? Number(d.slice(8)) : h.d;
                    const bg = s === 'completed' ? brand.gold : s === 'fasting' ? th.primary : s === 'planned' ? th.surfaceAlt : 'transparent';
                    const fg = s === 'completed' ? brand.forest : s === 'fasting' ? '#fff' : th.text;
                    return (
                      <Pressable key={d} style={{ width: `${100 / 7}%`, height: 50, padding: 3 }} onPress={() => !blocked && setDayOpen(d)} accessibilityLabel={d}>
                        <View style={{
                          flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: bg,
                          borderWidth: d === today ? 2 : s === 'broken' || s === 'planned' ? 1 : 0, borderStyle: s === 'planned' ? 'dashed' : 'solid',
                          borderColor: d === today ? brand.gold : s === 'broken' ? th.coral : th.primary,
                        }}>
                          <Txt v="label" color={fg} center style={{ lineHeight: 18 }}>{main}</Txt>
                          <Txt v="caption" color={s === 'completed' || s === 'fasting' ? fg : th.textFaint} center style={{ fontSize: 9.5, lineHeight: 12 }}>{sub}</Txt>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
                <Row gap={12} wrap>
                  <Legend color={brand.gold} label={t('fast.completed')} />
                  <Legend color={th.primary} label={t('fast.fasting')} />
                  <Legend color={th.surfaceAlt} border={th.primary} label={t('fast.planned')} />
                  <Legend color="transparent" border={th.coral} label={t('fast.broken')} />
                </Row>
                <Row gap={8}>
                  <Stat label={t('fast.completed')} value={n(summary.completed)} color={brand.gold} />
                  <Stat label={t('fast.planned')} value={n(summary.planned)} color={th.primary} />
                  <Stat label={t('fast.leftShort')} value={summary.goal ? n(summary.remaining) : '—'} color={th.coral} />
                  <Stat label={t('fast.goalShort')} value={summary.goal ? n(summary.goal) : '—'} color={th.text} />
                </Row>
                <Txt v="caption" faint>{t('fast.hijriNote')}</Txt>
              </View>
            </Card>

            {/* Family challenge: totals only, no ranking */}
            {membership?.family.kind !== 'personal' && <Card tone="alt">
              <View style={{ gap: 6 }}>
                <Row gap={8}><Icon name="people-outline" size={18} color={th.primary} /><Txt v="h3">{t('fast.familyTitle')}</Txt></Row>
                {family ? <Txt v="caption" muted>{t('fast.familyBody', { n: family.completedDays, p: family.participants })}</Txt> : <Txt v="caption" muted>{t('fast.familyJoin')}</Txt>}
              </View>
            </Card>}

            <Row gap={10}>
              <View style={{ flex: 1 }}><Button kind="secondary" icon="ribbon-outline" title={t('fast.achievements')} onPress={() => router.push('/fasting/achievements')} /></View>
              <View style={{ flex: 1 }}><Button kind="secondary" icon="options-outline" title={t('fast.settings')} onPress={() => router.push('/fasting/settings')} /></View>
            </Row>

            {/* History */}
            <Txt v="h2">{t('fast.history')}</Txt>
            {f.logs.filter((l) => l.logDate <= today && l.status !== 'planned').length === 0 ? <Txt v="caption" muted>{t('fast.noLogs')}</Txt> : (
              <Card padding={6}>
                {f.logs.filter((l) => l.logDate <= today && l.status !== 'planned').sort((a, b) => b.logDate.localeCompare(a.logDate)).slice(0, 12).map((l) => (
                  <Row key={l.id} gap={10} style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                    <Icon name={l.status === 'completed' ? 'checkmark-circle' : l.status === 'fasting' ? 'moon' : 'remove-circle-outline'} size={20} color={l.status === 'completed' ? brand.gold : l.status === 'fasting' ? th.primary : th.coral} />
                    <View style={{ flex: 1 }}>
                      <Txt v="bodyStrong">{`${l.hijriDay} ${HIJRI_MONTHS[lang][l.hijriMonth - 1]} ${l.hijriYear}`}</Txt>
                      <Txt v="caption" muted>{fmtDate(l.logDate, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Txt>
                    </View>
                    <Pill text={t(l.status === 'completed' ? 'fast.completed' : l.status === 'fasting' ? 'fast.fasting' : 'fast.broken')} />
                  </Row>
                ))}
              </Card>
            )}
          </>
        )}
      </Screen>

      <Sheet visible={!!dayOpen} onClose={() => setDayOpen(null)} title={dayOpen ? hijriLabel(dayOpen, offset, lang) : ''}>
        {dayOpen && (
          <>
            <Txt muted>{fmtDate(dayOpen, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</Txt>
            {canConfirmCompletion(dayOpen, today) ? (
              <>
                <Txt v="caption" muted>{t('fast.confirmBody')}</Txt>
                <Button kind="gold" icon="checkmark-circle-outline" title={t('fast.day.complete')} onPress={() => act(dayOpen, 'completed')} />
                <Button kind="secondary" title={t('fast.day.broken')} onPress={() => act(dayOpen, 'broken')} />
              </>
            ) : (
              <>
                <Button icon="calendar-outline" title={t('fast.day.plan')} onPress={() => act(dayOpen, 'planned')} />
                <Txt v="caption" faint>{t('fast.day.future')}</Txt>
              </>
            )}
            {byDate.get(dayOpen) && <Button kind="ghost" title={t('fast.day.clear')} onPress={() => act(dayOpen, null)} />}
          </>
        )}
      </Sheet>

      <Sheet visible={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('fast.confirmTitle')}>
        <Txt muted>{t('fast.confirmBody')}</Txt>
        <Button kind="gold" title={t('fast.confirmYes')} icon="checkmark-circle" onPress={() => act(today, 'completed')} />
        <Button kind="secondary" title={t('common.cancel')} onPress={() => setConfirmOpen(false)} />
      </Sheet>

      <Sheet visible={!!newBadge} onClose={() => setNewBadge(null)}>
        {newBadge && (
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 8 }}>
            {newBadge === 'three_month' ? <CrescentBadge size={140} /> : <Icon name="ribbon" size={64} color={brand.gold} />}
            <Txt v="label" color={brand.gold} center>{t('fast.newBadge')}</Txt>
            <Txt v="h2" center>{t(`badge.${newBadge}` as StringKey)}</Txt>
            <Txt muted center>{t(`badge.${newBadge}.desc` as StringKey)}</Txt>
            <Button title={t('common.close')} onPress={() => setNewBadge(null)} />
          </View>
        )}
      </Sheet>
      <Toast text={toast.msg ?? ''} visible={!!toast.msg} />
    </View>
  );
}

function Legend({ color, border, label }: { color: string; border?: string; label: string }) {
  return (
    <Row gap={5}>
      <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: color, borderWidth: border ? 1 : 0, borderColor: border }} />
      <Txt v="caption" muted>{label}</Txt>
    </Row>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const th = useApp().theme;
  return (
    <View style={{ flex: 1, backgroundColor: th.surfaceAlt, borderRadius: radius.md, padding: 10, gap: 2 }}>
      <Txt v="caption" muted numberOfLines={1} style={{ fontSize: 11 }}>{label}</Txt>
      <Txt v="number" color={color}>{value}</Txt>
    </View>
  );
}

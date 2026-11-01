import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { backend } from '../../backend';
import { Banner, Button, Card, Chip, Field, Icon, Row, Screen, Sheet, Skeleton, Toast, Txt } from '../../components/ui';
import { Ring } from '../../components/viz';
import { useI18n, type StringKey } from '../../i18n';
import { localDate } from '../../lib/dates';
import { ACTIVITY_METS, estimateActivityKcal } from '../../lib/points';
import { awardEarnedHabits, useToast } from '../../state/actions';
import { useApp } from '../../state/app';
import { useDay } from '../../state/useDay';
import { radius } from '../../theme';

const CUPS = [150, 250, 350, 500];

export default function Activity() {
  const { t, n } = useI18n();
  const params = useLocalSearchParams<{ log?: string }>();
  const { viewingMember, bump, theme: th } = useApp();
  const day = useDay(viewingMember?.id);
  const toast = useToast();
  const [customWater, setCustomWater] = useState(false);
  const [waterMl, setWaterMl] = useState('');
  const [logOpen, setLogOpen] = useState(false);
  const [type, setType] = useState('walking');
  const [minutes, setMinutes] = useState('30');
  const [steps, setSteps] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params.log) setLogOpen(true);
  }, [params.log]);

  const afterWrite = async (fallback: string) => {
    if (!viewingMember) return;
    const pts = await awardEarnedHabits(viewingMember.id, localDate());
    toast.show(pts ? t('home.pointsEarned', { n: pts }) : fallback);
    bump();
  };

  const addWater = async (ml: number) => {
    if (!viewingMember || !(ml >= 10 && ml <= 2000)) return;
    await backend.addWater(viewingMember.id, localDate(), ml);
    await afterWrite(`+${ml} ${t('common.ml')}`);
  };

  const logActivity = async () => {
    if (!viewingMember) return;
    const m = parseInt(minutes || '0', 10);
    const s = parseInt(steps || '0', 10);
    if (m < 0 || m > 600 || s < 0 || s > 100000 || (m === 0 && s === 0)) return;
    setBusy(true);
    try {
      await backend.addActivity({
        memberId: viewingMember.id, logDate: localDate(), activityType: type, minutes: m, steps: s,
        kcalEstimate: estimateActivityKcal(type, m, day.profile?.weightKg ?? null), source: 'manual',
      });
      setLogOpen(false);
      setSteps('');
      await afterWrite(t('common.done'));
    } finally {
      setBusy(false);
    }
  };

  const g = day.goals;
  const preview = estimateActivityKcal(type, parseInt(minutes || '0', 10), day.profile?.weightKg ?? null);

  return (
    <View style={{ flex: 1 }}>
      <Screen header={<Row style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 }}><Txt v="h1">{t('activity.title')}</Txt></Row>}>
        {day.loading || !g ? <Skeleton height={300} r={24} /> : (
          <>
            {/* Hydration */}
            <Card>
              <View style={{ gap: 16 }}>
                <Row justify="space-between">
                  <Row gap={8}><Icon name="water" size={20} color={th.water} /><Txt v="h3">{t('water.title')}</Txt></Row>
                  <Txt v="label" muted>{n(Math.max(0, g.waterMl - day.waterMl))} {t('common.ml')} {t('common.left')}</Txt>
                </Row>
                <Row gap={18}>
                  <Ring size={124} stroke={12} progress={day.waterMl / g.waterMl} color={th.water} gradientTo="#B9D8F2">
                    <Txt v="h2" center>{n(Math.round((day.waterMl / g.waterMl) * 100))}%</Txt>
                    <Txt v="caption" faint center>{n(day.waterMl)} / {n(g.waterMl)}</Txt>
                  </Ring>
                  <View style={{ flex: 1, gap: 8 }}>
                    <Row wrap gap={8}>
                      {CUPS.map((c) => (
                        <Pressable key={c} onPress={() => addWater(c)} accessibilityLabel={`${c} ml`} style={{ width: '47%' }}>
                          <View style={{ backgroundColor: th.surfaceAlt, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', gap: 2 }}>
                            <Icon name="water-outline" size={c >= 350 ? 20 : 16} color={th.water} />
                            <Txt v="label" center>{c}</Txt>
                          </View>
                        </Pressable>
                      ))}
                    </Row>
                    <Button small kind="ghost" title={t('water.custom')} onPress={() => setCustomWater(true)} />
                  </View>
                </Row>
                {day.water.length > 0 && (
                  <Row wrap gap={6}>
                    {day.water.map((w) => (
                      <Pressable key={w.id} onPress={async () => { await backend.deleteWater(w.id); bump(); }} accessibilityLabel={t('common.delete')}>
                        <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', backgroundColor: th.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <Txt v="caption">{new Date(w.loggedAt).toTimeString().slice(0, 5)} · {w.ml}</Txt>
                          <Icon name="close" size={12} color={th.textMuted} />
                        </View>
                      </Pressable>
                    ))}
                  </Row>
                )}
                <Txt v="caption" faint>{t('water.goalNote')}</Txt>
              </View>
            </Card>

            {/* Activity */}
            <Card>
              <View style={{ gap: 14 }}>
                <Row justify="space-between">
                  <Row gap={8}><Icon name="flame" size={20} color={th.coral} /><Txt v="h3">{t('activity.title')}</Txt></Row>
                  <Button small full={false} icon="add" title={t('activity.log')} onPress={() => setLogOpen(true)} />
                </Row>
                <Row gap={12}>
                  <Metric label={t('activity.minutesToday')} value={`${n(day.activeMinutes)} / ${n(g.activeMinutes)}`} color={th.coral} />
                  <Metric label={t('activity.steps')} value={`${n(day.steps)} / ${n(g.steps)}`} color={th.primary} />
                </Row>
                {day.kcalBurnedEstimate != null && <Txt v="caption" muted>{t('activity.kcalEst', { n: n(day.kcalBurnedEstimate) })}</Txt>}
                {day.activity.length === 0 ? <Txt v="caption" muted>{t('activity.empty')}</Txt> : day.activity.map((a) => (
                  <Row key={a.id} justify="space-between" style={{ backgroundColor: th.surfaceAlt, borderRadius: 14, padding: 12 }}>
                    <Txt v="bodyStrong">{t(`activity.${a.activityType}` as StringKey)}</Txt>
                    <Txt v="caption" muted>{a.minutes ? `${n(a.minutes)} ${t('common.min')}` : ''}{a.steps ? ` · ${n(a.steps)} ${t('home.steps')}` : ''}</Txt>
                  </Row>
                ))}
                <Banner text={t('activity.stepsManual')} icon="watch-outline" />
              </View>
            </Card>
          </>
        )}
      </Screen>

      <Sheet visible={customWater} onClose={() => setCustomWater(false)} title={t('water.custom')}>
        <Field label={t('common.ml')} value={waterMl} onChangeText={(v) => setWaterMl(v.replace(/\D/g, ''))} keyboardType="number-pad" autoFocus />
        <Button title={t('common.add')} disabled={!(+waterMl >= 10 && +waterMl <= 2000)} onPress={async () => { await addWater(+waterMl); setCustomWater(false); setWaterMl(''); }} />
      </Sheet>

      <Sheet visible={logOpen} onClose={() => setLogOpen(false)} title={t('activity.log')}>
        <Txt v="label" muted>{t('activity.type')}</Txt>
        <Row wrap gap={8}>{Object.keys(ACTIVITY_METS).map((k) => <Chip key={k} label={t(`activity.${k}` as StringKey)} selected={type === k} onPress={() => setType(k)} />)}</Row>
        <Row gap={10} align="flex-start">
          <View style={{ flex: 1 }}><Field label={t('activity.minutes')} value={minutes} onChangeText={(v) => setMinutes(v.replace(/\D/g, ''))} keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field label={`${t('activity.steps')} (${t('common.optional')})`} value={steps} onChangeText={(v) => setSteps(v.replace(/\D/g, ''))} keyboardType="number-pad" /></View>
        </Row>
        <Txt v="caption" muted>{preview != null ? t('activity.kcalEst', { n: n(preview) }) : t('activity.noWeight')}</Txt>
        <Button title={t('common.save')} loading={busy} onPress={logActivity} />
      </Sheet>
      <Toast text={toast.msg ?? ''} visible={!!toast.msg} />
    </View>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  const th = useApp().theme;
  return (
    <View style={{ flex: 1, backgroundColor: th.surfaceAlt, borderRadius: 16, padding: 12, gap: 2 }}>
      <Row gap={6}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} /><Txt v="caption" muted>{label}</Txt></Row>
      <Txt v="number">{value}</Txt>
    </View>
  );
}

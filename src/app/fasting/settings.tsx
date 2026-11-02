import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { backend } from '../../backend';
import { CheckRow, TopBar } from '../../components/recipe';
import { Banner, Button, Card, Chip, Field, IconButton, Row, Screen, Txt } from '../../components/ui';
import { useI18n, type StringKey } from '../../i18n';
import { localDate } from '../../lib/dates';
import { DEFAULT_GOAL, defaultFastingProfile, fastingWarnings, type FastingProfile, type FastingType, type HealthFlag } from '../../lib/fasting';
import { hijriLabel } from '../../lib/format';
import { useApp } from '../../state/app';
import { useFasting } from '../../state/fasting';

const TYPES: FastingType[] = ['three_monthly', 'mon_thu', 'ayyam_bid', 'ramadan', 'voluntary', 'custom'];
const FLAGS: HealthFlag[] = ['pregnant', 'breastfeeding', 'diabetes', 'medication', 'chronic', 'eating_disorder'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default function FastingSettings() {
  const { t, n, lang } = useI18n();
  const { viewingMember, membership, bump, theme: th } = useApp();
  const f = useFasting(viewingMember?.id);
  const [p, setP] = useState<FastingProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!f.loading && viewingMember) setP(f.profile ?? defaultFastingProfile(viewingMember.id));
  }, [f.loading, f.profile, viewingMember]);

  if (!p || !viewingMember) return <Screen header={<TopBar title={t('fast.settings')} />}><View /></Screen>;
  const up = (patch: Partial<FastingProfile>) => setP({ ...p, ...patch });
  const warnings = fastingWarnings(p, viewingMember.role, null);
  const minor = viewingMember.role === 'child' || viewingMember.role === 'teen';
  const needsAck = p.enabled && (minor || p.healthFlags.length > 0);
  const bad = (v: string | null, re: RegExp) => !!v && !re.test(v);

  const save = async () => {
    setErr(null);
    if (needsAck && !p.healthAck) return setErr(t('fast.ackRequired'));
    if (bad(p.suhoorTime, TIME) || bad(p.iftarTime, TIME) || bad(p.startDate, DATE) || bad(p.endDate, DATE)) return setErr(t('common.error'));
    setBusy(true);
    try {
      await backend.saveFastingProfile(p);
      bump();
      router.back();
    } catch (e: any) {
      setErr(e?.code === 'forbidden' ? t('fast.ackRequired') : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<TopBar title={t('fast.settings')} subtitle={viewingMember.displayName} />}>
      <Card>
        <Row justify="space-between">
          <Txt v="h3" style={{ flex: 1 }}>{t('fast.enable')}</Txt>
          <Switch value={p.enabled} onValueChange={(v) => up({ enabled: v })} trackColor={{ true: th.primary }} />
        </Row>
      </Card>

      {minor && <Banner tone="warning" text={viewingMember.role === 'child' ? t('fast.warn.child') : t('fast.warn.teen')} />}

      <Card>
        <View style={{ gap: 12 }}>
          <Txt v="label" muted>{t('fast.type')}</Txt>
          <Row gap={8} wrap>
            {TYPES.map((x) => <Chip key={x} label={t(`fast.type.${x}` as StringKey)} selected={p.type === x} onPress={() => up({ type: x, monthlyGoal: DEFAULT_GOAL[x] || p.monthlyGoal })} />)}
          </Row>
          {p.type === 'three_monthly' && (
            <View style={{ gap: 8 }}>
              <Txt v="label" muted>{t('fast.hijriDays')}</Txt>
              <Row gap={6} wrap>
                {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                  <Chip key={d} label={String(d)} selected={p.hijriDays.includes(d)} onPress={() => up({ hijriDays: p.hijriDays.includes(d) ? p.hijriDays.filter((x) => x !== d) : [...p.hijriDays, d].sort((a, b) => a - b) })} />
                ))}
              </Row>
              <Txt v="caption" faint>{t('fast.hijriDaysHint')}</Txt>
            </View>
          )}
          {p.type === 'custom' && (
            <View style={{ gap: 8 }}>
              <Txt v="label" muted>{t('fast.daysOfWeek')}</Txt>
              <Row gap={6} wrap>
                {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                  <Chip key={d} label={t(`fast.dow.${d}` as StringKey)} selected={p.daysOfWeek.includes(d)} onPress={() => up({ daysOfWeek: p.daysOfWeek.includes(d) ? p.daysOfWeek.filter((x) => x !== d) : [...p.daysOfWeek, d] })} />
                ))}
              </Row>
            </View>
          )}
          {p.type === 'voluntary' && <Txt v="caption" faint>{t('fast.hijriDaysHint')}</Txt>}
          <Row justify="space-between">
            <Txt v="label" style={{ flex: 1 }}>{t('fast.goal')}</Txt>
            <Row gap={8}>
              <IconButton size={34} tone="alt" icon="remove" label="-" onPress={() => up({ monthlyGoal: Math.max(0, p.monthlyGoal - 1) })} />
              <Txt v="number" style={{ minWidth: 30 }} center>{n(p.monthlyGoal)}</Txt>
              <IconButton size={34} tone="alt" icon="add" label="+" onPress={() => up({ monthlyGoal: Math.min(30, p.monthlyGoal + 1) })} />
            </Row>
          </Row>
        </View>
      </Card>

      <Card>
        <View style={{ gap: 12 }}>
          <Row gap={10}>
            <View style={{ flex: 1 }}><Field label={t('fast.start')} hint={t('fast.dateHint')} value={p.startDate ?? ''} onChangeText={(v) => up({ startDate: v.trim() || null })} error={bad(p.startDate, DATE) ? t('fast.dateHint') : null} /></View>
            <View style={{ flex: 1 }}><Field label={t('fast.end')} hint={t('fast.dateHint')} value={p.endDate ?? ''} onChangeText={(v) => up({ endDate: v.trim() || null })} error={bad(p.endDate, DATE) ? t('fast.dateHint') : null} /></View>
          </Row>
          <Row gap={10}>
            <View style={{ flex: 1 }}><Field label={t('fast.suhoorTime')} hint={t('fast.timeHint')} value={p.suhoorTime ?? ''} onChangeText={(v) => up({ suhoorTime: v.trim() || null })} error={bad(p.suhoorTime, TIME) ? t('fast.timeHint') : null} /></View>
            <View style={{ flex: 1 }}><Field label={t('fast.iftarTime')} hint={t('fast.timeHint')} value={p.iftarTime ?? ''} onChangeText={(v) => up({ iftarTime: v.trim() || null })} error={bad(p.iftarTime, TIME) ? t('fast.timeHint') : null} /></View>
          </Row>
        </View>
      </Card>

      <Card>
        <View style={{ gap: 10 }}>
          <Row justify="space-between">
            <Txt v="label" style={{ flex: 1 }}>{t('fast.offset')}</Txt>
            <Row gap={8}>
              <IconButton size={34} tone="alt" icon="remove" label="-" onPress={() => up({ hijriOffset: Math.max(-2, p.hijriOffset - 1) })} />
              <Txt v="number" style={{ minWidth: 30 }} center>{p.hijriOffset > 0 ? `+${p.hijriOffset}` : String(p.hijriOffset)}</Txt>
              <IconButton size={34} tone="alt" icon="add" label="+" onPress={() => up({ hijriOffset: Math.min(2, p.hijriOffset + 1) })} />
            </Row>
          </Row>
          <Txt v="caption" muted>{t('fast.offsetToday', { d: hijriLabel(localDate(), p.hijriOffset, lang) })}</Txt>
          <Txt v="caption" faint>{t('fast.hijriNote')}</Txt>
        </View>
      </Card>

      {membership?.family.kind !== 'personal' && <Card>
        <View style={{ gap: 6 }}>
          <Row justify="space-between">
            <Txt v="h3" style={{ flex: 1 }}>{t('fast.joinFamily')}</Txt>
            <Switch value={p.joinFamilyChallenge} onValueChange={(v) => up({ joinFamilyChallenge: v })} trackColor={{ true: th.primary }} />
          </Row>
          <Txt v="caption" muted>{t('fast.joinFamilyHint')}</Txt>
        </View>
      </Card>}

      <Card>
        <View style={{ gap: 10 }}>
          <Txt v="h3">{t('fast.health')}</Txt>
          <Txt v="caption" muted>{t('fast.healthHint')}</Txt>
          <Row gap={8} wrap>
            {FLAGS.map((x) => <Chip key={x} label={t(`fast.flag.${x}` as StringKey)} selected={p.healthFlags.includes(x)} onPress={() => up({ healthFlags: p.healthFlags.includes(x) ? p.healthFlags.filter((y) => y !== x) : [...p.healthFlags, x] })} />)}
          </Row>
          <Banner tone="warning" text={t('fast.warn.general')} />
          {warnings.some((w) => FLAGS.includes(w as HealthFlag)) && <Banner tone="warning" text={t('fast.warn.flagged')} />}
          <CheckRow label={t('fast.ack')} checked={p.healthAck} onPress={() => up({ healthAck: !p.healthAck })} />
        </View>
      </Card>

      <Banner text={t('fast.noDeficit')} icon="nutrition-outline" />
      {err && <Banner tone="warning" text={err} />}
      <Button title={t('common.save')} loading={busy} onPress={save} />
    </Screen>
  );
}

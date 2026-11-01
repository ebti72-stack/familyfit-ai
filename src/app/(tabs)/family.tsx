import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Share, Text, View } from 'react-native';
import { AvatarPicker } from '../../components/AvatarPicker';
import { backend } from '../../backend';
import { Avatar, Banner, Button, Card, Chip, Field, Icon, IconButton, Pill, Row, Screen, Segmented, Sheet, Skeleton, Txt } from '../../components/ui';
import { useI18n, type StringKey } from '../../i18n';
import { localDate, periodRange, type Period } from '../../lib/dates';
import { badgesFor, buildLeaderboard, ranks } from '../../lib/points';
import type { LeaderboardRow, MemberRole, PointsConfig, PointsEntry } from '../../lib/types';
import { useApp } from '../../state/app';
import { brand, cardShadow, radius } from '../../theme';

const MEDALS = [
  { c1: '#E9C46A', c2: '#C8962E', label: '🥇' },
  { c1: '#D7DDE0', c2: '#A9B3B8', label: '🥈' },
  { c1: '#E5B08A', c2: '#B9784F', label: '🥉' },
];

export default function Family() {
  const { t, n } = useI18n();
  const { membership, members, setViewingMemberId, refreshFamily, version, theme: th } = useApp();
  const [period, setPeriod] = useState<Period>('week');
  const [points, setPoints] = useState<PointsEntry[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const isAdmin = membership?.member.role === 'admin';

  useEffect(() => {
    if (!membership) return;
    backend.listPoints(membership.family.id, '2000-01-01', localDate()).then(setPoints).catch(() => setPoints([]));
  }, [membership, version]);

  const board = useMemo(() => {
    if (!points) return null;
    const [from, to] = periodRange(period);
    return buildLeaderboard(members, points, from, to, localDate());
  }, [points, members, period]);
  const allTime = useMemo(() => (points ? buildLeaderboard(members, points, '2000-01-01', localDate(), localDate()) : []), [points, members]);
  const rk = board ? ranks(board) : [];

  if (!membership) return null;

  return (
    <Screen header={<Row style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 6 }}><Txt v="h1">{membership.family.name}</Txt></Row>}>
      <Segmented value={period} onChange={setPeriod} options={(['day', 'week', 'month', 'all'] as Period[]).map((p) => ({ value: p, label: t(`fam.period.${p}` as StringKey) }))} />

      {!board ? <Skeleton height={260} r={24} /> : (
        <>
          <LinearGradient colors={th.dark ? ['#13302A', '#0C1613'] : ['#FFFFFF', brand.mint]} style={[{ borderRadius: radius.xl, padding: 18, paddingTop: 22, borderWidth: 1, borderColor: th.border }, cardShadow(th)]}>
            <Row gap={8} justify="center" align="flex-end">
              {[1, 0, 2].map((pos) => {
                const r = board[pos];
                if (!r) return <View key={pos} style={{ flex: 1 }} />;
                const h = pos === 0 ? 112 : pos === 1 ? 84 : 66;
                const m = MEDALS[Math.min(rk[pos] - 1, 2)] ?? MEDALS[2];
                return (
                  <View key={r.memberId} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 22 }}>{r.points > 0 ? m.label : ''}</Text>
                    <Avatar emoji={r.avatarEmoji} name={r.displayName} size={pos === 0 ? 62 : 52} ring={r.points > 0 ? m.c1 : th.border} />
                    <Txt v="label" center numberOfLines={1}>{shortName(r.displayName)}</Txt>
                    <LinearGradient colors={[m.c1, m.c2]} style={{ width: '100%', height: h, borderTopLeftRadius: 16, borderTopRightRadius: 16, alignItems: 'center', paddingTop: 10, opacity: r.points > 0 ? 1 : 0.35 }}>
                      <Txt v="h2" color="#fff" center>{n(r.points)}</Txt>
                      <Txt v="caption" color="rgba(255,255,255,0.9)" center>{t('home.points')}</Txt>
                    </LinearGradient>
                  </View>
                );
              })}
            </Row>
          </LinearGradient>

          {board.every((r) => r.points === 0) && <Banner text={t('fam.empty')} icon="trophy-outline" />}

          <View style={{ gap: 8 }}>
            {board.map((r, i) => (
              <LeaderRow key={r.memberId} r={r} rank={rk[i]} allTimePoints={allTime.find((x) => x.memberId === r.memberId)?.points ?? 0} isMe={r.memberId === membership.member.id} />
            ))}
          </View>
          <Txt v="caption" faint center>{t('fam.privacy')}</Txt>
        </>
      )}

      <Card>
        <View style={{ gap: 12 }}>
          <Txt v="h3">{t('fam.invite')}</Txt>
          <Txt v="caption" muted>{t('fam.inviteBody')}</Txt>
          <Row justify="space-between" style={{ backgroundColor: th.surfaceAlt, borderRadius: radius.md, padding: 14 }}>
            <Txt v="h2" style={{ letterSpacing: 4 }}>{membership.family.inviteCode}</Txt>
            <IconButton icon="share-outline" label={t('fam.share')} onPress={() => Share.share({ message: `FamilyFit AI · ${membership.family.name}: ${membership.family.inviteCode}` })} />
          </Row>
        </View>
      </Card>

      <View style={{ gap: 8 }}>
        <Row justify="space-between">
          <Txt v="h2">{t('fam.members')}</Txt>
          {isAdmin && <Button small full={false} kind="secondary" icon="person-add-outline" title={t('fam.addChild')} onPress={() => setAddOpen(true)} />}
        </Row>
        {members.map((m) => {
          const supervised = m.userId === null && isAdmin;
          return (
            <Card key={m.id} padding={14}>
              <Row gap={12}>
                <Avatar emoji={m.avatarEmoji} name={m.displayName} size={42} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt v="bodyStrong">{m.displayName}{m.id === membership.member.id ? ` · ${t('fam.you')}` : ''}</Txt>
                  <Row gap={6}><Pill text={t(`role.${m.role}` as StringKey)} />{m.userId === null && <Pill text={t('fam.managed')} icon="shield-checkmark-outline" />}</Row>
                </View>
                {supervised && (
                  <Row gap={6}>
                    <IconButton size={36} tone="alt" icon="create-outline" label={t('settings.profile')} onPress={() => router.push({ pathname: '/onboarding/profile', params: { memberId: m.id, edit: '1' } })} />
                    <IconButton size={36} tone="alt" icon="eye-outline" label={t('fam.viewAs')} onPress={() => { setViewingMemberId(m.id); router.push('/(tabs)'); }} />
                  </Row>
                )}
              </Row>
            </Card>
          );
        })}
      </View>

      <Card tone="alt" onPress={() => setRulesOpen(true)}>
        <Row gap={12}>
          <Icon name="ribbon-outline" size={22} color={th.dark ? th.gold : brand.forest} />
          <View style={{ flex: 1 }}>
            <Txt v="h3">{t('fam.pointsRules')}</Txt>
            <Txt v="caption" muted>{t('fam.pointsRulesBody')}</Txt>
          </View>
          <Icon name="chevron-forward" size={18} color={th.textMuted} flipRtl />
        </Row>
      </Card>

      <Card style={{ opacity: 0.65 }}>
        <Row gap={12}>
          <Icon name="flag-outline" size={22} color={th.coral} />
          <View style={{ flex: 1 }}>
            <Txt v="h3">{t('fam.challenges')}</Txt>
            <Txt v="caption" muted>{t('fam.challengesBody')}</Txt>
          </View>
          <Pill text={t('common.phase', { n: 7 })} icon="time-outline" color={th.textMuted} />
        </Row>
      </Card>

      <AddMemberSheet visible={addOpen} onClose={() => setAddOpen(false)} familyId={membership.family.id} onAdded={refreshFamily} />
      <RulesSheet visible={rulesOpen} onClose={() => setRulesOpen(false)} cfg={membership.family.pointsConfig} editable={isAdmin} familyId={membership.family.id} onSaved={refreshFamily} />
    </Screen>
  );
}

const shortName = (s: string) => s.replace(/\s*\(.*\)$/, '');

function LeaderRow({ r, rank, allTimePoints, isMe }: { r: LeaderboardRow; rank: number; allTimePoints: number; isMe: boolean }) {
  const { t, n } = useI18n();
  const th = useApp().theme;
  const badges = badgesFor(r, allTimePoints);
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: isMe ? th.surfaceAlt : th.surface, borderWidth: 1, borderColor: isMe ? th.primary + '55' : th.border }]}>
      <View style={{ width: 30, alignItems: 'center' }}>
        <Txt v="h3" color={rank <= 3 && r.points > 0 ? th.gold : th.textMuted} center>{rank}</Txt>
      </View>
      <Avatar emoji={r.avatarEmoji} name={r.displayName} size={42} />
      <View style={{ flex: 1, gap: 3 }}>
        <Txt v="bodyStrong" numberOfLines={1}>{r.displayName}</Txt>
        <Row gap={8} wrap>
          {r.streak > 0 && <Txt v="caption" color={th.coral}>🔥 {t('fam.streak', { n: r.streak })}</Txt>}
          <Txt v="caption" muted>{t('fam.activeDays', { n: r.activeDays })}</Txt>
          {badges.map((b) => <Text key={b.code} accessibilityLabel={t(`badge.${b.code}` as StringKey)}>{b.emoji}</Text>)}
        </Row>
      </View>
      <View style={{ alignItems: 'center' }}>
        <Txt v="number" color={th.primary}>{n(r.points)}</Txt>
        <Txt v="caption" faint>{t('home.points')}</Txt>
      </View>
    </View>
  );
}

function AddMemberSheet({ visible, onClose, familyId, onAdded }: { visible: boolean; onClose: () => void; familyId: string; onAdded: () => Promise<void> }) {
  const { t } = useI18n();
  const th = useApp().theme;
  const [name, setName] = useState('');
  const [role, setRole] = useState<MemberRole>('child');
  const [emoji, setEmoji] = useState('👦');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try {
      const m = await backend.addManagedMember(familyId, name.trim(), role, emoji);
      await onAdded();
      onClose();
      setName('');
      setConsent(false);
      router.push({ pathname: '/onboarding/profile', params: { memberId: m.id, edit: '1' } });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t('fam.addChild')}>
      <Txt v="caption" muted>{t('fam.addChildBody')}</Txt>
      <Field label={t('auth.name')} value={name} onChangeText={setName} />
      <Row gap={8}>{(['child', 'teen', 'adult'] as MemberRole[]).map((r) => <Chip key={r} label={t(`role.${r}` as StringKey)} selected={role === r} onPress={() => setRole(r)} />)}</Row>
      <AvatarPicker value={emoji} onChange={setEmoji} />
      <Pressable onPress={() => setConsent(!consent)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
        <Row gap={10} align="flex-start">
          <Icon name={consent ? 'checkbox' : 'square-outline'} size={22} color={consent ? th.primary : th.textMuted} />
          <Txt v="caption" style={{ flex: 1 }}>{t('fam.consent')}</Txt>
        </Row>
      </Pressable>
      <Button title={t('common.add')} disabled={!name.trim() || !consent} loading={busy} onPress={add} />
    </Sheet>
  );
}

function RulesSheet({ visible, onClose, cfg, editable, familyId, onSaved }: { visible: boolean; onClose: () => void; cfg: PointsConfig; editable: boolean; familyId: string; onSaved: () => Promise<void> }) {
  const { t, n } = useI18n();
  const [draft, setDraft] = useState(cfg);
  useEffect(() => setDraft(cfg), [cfg, visible]);
  const keys = Object.keys(draft) as (keyof PointsConfig)[];
  return (
    <Sheet visible={visible} onClose={onClose} title={t('fam.pointsRules')}>
      <Banner text={t('fam.pointsRulesBody')} />
      {keys.map((k) => (
        <Row key={k} justify="space-between">
          <Txt style={{ flex: 1 }}>{t(`fam.points.${k}` as StringKey)}</Txt>
          {editable ? (
            <Row gap={8}>
              <IconButton size={32} tone="alt" icon="remove" label="-" onPress={() => setDraft({ ...draft, [k]: Math.max(0, draft[k] - 5) })} />
              <Txt v="number" style={{ minWidth: 36 }} center>{n(draft[k])}</Txt>
              <IconButton size={32} tone="alt" icon="add" label="+" onPress={() => setDraft({ ...draft, [k]: Math.min(200, draft[k] + 5) })} />
            </Row>
          ) : <Txt v="number">{n(draft[k])}</Txt>}
        </Row>
      ))}
      {editable && <Button title={t('common.save')} onPress={async () => { await backend.updatePointsConfig(familyId, draft); await onSaved(); onClose(); }} />}
    </Sheet>
  );
}

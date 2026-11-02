import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AvatarPicker } from '../../components/AvatarPicker';
import { backend, BackendError, isLocal } from '../../backend';
import { LocalBackend } from '../../backend/local';
import { Banner, Button, Card, Chip, Field, Icon, Row, Screen, Segmented, Txt, type IconName } from '../../components/ui';
import { useI18n, type StringKey } from '../../i18n';
import type { GroupKind, MemberRole } from '../../lib/types';
import { useApp } from '../../state/app';
import { radius } from '../../theme';

type Mode = 'personal' | 'group';

export default function FamilySetup() {
  const { t } = useI18n();
  const { setMembership, theme } = useApp();
  const [mode, setMode] = useState<Mode | null>(null);
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [kind, setKind] = useState<Exclude<GroupKind, 'personal'>>('family');
  const [groupName, setGroupName] = useState('');
  const [myName, setMyName] = useState('');
  const [code, setCode] = useState('');
  const [role, setRole] = useState<MemberRole>('adult');
  const [emoji, setEmoji] = useState('👩');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async (fn: () => Promise<any>) => {
    setError(null);
    setBusy(true);
    try {
      const m = await fn();
      setMembership(m);
      router.replace('/onboarding/profile');
    } catch (e) {
      setError(e instanceof BackendError && e.code === 'invalid_code' ? t('family.invalidCode') : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  if (!mode) {
    return (
      <Screen>
        <View style={{ gap: 6, marginTop: 12 }}>
          <Txt v="h1">{t('onb.mode.title')}</Txt>
          <Txt muted>{t('onb.mode.body')}</Txt>
        </View>
        <ModeCard icon="person-outline" title={t('onb.mode.personal')} body={t('onb.mode.personalBody')} onPress={() => setMode('personal')} />
        <ModeCard icon="people-outline" title={t('onb.mode.group')} body={t('onb.mode.groupBody')} onPress={() => setMode('group')} />
      </Screen>
    );
  }

  const back = (
    <Pressable onPress={() => { setMode(null); setError(null); }} accessibilityRole="button" style={{ alignSelf: 'flex-start', paddingVertical: 6 }}>
      <Txt v="label" color={theme.primary}>{t('onb.mode.back')}</Txt>
    </Pressable>
  );

  if (mode === 'personal') {
    return (
      <Screen>
        <View style={{ gap: 6, marginTop: 12 }}>
          <Txt v="h1">{t('onb.mode.personal')}</Txt>
          <Txt muted>{t('onb.mode.personalBody')}</Txt>
        </View>
        <Card>
          <View style={{ gap: 14 }}>
            <Field label={t('onb.mode.yourName')} value={myName} onChangeText={setMyName} />
            <View style={{ gap: 8 }}>
              <Txt v="label" muted>{t('family.avatar')}</Txt>
              <AvatarPicker value={emoji} onChange={setEmoji} />
            </View>
            {error && <Txt v="caption" color={theme.danger}>{error}</Txt>}
            <Button title={t('onb.mode.start')} loading={busy} disabled={!myName.trim()}
              onPress={() => go(() => backend.createFamily(myName.trim(), myName.trim(), emoji, 'personal'))} />
          </View>
        </Card>
        {back}
        {isLocal && <Banner tone="warning" text={t('local.banner')} />}
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: 6, marginTop: 12 }}>
        <Txt v="h1">{t('onb.mode.group')}</Txt>
        <Txt muted>{t('onb.mode.groupBody')}</Txt>
      </View>
      <Segmented value={tab} onChange={setTab} options={[{ value: 'create', label: t('group.create') }, { value: 'join', label: t('family.join') }]} />
      <Card>
        <View style={{ gap: 14 }}>
          {tab === 'create' ? (
            <>
              <View style={{ gap: 8 }}>
                <Txt v="label" muted>{t('group.kind')}</Txt>
                <Row gap={8}>
                  {(['family', 'friends'] as const).map((k) => <Chip key={k} label={t(`group.kind.${k}` as StringKey)} selected={kind === k} onPress={() => setKind(k)} />)}
                </Row>
                {kind === 'friends' && <Txt v="caption" muted>{t('group.friendsNote')}</Txt>}
              </View>
              <Field label={t('group.name')} value={groupName} onChangeText={setGroupName} placeholder={t(`group.namePh.${kind}` as StringKey)} />
            </>
          ) : (
            <Field label={t('family.code')} value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" placeholder="AB12CD34" />
          )}
          <Field label={t('group.myName')} value={myName} onChangeText={setMyName} />
          {tab === 'join' && (
            <View style={{ gap: 8 }}>
              <Txt v="label" muted>{t('family.role')}</Txt>
              <Row gap={8} wrap>
                {(['adult', 'teen'] as MemberRole[]).map((r) => <Chip key={r} label={t(`role.${r}`)} selected={role === r} onPress={() => setRole(r)} />)}
              </Row>
            </View>
          )}
          <View style={{ gap: 8 }}>
            <Txt v="label" muted>{t('family.avatar')}</Txt>
            <AvatarPicker value={emoji} onChange={setEmoji} />
          </View>
          {error && <Txt v="caption" color={theme.danger}>{error}</Txt>}
          <Button
            title={tab === 'create' ? t('group.create') : t('family.join')}
            loading={busy}
            disabled={!myName.trim() || (tab === 'create' ? !groupName.trim() : code.trim().length < 6)}
            onPress={() => go(() => (tab === 'create' ? backend.createFamily(groupName.trim(), myName.trim(), emoji, kind) : backend.joinFamily(code, myName.trim(), role, emoji)))}
          />
        </View>
      </Card>
      {back}
      {isLocal && backend instanceof LocalBackend && (
        <View style={{ gap: 8, borderRadius: radius.lg }}>
          <Button kind="secondary" icon="people-outline" title={t('family.demo')} disabled={!myName.trim()} onPress={() => go(() => (backend as LocalBackend).seedDemoFamily(myName.trim()))} />
          <Txt v="caption" faint center>{t('family.demoHint')}</Txt>
          <Banner tone="warning" text={t('local.banner')} />
        </View>
      )}
    </Screen>
  );
}

function ModeCard({ icon, title, body, onPress }: { icon: IconName; title: string; body: string; onPress: () => void }) {
  const th = useApp().theme;
  return (
    <Card onPress={onPress}>
      <Row gap={14}>
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: th.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={24} color={th.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="h3">{title}</Txt>
          <Txt v="caption" muted>{body}</Txt>
        </View>
        <Icon name="chevron-forward" size={18} color={th.textMuted} flipRtl />
      </Row>
    </Card>
  );
}

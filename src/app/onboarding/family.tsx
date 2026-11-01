import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AvatarPicker } from '../../components/AvatarPicker';
import { backend, BackendError, isLocal } from '../../backend';
import { LocalBackend } from '../../backend/local';
import { Banner, Button, Card, Chip, Field, Row, Screen, Segmented, Txt } from '../../components/ui';
import { useI18n } from '../../i18n';
import type { MemberRole } from '../../lib/types';
import { useApp } from '../../state/app';
import { radius } from '../../theme';

export default function FamilySetup() {
  const { t } = useI18n();
  const { setMembership, theme } = useApp();
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [familyName, setFamilyName] = useState('');
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

  return (
    <Screen>
      <View style={{ gap: 6, marginTop: 12 }}>
        <Txt v="h1">{t('family.setupTitle')}</Txt>
        <Txt muted>{t('family.setupBody')}</Txt>
      </View>
      <Segmented value={tab} onChange={setTab} options={[{ value: 'create', label: t('family.create') }, { value: 'join', label: t('family.join') }]} />
      <Card>
        <View style={{ gap: 14 }}>
          {tab === 'create' ? (
            <Field label={t('family.name')} value={familyName} onChangeText={setFamilyName} placeholder="عائلة التميمي" />
          ) : (
            <Field label={t('family.code')} value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" placeholder="AB12CD34" />
          )}
          <Field label={t('family.myName')} value={myName} onChangeText={setMyName} />
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
            title={tab === 'create' ? t('family.create') : t('family.join')}
            loading={busy}
            disabled={!myName.trim() || (tab === 'create' ? !familyName.trim() : code.trim().length < 6)}
            onPress={() => go(() => (tab === 'create' ? backend.createFamily(familyName.trim(), myName.trim(), emoji) : backend.joinFamily(code, myName.trim(), role, emoji)))}
          />
        </View>
      </Card>
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

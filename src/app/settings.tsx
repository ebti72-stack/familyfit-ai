import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Switch, View } from 'react-native';
import { backend, isLocal } from '../backend';
import { Banner, Button, Card, Icon, IconButton, Row, Screen, Segmented, Sheet, Txt, type IconName } from '../components/ui';
import { useI18n } from '../i18n';
import { useApp } from '../state/app';

export default function Settings() {
  const { t, lang, setLang } = useI18n();
  const { membership, prefs, savePrefs, refreshFamily, theme: th } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const me = membership?.member;

  const Item = ({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) => (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Row gap={12} style={{ paddingVertical: 12 }}>
        <Icon name={icon} size={20} color={th.primary} />
        <Txt style={{ flex: 1 }}>{label}</Txt>
        <Icon name="chevron-forward" size={18} color={th.textFaint} flipRtl />
      </Row>
    </Pressable>
  );

  return (
    <Screen header={<Row gap={12} style={{ paddingHorizontal: 20, paddingTop: 8 }}><IconButton icon="chevron-back" flipRtl label={t('common.back')} onPress={() => router.back()} /><Txt v="h2">{t('settings.title')}</Txt></Row>}>
      <Card>
        <View style={{ gap: 14 }}>
          <Txt v="label" muted>{t('settings.language')}</Txt>
          <Segmented value={lang} onChange={(l) => setLang(l)} options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
          {Platform.OS !== 'web' && <Txt v="caption" faint>{t('settings.restartNote')}</Txt>}
          <Txt v="label" muted>{t('settings.theme')}</Txt>
          <Segmented value={prefs.theme} onChange={(v) => savePrefs({ theme: v })} options={(['system', 'light', 'dark'] as const).map((v) => ({ value: v, label: t(`settings.theme.${v}`) }))} />
        </View>
      </Card>

      <Card>
        <View>
          <Item icon="person-circle-outline" label={t('settings.profile')} onPress={() => router.push({ pathname: '/onboarding/profile', params: { edit: '1' } })} />
          <Item icon="speedometer-outline" label={t('settings.goals')} onPress={() => router.push({ pathname: '/goals', params: { memberId: me?.id } })} />
        </View>
      </Card>

      <Card>
        <View style={{ gap: 12 }}>
          <Row gap={8}><Icon name="lock-closed-outline" size={18} color={th.primary} /><Txt v="h3">{t('settings.privacy')}</Txt></Row>
          <Txt v="caption" muted>{t('settings.privacyBody')}</Txt>
          {me && me.role !== 'admin' && (
            <Row justify="space-between">
              <Txt style={{ flex: 1 }}>{t('settings.shareWithAdmin')}</Txt>
              <Switch value={me.shareHealthWithAdmin} onValueChange={async (v) => { await backend.updateMember(me.id, { shareHealthWithAdmin: v }); await refreshFamily(); }} trackColor={{ true: th.primary }} />
            </Row>
          )}
          <Row justify="space-between">
            <Txt v="caption" muted>{t('settings.dataMode')}</Txt>
            <Txt v="label">{isLocal ? t('settings.dataMode.local') : t('settings.dataMode.supabase')}</Txt>
          </Row>
          {isLocal && <Banner tone="warning" text={t('local.banner')} />}
        </View>
      </Card>

      <Button kind="secondary" icon="log-out-outline" title={t('settings.signOut')} onPress={async () => { await backend.signOut(); router.replace('/'); }} />
      <Button kind="danger" icon="trash-outline" title={t('settings.deleteData')} onPress={() => setConfirmDelete(true)} />
      <Txt v="caption" faint center>{t('settings.disclaimer')}</Txt>

      <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title={t('settings.deleteData')}>
        <Txt>{t('settings.deleteConfirm')}</Txt>
        <Button kind="danger" title={t('common.delete')} loading={busy} onPress={async () => { setBusy(true); try { await backend.deleteMyData(); router.replace('/'); } finally { setBusy(false); } }} />
        <Button kind="secondary" title={t('common.cancel')} onPress={() => setConfirmDelete(false)} />
      </Sheet>
    </Screen>
  );
}

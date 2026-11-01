import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '../components/Logo';
import { Button, Icon, Row, Txt, type IconName } from '../components/ui';
import { useI18n } from '../i18n';
import { useTheme } from '../state/app';
import { brand, radius } from '../theme';

export default function Welcome() {
  const { t, lang, setLang } = useI18n();
  const th = useTheme();
  const feature = (icon: IconName, text: string, color: string) => (
    <Row gap={12} style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: radius.md, padding: 14 }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={19} color={brand.forest} />
      </View>
      <View style={{ flex: 1 }}><Txt v="bodyStrong" color="#fff">{text}</Txt></View>
    </Row>
  );
  return (
    <LinearGradient colors={[brand.forest, '#1A5444']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 24 }}>
        <Row justify="space-between" style={{ marginTop: 8 }}>
          <Logo size={44} light />
          <Button small full={false} kind="onDark" title={lang === 'ar' ? 'English' : 'العربية'} onPress={() => setLang(lang === 'ar' ? 'en' : 'ar')} />
        </Row>
        <View style={{ flex: 1, justifyContent: 'center', gap: 14 }}>
          <Txt v="display" color="#fff">{t('welcome.title')}</Txt>
          <Txt v="body" color={brand.mint}>{t('welcome.body')}</Txt>
          <View style={{ gap: 10, marginTop: 18 }}>
            {feature('sparkles', t('welcome.f1'), brand.gold)}
            {feature('barcode-outline', t('welcome.f2'), brand.water)}
            {feature('trophy-outline', t('welcome.f3'), brand.coral)}
          </View>
        </View>
        <View style={{ gap: 10, paddingBottom: 16 }}>
          <Button kind="gold" title={t('welcome.start')} onPress={() => router.push('/auth?mode=up')} />
          <Button kind="onDark" title={t('welcome.haveAccount')} onPress={() => router.push('/auth?mode=in')} />
          <Txt v="caption" color={th.dark ? th.textMuted : 'rgba(232,243,236,0.7)'} center>{t('settings.disclaimer')}</Txt>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

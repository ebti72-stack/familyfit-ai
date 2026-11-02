import { Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { backend } from '../backend';
import { Logo } from '../components/Logo';
import { Txt } from '../components/ui';
import { useI18n } from '../i18n';
import { useApp } from '../state/app';
import { brand } from '../theme';

/** Splash screen + routing gate. */
export default function Index() {
  const { booting, session, membership } = useApp();
  const { t } = useI18n();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const scale = useRef(new Animated.Value(0.7)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: false, bounciness: 10 }),
      Animated.timing(fade, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
    const id = setTimeout(() => setMinTimePassed(true), 1100);
    return () => clearTimeout(id);
  }, [scale, fade]);

  useEffect(() => {
    if (!membership) return setHasProfile(null);
    backend.getHealthProfile(membership.member.id).then((p) => setHasProfile(!!p)).catch(() => setHasProfile(false));
  }, [membership]);

  const ready = !booting && minTimePassed && (!membership || hasProfile !== null);
  if (ready) {
    if (!session) return <Redirect href="/welcome" />;
    if (!membership) return <Redirect href="/onboarding/family" />;
    if (!hasProfile) return <Redirect href="/onboarding/profile" />;
    return <Redirect href="/(tabs)" />;
  }
  return (
    <View style={{ flex: 1, backgroundColor: brand.forest, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <Animated.View style={{ transform: [{ scale }], opacity: fade }}>
        <Logo size={96} light />
      </Animated.View>
      <Animated.View style={{ opacity: fade, alignItems: 'center', gap: 4 }}>
        <Txt v="h1" color="#fff" center>{t('app.name')}</Txt>
        <Txt v="body" color={brand.mint} center>{t('app.tagline')}</Txt>
      </Animated.View>
    </View>
  );
}

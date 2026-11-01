import {
  IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold, useFonts,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider, useI18n } from '../i18n';
import { AppProvider, useApp } from '../state/app';
import { brand } from '../theme';

function Shell() {
  const { theme } = useApp();
  const { ready } = useI18n();
  if (!ready) return <View style={{ flex: 1, backgroundColor: brand.forest }} />;
  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg }, animation: 'fade_from_bottom' }}>
        <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }} />
        <Stack.Screen name="next-meal" options={{ animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({ IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: brand.forest }} />;
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <AppProvider>
          <Shell />
        </AppProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}

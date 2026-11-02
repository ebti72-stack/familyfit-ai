import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router/tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic, Icon, Txt, type IconName } from '../../components/ui';
import { useI18n, type StringKey } from '../../i18n';
import { useApp } from '../../state/app';
import { brand, cardShadow, radius } from '../../theme';

const ITEMS: Record<string, { icon: IconName; active: IconName; label: StringKey }> = {
  index: { icon: 'home-outline', active: 'home', label: 'tab.home' },
  nutrition: { icon: 'nutrition-outline', active: 'nutrition', label: 'tab.nutrition' },
  ai: { icon: 'sparkles', active: 'sparkles', label: 'tab.ai' },
  activity: { icon: 'pulse-outline', active: 'pulse', label: 'tab.activity' },
  family: { icon: 'people-outline', active: 'people', label: 'tab.family' },
};

function TabBar({ state, navigation }: any) {
  const { theme: t, membership } = useApp();
  const { t: tr } = useI18n();
  const kind = membership?.family.kind ?? 'family';
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: 16, alignItems: 'center' }}>
      <View style={[{
        flexDirection: 'row', alignItems: 'center', backgroundColor: t.elevated, borderRadius: radius.xl, height: 68, paddingHorizontal: 8,
        width: '100%', maxWidth: 520, borderWidth: 1, borderColor: t.border,
      }, cardShadow(t, 2)]}>
        {state.routes.map((route: any, i: number) => {
          const base = ITEMS[route.name];
          if (!base) return null;
          // The group tab follows the space: "Me" for personal use, "Friends" or "Family" for groups.
          const item = route.name !== 'family' ? base
            : kind === 'personal' ? { icon: 'person-outline' as IconName, active: 'person' as IconName, label: 'tab.me' as StringKey }
            : kind === 'friends' ? { ...base, label: 'tab.friends' as StringKey } : base;
          const focused = state.index === i;
          const onPress = () => {
            haptic();
            const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
          };
          if (route.name === 'ai') {
            return (
              <Pressable key={route.key} onPress={onPress} accessibilityRole="button" accessibilityLabel={tr('ai.title')} style={{ flex: 1, alignItems: 'center' }}>
                <LinearGradient colors={[brand.green, brand.forest]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={[{ width: 62, height: 62, borderRadius: 31, marginTop: -30, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: t.bg }, cardShadow(t, 2)]}>
                  <Icon name="sparkles" size={26} color={brand.gold} />
                </LinearGradient>
                <Txt v="caption" color={focused ? t.primary : t.textMuted} center style={{ marginTop: 2, fontSize: 11 }}>{tr(item.label)}</Txt>
              </Pressable>
            );
          }
          return (
            <Pressable key={route.key} onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={tr(item.label)} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
              <View style={{ paddingHorizontal: 14, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: focused ? t.surfaceAlt : 'transparent' }}>
                <Icon name={focused ? item.active : item.icon} size={22} color={focused ? t.primary : t.textMuted} />
              </View>
              <Txt v="caption" color={focused ? t.primary : t.textMuted} center style={{ fontSize: 11 }}>{tr(item.label)}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const t = useApp().theme;
  return (
    <Tabs tabBar={(props: any) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.bg } } as any}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="nutrition" />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="activity" />
      <Tabs.Screen name="family" />
    </Tabs>
  );
}

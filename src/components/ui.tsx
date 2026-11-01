import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { useTheme } from '../state/app';
import { cardShadow, fonts, radius, type Theme } from '../theme';

export type IconName = keyof typeof Ionicons.glyphMap;

export function haptic(kind: 'light' | 'success' | 'warning' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  else Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------
type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodyStrong' | 'caption' | 'label' | 'number' | 'numberLg';
const VARIANTS: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 46 },
  h1: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 36 },
  h2: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 30 },
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 24 },
  caption: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 19 },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 20 },
  number: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24, fontVariant: ['tabular-nums'] },
  numberLg: { fontFamily: fonts.bold, fontSize: 40, lineHeight: 48, fontVariant: ['tabular-nums'] },
};

export function Txt({
  v = 'body', color, muted, faint, center, style, children, numberOfLines,
}: { v?: Variant; color?: string; muted?: boolean; faint?: boolean; center?: boolean; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number }) {
  const t = useTheme();
  const { rtl } = useI18n();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        VARIANTS[v],
        { color: color ?? (faint ? t.textFaint : muted ? t.textMuted : t.text), textAlign: center ? 'center' : rtl ? 'right' : 'left', writingDirection: rtl ? 'rtl' : 'ltr' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Icon({ name, size = 20, color, flipRtl }: { name: IconName; size?: number; color?: string; flipRtl?: boolean }) {
  const t = useTheme();
  const { rtl } = useI18n();
  return <Ionicons name={name} size={size} color={color ?? t.text} style={flipRtl && rtl ? { transform: [{ scaleX: -1 }] } : undefined} />;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
export function Screen({ children, scroll = true, padded = true, header, footer, contentStyle }: {
  children: ReactNode; scroll?: boolean; padded?: boolean; header?: ReactNode; footer?: ReactNode; contentStyle?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[{ paddingHorizontal: padded ? 20 : 0, paddingBottom: 140, paddingTop: 8, gap: 16 }, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingHorizontal: padded ? 20 : 0 }, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <View style={{ flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
        {header}
        {body}
        {footer}
      </View>
    </SafeAreaView>
  );
}

export function Row({ children, gap = 8, align = 'center', justify, style, wrap }: {
  children: ReactNode; gap?: number; align?: ViewStyle['alignItems']; justify?: ViewStyle['justifyContent']; style?: StyleProp<ViewStyle>; wrap?: boolean;
}) {
  return <View style={[{ flexDirection: 'row', alignItems: align, justifyContent: justify, gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Card({ children, style, onPress, tone = 'surface', padding = 18 }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tone?: 'surface' | 'alt' | 'deep' | 'transparent'; padding?: number;
}) {
  const t = useTheme();
  const bg = tone === 'alt' ? t.surfaceAlt : tone === 'deep' ? t.primaryDeep : tone === 'transparent' ? 'transparent' : t.surface;
  const inner = (
    <View style={[{ backgroundColor: bg, borderRadius: radius.lg, padding, borderWidth: tone === 'surface' ? StyleSheet.hairlineWidth : 0, borderColor: t.border }, tone === 'surface' && cardShadow(t), style]}>
      {children}
    </View>
  );
  if (!onPress) return inner;
  return <PressableScale onPress={onPress}>{inner}</PressableScale>;
}

/** Pressable with a subtle spring scale micro-interaction. */
export function PressableScale({ children, onPress, disabled, style, accessibilityLabel }: {
  children: ReactNode; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(s, { toValue: v, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 6 }).start();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      onPress={() => {
        haptic('light');
        onPress?.();
      }}
      onPressIn={() => to(0.97)}
      onPressOut={() => to(1)}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale: s }], opacity: disabled ? 0.5 : 1 }}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({ title, onPress, kind = 'primary', icon, loading, disabled, small, full = true }: {
  title: string; onPress?: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'gold' | 'danger' | 'onDark'; icon?: IconName; loading?: boolean; disabled?: boolean; small?: boolean; full?: boolean;
}) {
  const t = useTheme();
  const bg = { primary: t.primary, secondary: t.surfaceAlt, ghost: 'transparent', gold: t.gold, danger: 'transparent', onDark: 'rgba(255,255,255,0.10)' }[kind];
  const fg = { primary: t.onPrimary, secondary: t.dark ? t.text : t.primaryDeep, ghost: t.primary, gold: '#2B210B', danger: t.danger, onDark: '#FFFFFF' }[kind];
  return (
    <PressableScale onPress={onPress} disabled={disabled || loading} accessibilityLabel={title} style={full ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }}>
      <View style={{
        backgroundColor: bg, height: small ? 40 : 54, borderRadius: radius.pill, paddingHorizontal: small ? 16 : 22,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderWidth: kind === 'danger' ? 1 : 0, borderColor: t.danger,
      }}>
        {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={small ? 16 : 19} color={fg} /> : null}
        <Txt v={small ? 'label' : 'h3'} color={fg} center>{title}</Txt>
      </View>
    </PressableScale>
  );
}

export function IconButton({ icon, onPress, label, tone = 'surface', size = 44, flipRtl }: {
  icon: IconName; onPress?: () => void; label: string; tone?: 'surface' | 'alt' | 'clear' | 'dark'; size?: number; flipRtl?: boolean;
}) {
  const t = useTheme();
  const bg = tone === 'surface' ? t.surface : tone === 'alt' ? t.surfaceAlt : tone === 'dark' ? 'rgba(0,0,0,0.35)' : 'transparent';
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label}>
      <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, tone === 'surface' && cardShadow(t)]}>
        <Icon name={icon} size={size * 0.46} color={tone === 'dark' ? '#fff' : t.text} flipRtl={flipRtl} />
      </View>
    </PressableScale>
  );
}

export function Chip({ label, selected, onPress, icon, color }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; color?: string }) {
  const t = useTheme();
  const c = color ?? t.primary;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: radius.pill,
        backgroundColor: selected ? c : t.surface, borderWidth: 1, borderColor: selected ? c : t.border,
      }}>
        {icon && <Icon name={icon} size={15} color={selected ? '#fff' : t.textMuted} />}
        <Txt v="label" color={selected ? '#fff' : t.text}>{label}</Txt>
      </View>
    </PressableScale>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.surfaceAlt, borderRadius: radius.pill, padding: 4 }}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => { haptic(); onChange(o.value); }} style={{ flex: 1 }} accessibilityRole="tab" accessibilityState={{ selected: sel }}>
            <View style={[{ height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? t.surface : 'transparent' }, sel && cardShadow(t)]}>
              <Txt v="label" color={sel ? t.text : t.textMuted} center>{o.label}</Txt>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, hint, error, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const t = useTheme();
  const { rtl } = useI18n();
  return (
    <View style={{ gap: 6 }}>
      <Txt v="label" muted>{label}</Txt>
      <TextInput
        placeholderTextColor={t.textFaint}
        {...props}
        style={[{
          height: props.multiline ? 88 : 52, borderRadius: radius.md, backgroundColor: t.surface, borderWidth: 1, borderColor: error ? t.danger : t.border,
          paddingHorizontal: 16, paddingTop: props.multiline ? 12 : 0, color: t.text, fontFamily: fonts.regular, fontSize: 16,
          textAlign: props.keyboardType === 'email-address' || props.secureTextEntry ? (rtl ? 'right' : 'left') : rtl ? 'right' : 'left',
          writingDirection: rtl ? 'rtl' : 'ltr',
        } as TextStyle, props.style]}
      />
      {error ? <Txt v="caption" color={t.danger}>{error}</Txt> : hint ? <Txt v="caption" faint>{hint}</Txt> : null}
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const t = useTheme();
  return (
    <Row justify="space-between" style={{ marginTop: 8 }}>
      <Txt v="h2">{title}</Txt>
      {action ? <Pressable onPress={onAction}><Txt v="label" color={t.primary}>{action}</Txt></Pressable> : null}
    </Row>
  );
}

export function Banner({ text, tone = 'info', icon }: { text: string; tone?: 'info' | 'warning' | 'ai'; icon?: IconName }) {
  const t = useTheme();
  const bg = tone === 'warning' ? (t.dark ? '#3A2B12' : '#FBF1DE') : tone === 'ai' ? t.surfaceAlt : t.surfaceAlt;
  const fg = tone === 'warning' ? (t.dark ? t.gold : '#7A5716') : t.dark ? t.text : t.primaryDeep;
  return (
    <View style={{ flexDirection: 'row', gap: 10, backgroundColor: bg, padding: 14, borderRadius: radius.md, alignItems: 'flex-start' }}>
      <Icon name={icon ?? (tone === 'warning' ? 'information-circle' : tone === 'ai' ? 'sparkles' : 'shield-checkmark')} size={18} color={fg} />
      <View style={{ flex: 1 }}><Txt v="caption" color={fg}>{text}</Txt></View>
    </View>
  );
}

export function Skeleton({ height = 20, width = '100%', r = 10 }: { height?: number; width?: number | `${number}%`; r?: number }) {
  const t = useTheme();
  const o = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(o, { toValue: 0.5, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [o]);
  return <Animated.View style={{ height, width, borderRadius: r, backgroundColor: t.track, opacity: o }} />;
}

export function Avatar({ emoji, name, size = 44, ring }: { emoji?: string | null; name: string; size?: number; ring?: string }) {
  const t = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: ring ? 2.5 : 0, borderColor: ring }}>
      <Text style={{ fontSize: size * 0.48 }}>{emoji || name.trim().charAt(0) || '🙂'}</Text>
    </View>
  );
}

export function Pill({ text, color, bg, icon }: { text: string; color?: string; bg?: string; icon?: IconName }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 26, borderRadius: radius.pill, backgroundColor: bg ?? t.surfaceAlt, alignSelf: 'flex-start' }}>
      {icon && <Icon name={icon} size={13} color={color ?? t.primary} />}
      <Txt v="caption" color={color ?? (t.dark ? t.text : t.primaryDeep)} style={{ lineHeight: 18 }}>{text}</Txt>
    </View>
  );
}

/** Bottom sheet for details and quick actions. */
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(400)).current;
  useEffect(() => {
    if (visible) Animated.spring(y, { toValue: 0, useNativeDriver: Platform.OS !== 'web', bounciness: 4, speed: 14 }).start();
    else y.setValue(400);
  }, [visible, y]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(8,20,16,0.45)' }} onPress={onClose} accessibilityLabel="close" />
      <Animated.View style={{
        transform: [{ translateY: y }], backgroundColor: t.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
        paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 20, maxHeight: '88%', width: '100%', maxWidth: 720, alignSelf: 'center',
      }}>
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: t.track, marginBottom: 14 }} />
        {title ? <Txt v="h2" style={{ marginBottom: 12 }}>{title}</Txt> : null}
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>{children}</ScrollView>
      </Animated.View>
    </Modal>
  );
}

/** Transient confirmation toast. */
export function Toast({ text, visible }: { text: string; visible: boolean }) {
  const t = useTheme();
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(o, { toValue: visible ? 1 : 0, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [visible, o]);
  return (
    <Animated.View pointerEvents="none" style={{
      position: 'absolute', bottom: 110, alignSelf: 'center', opacity: o, transform: [{ translateY: o.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      backgroundColor: t.primaryDeep, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill, flexDirection: 'row', gap: 8, alignItems: 'center',
    }}>
      <Icon name="checkmark-circle" size={18} color={t.gold} />
      <Txt v="label" color="#fff">{text}</Txt>
    </Animated.View>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <Card tone="alt">
      <Txt v="body" center>{t('common.error')}</Txt>
      {onRetry && <View style={{ marginTop: 12 }}><Button small title={t('common.retry')} kind="secondary" onPress={onRetry} /></View>}
    </Card>
  );
}

export const styles = (t: Theme) => ({ divider: { height: StyleSheet.hairlineWidth, backgroundColor: t.border } });

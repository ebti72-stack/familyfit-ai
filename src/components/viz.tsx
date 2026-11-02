import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useI18n } from '../i18n';
import { useTheme } from '../state/app';
import { radius } from '../theme';
import { Row, Txt } from './ui';

/** Animate a number from its previous value to the new one. */
export function useAnimatedNumber(target: number, duration = 700) {
  const [v, setV] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const id = anim.addListener(({ value }) => setV(value));
    Animated.timing(anim, { toValue: target, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [target, duration, anim]);
  return v;
}

/** Circular progress. RTL-aware: progress runs clockwise in LTR and counter-clockwise in RTL. */
export function Ring({ size = 120, stroke = 12, progress, color, gradientTo, track, children }: {
  size?: number; stroke?: number; progress: number; color: string; gradientTo?: string; track?: string; children?: ReactNode;
}) {
  const t = useTheme();
  const { rtl } = useI18n();
  const p = useAnimatedNumber(Math.max(0, Math.min(1, progress)));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const id = `g${color.replace('#', '')}${size}`;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }, ...(rtl ? [{ scaleY: -1 }] : [])] }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} />
            <Stop offset="1" stopColor={gradientTo ?? color} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? t.track} strokeWidth={stroke} fill="none" />
        {p > 0.001 && (
          <Circle
            cx={size / 2} cy={size / 2} r={r} stroke={`url(#${id})`} strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - p)}
          />
        )}
      </Svg>
      {children}
    </View>
  );
}

/** Horizontal macro bar with consumed / goal. Direction follows the reading direction. */
export function MacroBar({ label, consumed, goal, color, unit = 'g', limit }: { label: string; consumed: number; goal: number; color: string; unit?: string; limit?: boolean }) {
  const t = useTheme();
  const { n, t: tr } = useI18n();
  const ratio = goal > 0 ? consumed / goal : 0;
  const w = useAnimatedNumber(Math.min(1, ratio));
  const over = ratio > 1;
  return (
    <View style={{ gap: 6 }}>
      <Row justify="space-between">
        <Row gap={6}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
          <Txt v="label">{label}</Txt>
        </Row>
        <Txt v="label" muted>
          <Txt v="label" color={over && limit ? t.danger : t.text}>{n(consumed)}</Txt> / {n(goal)} {unit}{limit ? ` · ${tr('nut.limit')}` : ''}
        </Txt>
      </Row>
      <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: t.track, overflow: 'hidden', flexDirection: 'row' }}>
        <View style={{ width: `${w * 100}%`, backgroundColor: over && limit ? t.danger : color, borderRadius: radius.pill }} />
      </View>
    </View>
  );
}

/** Compact macro chip used inside meal and product cards. */
export function MacroTriplet({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const t = useTheme();
  const { n, t: tr } = useI18n();
  const item = (label: string, v: number, c: string) => (
    <View style={{ flex: 1, gap: 2 }}>
      <Row gap={5}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
        <Txt v="caption" muted>{label}</Txt>
      </Row>
      <Txt v="number">{n(v)}<Txt v="caption" muted> {tr('common.g')}</Txt></Txt>
    </View>
  );
  return (
    <Row gap={10}>
      {item(tr('macro.protein'), protein, t.protein)}
      {item(tr('macro.carbs'), carbs, t.carbs)}
      {item(tr('macro.fat'), fat, t.fat)}
    </Row>
  );
}

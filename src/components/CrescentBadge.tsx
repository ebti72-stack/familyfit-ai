import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { brand } from '../theme';

/** Five-point star path centred on (cx, cy). */
function star(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(`${(cx + rr * Math.cos(rad)).toFixed(2)},${(cy + rr * Math.sin(rad)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

/** Crescent = outer circle minus an offset inner circle, as one path through their two intersection points. */
function crescent(cx: number, cy: number, R: number, ox: number, oy: number, r: number): string {
  const dx = ox - cx;
  const dy = oy - cy;
  const d = Math.hypot(dx, dy);
  const a = (R * R - r * r + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, R * R - a * a));
  const mx = cx + (a * dx) / d;
  const my = cy + (a * dy) / d;
  const p1 = [mx + (h * dy) / d, my - (h * dx) / d];
  const p2 = [mx - (h * dy) / d, my + (h * dx) / d];
  const f = (p: number[]) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
  return `M${f(p1)} A${R},${R} 0 1,0 ${f(p2)} A${r},${r} 0 1,1 ${f(p1)} Z`;
}

/**
 * The premium "three days every month" badge: a calm crescent with three stars, gold on deep forest green.
 * Locked state is drawn in muted tones (never shown as earned).
 */
export function CrescentBadge({ size = 96, earned = true }: { size?: number; earned?: boolean }) {
  const gold1 = earned ? '#F2D597' : '#C9CFCB';
  const gold2 = earned ? brand.gold : '#9AA39E';
  const bg1 = earned ? '#1B5646' : '#5E6A64';
  const bg2 = earned ? brand.forest : '#3E4843';
  const id = earned ? 'cb' : 'cbl';
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={gold1} />
          <Stop offset="1" stopColor={gold2} />
        </LinearGradient>
        <LinearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={bg1} />
          <Stop offset="1" stopColor={bg2} />
        </LinearGradient>
      </Defs>
      <Circle cx={50} cy={50} r={48} fill={`url(#${id}b)`} />
      <Circle cx={50} cy={50} r={44} fill="none" stroke={`url(#${id}g)`} strokeWidth={1.6} />
      <Circle cx={50} cy={50} r={40.5} fill="none" stroke={gold2} strokeOpacity={0.35} strokeWidth={0.8} />
      <Path d={crescent(45, 51, 25, 56, 44, 21)} fill={`url(#${id}g)`} />
      <Path d={star(66, 40, 5.2)} fill={`url(#${id}g)`} />
      <Path d={star(74, 53, 3.8)} fill={`url(#${id}g)`} />
      <Path d={star(65, 64, 3.2)} fill={`url(#${id}g)`} />
    </Svg>
  );
}

/** Small round badge for the other fasting achievements (Ionicons glyph on a soft disc is rendered by the caller). */
export function MiniCrescent({ size = 22, color = brand.gold }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d={crescent(45, 51, 36, 60, 42, 30)} fill={color} />
      <Path d={star(74, 34, 9)} fill={color} />
    </Svg>
  );
}

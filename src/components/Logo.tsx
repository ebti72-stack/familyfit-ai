import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { brand } from '../theme';

/** FamilyFit AI mark: two leaves forming a heart-shaped family embrace, with a gold "spark". */
export function Logo({ size = 72, light = false }: { size?: number; light?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={light ? '#FFFFFF' : brand.green} />
          <Stop offset="1" stopColor={light ? brand.mint : brand.forest} />
        </LinearGradient>
      </Defs>
      <Path d="M32 54 C 14 44, 6 32, 10 21 C 13 13, 23 11, 30 18 C 31 19, 31.6 20, 32 21 Z" fill="url(#lg1)" />
      <Path d="M32 54 C 50 44, 58 32, 54 21 C 51 13, 41 11, 34 18 C 33 19, 32.4 20, 32 21 Z" fill="url(#lg1)" opacity={0.78} />
      <Path d="M32 50 L 32 24" stroke={light ? brand.forest : brand.mint} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
      <Circle cx="47" cy="12" r="5" fill={brand.gold} />
    </Svg>
  );
}

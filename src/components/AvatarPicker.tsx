import { Pressable, Text, View } from 'react-native';
import { useApp } from '../state/app';
import { Row } from './ui';

export const AVATARS = ['👩', '👨', '👧', '👦', '👵', '👴', '🧕', '🧔', '👶', '🦁', '🐢', '🌟'];

export function AvatarPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { theme } = useApp();
  return (
    <Row wrap gap={8}>
      {AVATARS.map((a) => (
        <Pressable key={a} onPress={() => onChange(a)} accessibilityLabel={a}>
          <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: value === a ? theme.surfaceAlt : theme.surface, borderWidth: 2, borderColor: value === a ? theme.primary : theme.border }}>
            <Text style={{ fontSize: 22 }}>{a}</Text>
          </View>
        </Pressable>
      ))}
    </Row>
  );
}


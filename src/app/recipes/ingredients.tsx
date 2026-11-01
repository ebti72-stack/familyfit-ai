import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { backend } from '../../backend';
import { CheckRow, TopBar } from '../../components/recipe';
import { Banner, Card, Chip, Icon, Row, Screen, Txt } from '../../components/ui';
import { FOODS } from '../../data/foods';
import { useI18n, type StringKey } from '../../i18n';
import { useApp } from '../../state/app';
import { useRecipeLibrary } from '../../state/recipes';
import { useDay } from '../../state/useDay';
import { fonts, radius } from '../../theme';

const CATS = ['protein', 'grain', 'dairy', 'vegetable', 'fruit', 'legume', 'nuts', 'fat'] as const;

export default function FavoriteIngredients() {
  const { t, lang, rtl } = useI18n();
  const { viewingMember, bump, theme: th } = useApp();
  const lib = useRecipeLibrary();
  const day = useDay(viewingMember?.id);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const allergies = day.profile?.allergies ?? [];

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return Object.values(FOODS)
      .filter((f) => f.category !== 'condiment' && f.category !== 'sweet')
      .filter((f) => !f.allergens.some((a) => allergies.includes(a)))
      .filter((f) => (!cat || f.category === cat) && (!s || f.ar.includes(s) || f.en.toLowerCase().includes(s)))
      .sort((a, b) => Number(lib.favIngredients.includes(b.id)) - Number(lib.favIngredients.includes(a.id)));
  }, [q, cat, allergies, lib.favIngredients]);

  const toggle = async (id: string) => {
    if (!viewingMember) return;
    await backend.setFavoriteIngredient(viewingMember.id, id, !lib.favIngredients.includes(id));
    bump();
  };

  return (
    <Screen header={<TopBar title={t('rec.favIngredients')} subtitle={viewingMember?.displayName} />}>
      <Banner text={t('rec.favIngredientsHint')} icon="heart-outline" />
      <Row gap={8} style={{ backgroundColor: th.surface, borderRadius: radius.pill, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: th.border }}>
        <Icon name="search" size={17} color={th.textFaint} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('rec.ingredientsSearch')} placeholderTextColor={th.textFaint} style={{ flex: 1, color: th.text, fontFamily: fonts.regular, fontSize: 15, textAlign: rtl ? 'right' : 'left' }} />
      </Row>
      <Row gap={6} wrap>
        <Chip label={t('rec.all')} selected={!cat} onPress={() => setCat(null)} />
        {CATS.map((c) => <Chip key={c} label={t(`cat.${c}` as StringKey)} selected={cat === c} onPress={() => setCat(c)} />)}
      </Row>
      <Card padding={8}>
        {list.map((f) => (
          <View key={f.id} style={{ paddingHorizontal: 8 }}>
            <CheckRow label={f[lang]} checked={lib.favIngredients.includes(f.id)} onPress={() => toggle(f.id)} />
          </View>
        ))}
      </Card>
      <Txt v="caption" faint>{t('rec.favFirstRules')}</Txt>
    </Screen>
  );
}

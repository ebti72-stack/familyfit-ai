import { router } from 'expo-router';
import { Switch, View } from 'react-native';
import { TopBar } from '../../components/recipe';
import { Banner, Button, Card, Row, Screen, Txt } from '../../components/ui';
import { useI18n } from '../../i18n';
import { useApp } from '../../state/app';
import { useRecipeLibrary } from '../../state/recipes';

export default function FavoritesPreferences() {
  const { t, n } = useI18n();
  const { prefs, savePrefs, theme: th } = useApp();
  const lib = useRecipeLibrary();
  const liked = lib.myRatings.filter((r) => r.stars >= 4).length;

  return (
    <Screen header={<TopBar title={t('rec.prefsTitle')} />}>
      <Card>
        <View style={{ gap: 10 }}>
          <Row justify="space-between">
            <Txt v="h3" style={{ flex: 1 }}>{t('rec.favFirst')}</Txt>
            <Switch value={prefs.favoritesFirst} onValueChange={(v) => savePrefs({ favoritesFirst: v })} trackColor={{ true: th.primary }} />
          </Row>
          <Txt v="caption" muted>{t('rec.favFirstBody')}</Txt>
        </View>
      </Card>
      <Row gap={10}>
        {[[t('rec.tab.favorites'), lib.favorites.length], [t('rec.favIngredients'), lib.favIngredients.length], ['★ 4+', liked]].map(([l, v]) => (
          <Card key={String(l)} style={{ flex: 1 }} padding={12}>
            <Txt v="caption" muted numberOfLines={1}>{l}</Txt>
            <Txt v="number">{n(Number(v))}</Txt>
          </Card>
        ))}
      </Row>
      <Banner text={t('rec.favFirstRules')} icon="shield-checkmark-outline" />
      <Button kind="secondary" icon="nutrition-outline" title={t('rec.favIngredients')} onPress={() => router.push('/recipes/ingredients')} />
      <Button icon="restaurant-outline" title={t('ai.nextMeal')} onPress={() => router.push('/next-meal')} />
    </Screen>
  );
}

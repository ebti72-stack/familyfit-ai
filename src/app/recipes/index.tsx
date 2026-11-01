import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { RecipeTile, TopBar } from '../../components/recipe';
import { Card, Chip, ErrorState, Icon, PressableScale, Row, Screen, Segmented, Skeleton, Txt } from '../../components/ui';
import { useI18n, type StringKey } from '../../i18n';
import { computeRecipeNutrition, type UserRecipe } from '../../lib/recipe';
import { useApp } from '../../state/app';
import { builtinRecipes, FOLDERS, useRecipeLibrary } from '../../state/recipes';
import { brand, fonts, radius } from '../../theme';

type Tab = 'favorites' | 'mine' | 'family' | 'builtin';

export default function Library() {
  const { t, lang, rtl } = useI18n();
  const th = useApp().theme;
  const lib = useRecipeLibrary();
  const [tab, setTab] = useState<Tab>('favorites');
  const [folder, setFolder] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const favRefs = useMemo(() => new Set(lib.favorites.map((f) => f.ref)), [lib.favorites]);
  const list: UserRecipe[] = useMemo(() => {
    let out: UserRecipe[] = [];
    if (tab === 'favorites') {
      out = lib.favorites.filter((f) => !folder || f.folders.includes(folder)).map((f) => lib.resolve(f.ref)).filter((x): x is UserRecipe => !!x);
    } else if (tab === 'mine') out = lib.recipes.filter((r) => r.ownerMemberId === lib.memberId);
    else if (tab === 'family') out = lib.recipes.filter((r) => r.ownerMemberId !== lib.memberId && r.sharedWithFamily);
    else out = builtinRecipes(lang);
    const s = q.trim().toLowerCase();
    return s ? out.filter((r) => r.title.toLowerCase().includes(s)) : out;
  }, [tab, folder, q, lib, lang]);

  return (
    <Screen header={<TopBar title={t('rec.library')} subtitle={t('rec.librarySub')} />}>
      <PressableScale onPress={() => router.push('/recipes/import')} accessibilityLabel={t('rec.analyzeCta')}>
        <View style={{ backgroundColor: brand.gold, borderRadius: radius.lg, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: brand.forest, alignItems: 'center', justifyContent: 'center' }}><Icon name="videocam" size={22} color={brand.gold} /></View>
          <View style={{ flex: 1 }}>
            <Txt v="h3" color={brand.forest}>{t('rec.analyzeCta')}</Txt>
            <Txt v="caption" color="#4A3A12">{t('rec.analyzeCtaBody')}</Txt>
          </View>
          <Icon name="arrow-forward" size={20} color={brand.forest} flipRtl />
        </View>
      </PressableScale>

      <Row gap={10}>
        <View style={{ flex: 1 }}>
          <Card padding={12} onPress={() => router.push('/recipes/ingredients')}>
            <Row gap={8}><Icon name="nutrition-outline" size={18} color={th.coral} /><Txt v="label" style={{ flex: 1 }} numberOfLines={1}>{t('rec.favIngredients')}</Txt></Row>
          </Card>
        </View>
        <View style={{ flex: 1 }}>
          <Card padding={12} onPress={() => router.push('/recipes/preferences')}>
            <Row gap={8}><Icon name="heart-circle-outline" size={18} color={th.primary} /><Txt v="label" style={{ flex: 1 }} numberOfLines={1}>{t('rec.prefsTitle')}</Txt></Row>
          </Card>
        </View>
      </Row>

      <Segmented value={tab} onChange={(v) => { setTab(v); setFolder(null); }} options={[
        { value: 'favorites', label: t('rec.tab.favorites') }, { value: 'mine', label: t('rec.tab.mine') }, { value: 'family', label: t('rec.tab.family') }, { value: 'builtin', label: 'FamilyFit' },
      ]} />

      <Row gap={8} style={{ backgroundColor: th.surface, borderRadius: radius.pill, paddingHorizontal: 14, height: 44, borderWidth: 1, borderColor: th.border }}>
        <Icon name="search" size={17} color={th.textFaint} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('common.search')} placeholderTextColor={th.textFaint} style={{ flex: 1, color: th.text, fontFamily: fonts.regular, fontSize: 15, textAlign: rtl ? 'right' : 'left' }} />
      </Row>

      {tab === 'favorites' && (
        <Row gap={8} wrap>
          <Chip label={t('rec.all')} selected={!folder} onPress={() => setFolder(null)} />
          {FOLDERS.map((f) => <Chip key={f} label={t(`rec.folder.${f}` as StringKey)} selected={folder === f} onPress={() => setFolder(f)} />)}
        </Row>
      )}

      {lib.error ? <ErrorState onRetry={lib.reload} /> : lib.loading ? <View style={{ gap: 10 }}><Skeleton height={86} r={20} /><Skeleton height={86} r={20} /></View> : list.length === 0 ? (
        <Card tone="alt"><Txt muted center>{tab === 'favorites' ? t('rec.empty.favorites') : tab === 'mine' ? t('rec.empty.mine') : tab === 'family' ? t('rec.empty.family') : t('common.error')}</Txt></Card>
      ) : (
        list.map((r) => (
          <RecipeTile key={r.id} r={r} kcal={computeRecipeNutrition(r).perServing.kcal} fav={favRefs.has(r.id)} onPress={() => router.push({ pathname: '/recipes/[id]', params: { id: r.id } })} />
        ))
      )}
    </Screen>
  );
}

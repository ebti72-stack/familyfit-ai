import { useCallback, useEffect, useState } from 'react';
import { backend, type FavoriteRecipe, type RecipeRating } from '../backend';
import { RECIPES } from '../data/recipes';
import { useI18n } from '../i18n';
import { localDate } from '../lib/dates';
import { BUILTIN_PREFIX, builtinAsUserRecipe, findBuiltin, isBuiltinRef, type DocLang, type UserRecipe } from '../lib/recipe';
import { offlineTranslation, type RecipeTranslation } from '../lib/recipeDoc';
import { useApp } from './app';

export function emptyRecipe(ownerMemberId: string, familyId: string, lang: 'ar' | 'en', patch: Partial<UserRecipe> = {}): UserRecipe {
  return {
    id: '', ownerMemberId, familyId, parentId: null, versionKind: 'original', lang, title: '', description: '', emoji: '🍽️', imageUri: null,
    sourceKind: 'manual', sourceUrl: null, sourcePlatform: null, servings: 2, prepMinutes: null, cookMinutes: null, difficulty: null,
    cookingMethod: 'none', ingredients: [], steps: [], tools: [], notes: '', servingTip: '', finalWeightG: null, mealTypes: [],
    sharedWithFamily: false, createdAt: '', updatedAt: '', ...patch,
  };
}

export function builtinRecipes(lang: 'ar' | 'en'): UserRecipe[] {
  return RECIPES.map((r) => builtinAsUserRecipe(r, lang));
}

/** Everything the library needs for the member being viewed. */
export function useRecipeLibrary() {
  const { membership, viewingMember, version } = useApp();
  const { lang } = useI18n();
  const memberId = viewingMember?.id;
  const familyId = membership?.family.id;
  const [state, setState] = useState<{ loading: boolean; error: string | null; recipes: UserRecipe[]; favorites: FavoriteRecipe[]; favIngredients: string[]; myRatings: RecipeRating[] }>(
    { loading: true, error: null, recipes: [], favorites: [], favIngredients: [], myRatings: [] },
  );

  const load = useCallback(async () => {
    if (!memberId || !familyId) return;
    try {
      const [recipes, favorites, favIngredients, myRatings] = await Promise.all([
        backend.listRecipes(familyId), backend.listFavoriteRecipes(memberId), backend.listFavoriteIngredients(memberId), backend.listMyRatings(memberId),
      ]);
      setState({ loading: false, error: null, recipes, favorites, favIngredients, myRatings });
    } catch (e: any) {
      setState((s) => ({ ...s, loading: false, error: e?.message ?? 'error' }));
    }
  }, [memberId, familyId]);

  useEffect(() => {
    load();
  }, [load, version]);

  const resolve = useCallback(
    (ref: string): UserRecipe | null => {
      if (isBuiltinRef(ref)) {
        const b = findBuiltin(ref);
        return b ? builtinAsUserRecipe(b, lang) : null;
      }
      return state.recipes.find((r) => r.id === ref) ?? null;
    },
    [state.recipes, lang],
  );

  return { ...state, memberId, familyId, resolve, reload: load };
}

/** One recipe (built-in or user) plus this member's favourite entry. */
export function useRecipe(ref: string | undefined) {
  const { viewingMember, version } = useApp();
  const { lang } = useI18n();
  const [state, setState] = useState<{ loading: boolean; recipe: UserRecipe | null; parent: UserRecipe | null; fav: FavoriteRecipe | null }>({ loading: true, recipe: null, parent: null, fav: null });

  const load = useCallback(async () => {
    if (!ref || !viewingMember) return;
    try {
      let recipe: UserRecipe | null = null;
      if (isBuiltinRef(ref)) {
        const b = findBuiltin(ref);
        recipe = b ? builtinAsUserRecipe(b, lang) : null;
      } else recipe = await backend.getRecipe(ref);
      let parent: UserRecipe | null = null;
      if (recipe?.parentId) parent = isBuiltinRef(recipe.parentId) ? builtinAsUserRecipe(findBuiltin(recipe.parentId)!, lang) : await backend.getRecipe(recipe.parentId);
      const favs = await backend.listFavoriteRecipes(viewingMember.id);
      setState({ loading: false, recipe, parent, fav: favs.find((f) => f.ref === ref) ?? null });
    } catch {
      setState({ loading: false, recipe: null, parent: null, fav: null });
    }
  }, [ref, viewingMember, lang]);

  useEffect(() => {
    load();
  }, [load, version]);
  return { ...state, reload: load };
}

/** Built-in recipes are stored under their own id; user recipes need a copy before they can be edited. */
export function editableCopy(r: UserRecipe, ownerMemberId: string, familyId: string): UserRecipe {
  if (!r.id.startsWith(BUILTIN_PREFIX)) return r;
  return { ...r, id: '', ownerMemberId, familyId, sourceKind: 'manual', parentId: null, createdAt: localDate(), updatedAt: localDate() };
}

export const FOLDERS = ['breakfast', 'lunch', 'dinner', 'suhoor', 'iftar', 'high_protein', 'snacks', 'kids', 'healthy', 'quick', 'family', 'mine'] as const;

/** Saved translation for this member, else the best offline translation. */
export function useTranslation(r: UserRecipe | null, lang: DocLang) {
  const { viewingMember, version } = useApp();
  const [tr, setTr] = useState<RecipeTranslation | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!r || !viewingMember) return;
    let alive = true;
    backend.getTranslation(viewingMember.id, r.id, lang)
      .then((x) => { if (alive) { setTr(x ?? offlineTranslation(r, lang)); setSaved(!!x); } })
      .catch(() => { if (alive) { setTr(offlineTranslation(r, lang)); setSaved(false); } });
    return () => { alive = false; };
  }, [r, lang, viewingMember, version]);
  return { tr, setTr, saved };
}

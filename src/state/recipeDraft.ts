/**
 * Hand-off between the import screens and the review screen (in memory only; nothing is saved until
 * the user confirms the review).
 */
import type { UserRecipe } from '../lib/recipe';

export interface RecipeDraft {
  recipe: UserRecipe;
  sourceText: string | null;
  alternatives: string[];
  /** Message from the analysis (e.g. what could not be read). */
  message: string | null;
}

let draft: RecipeDraft | null = null;
export const setDraft = (d: RecipeDraft | null) => {
  draft = d;
};
export const getDraft = () => draft;

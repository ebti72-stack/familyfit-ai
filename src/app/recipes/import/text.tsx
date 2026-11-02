import { router } from 'expo-router';
import { useState } from 'react';
import { TopBar } from '../../../components/recipe';
import { Banner, Button, Field, Screen } from '../../../components/ui';
import { useI18n } from '../../../i18n';
import { applyParsed, captionToText, parseRecipeText } from '../../../lib/importFlow';
import { useApp } from '../../../state/app';
import { setDraft } from '../../../state/recipeDraft';
import { emptyRecipe } from '../../../state/recipes';

export default function ImportText() {
  const { t, lang } = useI18n();
  const { viewingMember, membership } = useApp();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const go = () => {
    if (!viewingMember || !membership) return;
    const parsed = parseRecipeText(text.includes('\n') ? text : captionToText(text));
    if (!parsed.ingredients.length && !parsed.steps.length) return setError(t('imp.noRecipe'));
    const base = emptyRecipe(viewingMember.id, membership.family.id, lang, { sourceKind: 'text' });
    setDraft({ recipe: applyParsed(base, parsed), sourceText: text, alternatives: [], message: null });
    router.replace('/recipes/review');
  };

  return (
    <Screen header={<TopBar title={t('imp.text')} subtitle={t('imp.textBody')} />}>
      <Field label={t('imp.text')} placeholder={t('imp.textPlaceholder')} value={text} onChangeText={(v) => { setText(v); setError(null); }} multiline style={{ height: 320, textAlignVertical: 'top' }} />
      {error && <Banner tone="warning" text={error} />}
      <Button icon="sparkles" title={t('imp.analyze')} disabled={!text.trim()} onPress={go} />
    </Screen>
  );
}

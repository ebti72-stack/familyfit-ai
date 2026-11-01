import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { FOODS } from '../data/foods';
import type { Unit } from '../data/recipeLexicon';
import { useI18n, type StringKey } from '../i18n';
import type { RecipeIngredientLine } from '../lib/recipe';
import { matchFood, updateLine } from '../lib/recipeParser';
import { useApp } from '../state/app';
import { radius } from '../theme';
import { Button, Chip, Field, Icon, Row, Sheet, Txt } from './ui';

const UNITS: Unit[] = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup', 'piece', 'clove', 'slice', 'can', 'pinch', 'handful'];

export function blankLine(): RecipeIngredientLine {
  return { raw: '', name: '', foodId: null, qty: null, unit: null, grams: null, confidence: 'low', estimated: false, toTaste: false, confirmed: false };
}

/** Edit one ingredient: database match, quantity + unit (converted to grams by the same tables as the parser), or exact grams. */
export function IngredientEditor({ line, visible, onClose, onSave, onRemove }: {
  line: RecipeIngredientLine | null; visible: boolean; onClose: () => void; onSave: (l: RecipeIngredientLine) => void; onRemove?: () => void;
}) {
  const { t, n, lang } = useI18n();
  const th = useApp().theme;
  const [name, setName] = useState('');
  const [foodId, setFoodId] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<Unit | null>(null);
  const [grams, setGrams] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!line) return;
    setName(line.name);
    setFoodId(line.foodId);
    setQty(line.qty != null ? String(line.qty) : '');
    setUnit(line.unit);
    setGrams(line.unit === 'g' && line.qty != null ? String(line.qty) : '');
    setQ('');
  }, [line]);

  const results = useMemo(() => {
    const s = (q || name).trim().toLowerCase();
    const guess = s ? matchFood(s) : null;
    const list = Object.values(FOODS).filter((f) => !s || f.ar.includes(s) || f.en.toLowerCase().includes(s) || f.id.includes(s));
    const ids = [guess, ...list.map((f) => f.id)].filter((x, i, a): x is string => !!x && a.indexOf(x) === i);
    return ids.slice(0, 8);
  }, [q, name]);

  if (!line) return null;
  const num = (s: string) => {
    const v = parseFloat(s.replace(',', '.').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const preview = updateLine({ ...line, name }, { foodId, qty: num(qty), unit: unit ?? (num(qty) ? 'piece' : null), ...(num(grams) ? { grams: num(grams)! } : {}) });

  return (
    <Sheet visible={visible} onClose={onClose} title={t('rev.edit')}>
      {line.raw ? <Txt v="caption" faint>{t('rev.sourceText')}: {line.raw}</Txt> : null}
      <Field label={t('rev.recipeName')} value={name} onChangeText={setName} />
      <Field label={t('rev.match')} value={q} onChangeText={setQ} placeholder={t('rec.ingredientsSearch')} />
      <View style={{ gap: 6 }}>
        {results.map((id) => (
          <Pressable key={id} onPress={() => { setFoodId(id); if (!name) setName(FOODS[id][lang]); }}>
            <Row gap={10} style={{ padding: 10, borderRadius: radius.md, backgroundColor: foodId === id ? th.surfaceAlt : 'transparent', borderWidth: 1, borderColor: foodId === id ? th.primary : th.border }}>
              <Icon name={foodId === id ? 'radio-button-on' : 'radio-button-off'} size={18} color={th.primary} />
              <Txt style={{ flex: 1 }}>{FOODS[id][lang]}</Txt>
              <Txt v="caption" muted>{n(FOODS[id].per100.kcal)} {t('common.kcal')}/100{t('common.g')}</Txt>
            </Row>
          </Pressable>
        ))}
      </View>
      <Row gap={10}>
        <View style={{ flex: 1 }}><Field label={t('rev.qty')} value={qty} onChangeText={(v) => { setQty(v); setGrams(''); }} keyboardType="decimal-pad" /></View>
        <View style={{ flex: 1 }}><Field label={t('rev.grams')} value={grams} onChangeText={setGrams} keyboardType="decimal-pad" /></View>
      </Row>
      <Txt v="label" muted>{t('rev.unit')}</Txt>
      <Row gap={6} wrap>
        {UNITS.map((u) => <Chip key={u} label={t(`rev.unit.${u}` as StringKey)} selected={unit === u} onPress={() => { setUnit(u); setGrams(''); }} />)}
      </Row>
      <Txt v="caption" muted>
        {preview.grams != null && preview.foodId ? `≈ ${n(preview.grams)} ${t('common.g')} · ${n((FOODS[preview.foodId].per100.kcal * preview.grams) / 100)} ${t('common.kcal')}` : t('rev.needsQty')}
      </Txt>
      <Button title={t('rev.confirmLine')} icon="checkmark" disabled={!name.trim()} onPress={() => onSave({ ...preview, raw: line.raw || [qty, unit ? t(`rev.unit.${unit}` as StringKey) : '', name].filter(Boolean).join(' ') })} />
      {onRemove && <Button kind="danger" title={t('rev.remove')} onPress={onRemove} />}
    </Sheet>
  );
}

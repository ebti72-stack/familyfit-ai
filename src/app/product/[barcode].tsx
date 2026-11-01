import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { backend } from '../../backend';
import { Banner, Button, Card, Chip, Field, Icon, IconButton, Pill, Row, Screen, Skeleton, Toast, Txt } from '../../components/ui';
import { MacroTriplet } from '../../components/viz';
import { useI18n, type StringKey } from '../../i18n';
import { localDate, uid } from '../../lib/dates';
import { mealTypeForTime } from '../../lib/nextMeal';
import { scaleNutrients } from '../../lib/nutrition';
import { assessProduct, fetchOffProduct, type Product } from '../../lib/openFoodFacts';
import type { Nutrients } from '../../lib/types';
import { awardEarnedHabits, useToast } from '../../state/actions';
import { useApp } from '../../state/app';
import { useDay } from '../../state/useDay';
import { brand, radius } from '../../theme';

type Phase = { s: 'loading' } | { s: 'found'; p: Product } | { s: 'not_found' } | { s: 'incomplete'; name: string | null } | { s: 'error'; message: string };

export default function ProductScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>();
  const { t, lang } = useI18n();
  const { membership } = useApp();
  const [phase, setPhase] = useState<Phase>({ s: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setPhase({ s: 'loading' });
      try {
        const local = membership ? await backend.findProduct(membership.family.id, barcode) : null;
        if (local) return alive && setPhase({ s: 'found', p: local });
      } catch { /* fall through to OFF */ }
      const r = await fetchOffProduct(barcode, lang);
      if (!alive) return;
      if (r.status === 'found') {
        setPhase({ s: 'found', p: r.product });
        backend.saveProduct(null, r.product).catch(() => undefined); // shared cache, best-effort
      } else if (r.status === 'error') setPhase({ s: 'error', message: r.message });
      else if (r.status === 'incomplete') setPhase({ s: 'incomplete', name: r.name });
      else setPhase({ s: 'not_found' });
    })();
    return () => { alive = false; };
  }, [barcode, lang, membership, attempt]);

  return (
    <Screen header={
      <Row gap={12} style={{ paddingHorizontal: 20, paddingTop: 8 }}>
        <IconButton icon="chevron-back" flipRtl label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} />
        <Txt v="h2" style={{ flex: 1 }}>{t('product.title')}</Txt>
        <IconButton icon="barcode-outline" label={t('scan.title')} onPress={() => router.replace('/scan')} />
      </Row>
    }>
      {phase.s === 'loading' && (
        <View style={{ gap: 12 }}>
          <Txt v="caption" muted center>{t('scan.searching')}</Txt>
          <Skeleton height={160} r={24} /><Skeleton height={200} r={24} />
        </View>
      )}
      {phase.s === 'found' && <ProductView p={phase.p} />}
      {phase.s === 'error' && (
        <View style={{ gap: 12 }}>
          <Banner tone="warning" text={`${t('product.networkError')} (${phase.message})`} />
          <Button title={t('common.retry')} kind="secondary" onPress={() => setAttempt((a) => a + 1)} />
          <ManualProduct barcode={barcode} />
        </View>
      )}
      {(phase.s === 'not_found' || phase.s === 'incomplete') && (
        <View style={{ gap: 12 }}>
          <Card tone="alt">
            <View style={{ gap: 6 }}>
              <Txt v="h3">{phase.s === 'incomplete' ? t('product.incomplete') : t('product.notFound')}</Txt>
              <Txt v="caption" muted>{t('product.notFoundBody')}</Txt>
              <Txt v="caption" faint>{barcode}</Txt>
            </View>
          </Card>
          <ManualProduct barcode={barcode} initialName={phase.s === 'incomplete' ? phase.name ?? '' : ''} />
        </View>
      )}
    </Screen>
  );
}

function ProductView({ p }: { p: Product }) {
  const { t, n } = useI18n();
  const { viewingMember, bump, theme: th } = useApp();
  const day = useDay(viewingMember?.id);
  const toast = useToast();
  const [amount, setAmount] = useState<string>(p.servingGrams ? 'serving' : '100');
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const visit = useRef(uid()).current;

  const grams = amount === 'serving' ? p.servingGrams ?? 100 : amount === 'custom' ? parseFloat(custom) || 0 : parseFloat(amount);
  const nut = scaleNutrients(p.per100, grams);
  const assessments = useMemo(() => assessProduct(p, {
    remainingKcal: day.remaining.kcal, remainingProtein: day.remaining.protein, sugarMax: day.goals?.sugarMax ?? 50,
    sodiumMax: day.goals?.sodiumMax ?? 2300, allergies: day.profile?.allergies ?? [],
  }, grams), [p, day.remaining, day.goals, day.profile, grams]);

  const add = async () => {
    if (!viewingMember || grams <= 0) return;
    setBusy(true);
    try {
      await backend.addFoodLog({
        memberId: viewingMember.id, logDate: localDate(), mealType: mealTypeForTime(new Date()), source: 'barcode',
        title: `${p.name}${p.brand ? ` · ${p.brand}` : ''} · ${n(grams)} ${t('common.g')}`,
        // Same product + amount submitted twice from this screen visit is stored once.
        dedupeKey: `barcode:${p.barcode}:${visit}:${grams}`,
        items: [{ name: p.name, grams, nutrients: nut }],
      });
      const pts = await awardEarnedHabits(viewingMember.id, localDate());
      bump();
      toast.show(pts ? t('home.pointsEarned', { n: pts }) : t('product.added'));
    } finally {
      setBusy(false);
    }
  };

  const row = (label: string, key: keyof Nutrients, unit: string) => {
    const miss = p.missing.includes(key);
    return (
      <Row key={key} justify="space-between" style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: th.border }}>
        <Txt v="caption" muted style={{ flex: 1.4 }}>{label}</Txt>
        <Txt v="label" style={{ flex: 1 }} center>{miss ? '—' : `${n(p.per100[key], 1)} ${unit}`}</Txt>
        <Txt v="label" style={{ flex: 1 }} center color={th.primary}>{miss ? '—' : `${n(nut[key], 1)} ${unit}`}</Txt>
      </Row>
    );
  };

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <Row gap={14}>
          <View style={{ width: 92, height: 92, borderRadius: radius.md, backgroundColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: th.border }}>
            {p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={{ width: 88, height: 88 }} contentFit="contain" /> : <Icon name="cube-outline" size={36} color={th.textFaint} />}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt v="h3" numberOfLines={3}>{p.name}</Txt>
            {p.brand && <Txt v="caption" muted>{p.brand}</Txt>}
            <Pill icon="server-outline" text={t(`product.source.${p.source}` as StringKey)} />
          </View>
        </Row>
      </Card>

      <Card tone="deep">
        <View style={{ gap: 10 }}>
          <Row justify="space-between">
            <Txt v="caption" color="rgba(255,255,255,0.7)">{t('product.per100')}: {n(p.per100.kcal)} {t('common.kcal')}</Txt>
            {p.servingGrams ? <Txt v="caption" color="rgba(255,255,255,0.7)">{t('product.perServing', { g: n(p.servingGrams) })}: {n(p.per100.kcal * p.servingGrams / 100)}</Txt> : null}
          </Row>
          <Txt v="numberLg" color={brand.gold}>{n(nut.kcal)} <Txt v="body" color="rgba(255,255,255,0.75)">{t('common.kcal')} · {n(grams)} {t('common.g')}</Txt></Txt>
        </View>
      </Card>

      <Card>
        <View style={{ gap: 12 }}>
          <Txt v="label" muted>{t('product.amount')}</Txt>
          <Row gap={8} wrap>
            {['30', '50', '100'].map((g) => <Chip key={g} label={`${g} ${t('common.g')}`} selected={amount === g} onPress={() => setAmount(g)} />)}
            {p.servingGrams ? <Chip label={`${t('product.serving')} (${n(p.servingGrams)} ${t('common.g')})`} selected={amount === 'serving'} onPress={() => setAmount('serving')} /> : null}
            <Chip label={t('product.custom')} selected={amount === 'custom'} onPress={() => setAmount('custom')} />
          </Row>
          {amount === 'custom' && <Field label={t('add.grams')} value={custom} onChangeText={(v) => setCustom(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />}
          <MacroTriplet protein={nut.protein} carbs={nut.carbs} fat={nut.fat} />
          <Button title={t('product.addToDay')} icon="add-circle-outline" loading={busy} disabled={grams <= 0 || grams > 3000} onPress={add} />
        </View>
      </Card>

      <Card tone="alt">
        <View style={{ gap: 8 }}>
          <Row gap={8}><Icon name="sparkles" size={18} color={th.dark ? th.gold : brand.forest} /><Txt v="h3">{t('product.assessTitle')}</Txt></Row>
          {assessments.map((a, i) => (
            <Row key={i} gap={8} align="flex-start">
              <Icon name={a.tone === 'good' ? 'checkmark-circle' : a.tone === 'caution' ? 'alert-circle' : 'information-circle'} size={17} color={a.tone === 'good' ? th.primary : a.tone === 'caution' ? th.danger : th.textMuted} />
              <Txt v="caption" style={{ flex: 1 }}>{t(a.key as StringKey, a.params)}</Txt>
            </Row>
          ))}
          <Txt v="caption" faint>{t('product.assessNote')}</Txt>
        </View>
      </Card>

      <Card>
        <View>
          <Row justify="space-between" style={{ paddingBottom: 6 }}>
            <Txt v="label" style={{ flex: 1.4 }}>{t('nut.details')}</Txt>
            <Txt v="caption" muted style={{ flex: 1 }} center>{t('product.per100')}</Txt>
            <Txt v="caption" muted style={{ flex: 1 }} center>{n(grams)} {t('common.g')}</Txt>
          </Row>
          {row(t('macro.protein'), 'protein', t('common.g'))}
          {row(t('macro.carbs'), 'carbs', t('common.g'))}
          {row(t('macro.sugar'), 'sugar', t('common.g'))}
          {row(t('macro.fat'), 'fat', t('common.g'))}
          {row(t('macro.satFat'), 'satFat', t('common.g'))}
          {row(t('macro.fiber'), 'fiber', t('common.g'))}
          {row(t('macro.sodium'), 'sodium', 'mg')}
          {p.missing.length > 0 && <Txt v="caption" faint style={{ marginTop: 8 }}>{t('product.missing')}</Txt>}
        </View>
      </Card>

      <Card>
        <View style={{ gap: 10 }}>
          <Txt v="h3">{t('product.allergens')}</Txt>
          {p.allergens.length ? (
            <Row gap={8} wrap>{p.allergens.map((a) => <Pill key={a} text={t(`allergen.${a}` as StringKey)} color={th.danger} bg={th.danger + '1A'} icon="warning-outline" />)}</Row>
          ) : <Txt v="caption" muted>{t('product.noAllergens')}</Txt>}
          {p.ingredientsText ? (
            <>
              <Txt v="h3" style={{ marginTop: 6 }}>{t('product.ingredients')}</Txt>
              <Txt v="caption" muted>{p.ingredientsText}</Txt>
            </>
          ) : null}
          {p.sourceUrl && (
            <Pressable onPress={() => Linking.openURL(p.sourceUrl!)}>
              <Txt v="caption" color={th.primary}>{t('product.source')}: Open Food Facts (ODbL) ↗</Txt>
            </Pressable>
          )}
        </View>
      </Card>
      <Toast text={toast.msg ?? ''} visible={!!toast.msg} />
    </View>
  );
}

function ManualProduct({ barcode, initialName = '' }: { barcode: string; initialName?: string }) {
  const { t } = useI18n();
  const { membership } = useApp();
  const [f, setF] = useState({ name: initialName, brand: '', kcal: '', protein: '', carbs: '', fat: '', sugar: '', fiber: '', sodium: '', serving: '' });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Product | null>(null);
  const num = (v: string) => (v.trim() === '' ? null : parseFloat(v));
  const valid = f.name.trim() && num(f.kcal) != null && num(f.protein) != null && num(f.carbs) != null && num(f.fat) != null && (num(f.kcal) ?? 0) <= 900;

  const save = async () => {
    if (!membership || !valid) return;
    setBusy(true);
    const missing: (keyof Nutrients)[] = [];
    const opt = (k: keyof Nutrients, v: string) => { const x = num(v); if (x == null) { missing.push(k); return 0; } return x; };
    const p: Product = {
      barcode, name: f.name.trim(), brand: f.brand.trim() || null, imageUrl: null,
      per100: { kcal: num(f.kcal)!, protein: num(f.protein)!, carbs: num(f.carbs)!, fat: num(f.fat)!, sugar: opt('sugar', f.sugar), fiber: opt('fiber', f.fiber), satFat: opt('satFat', ''), sodium: opt('sodium', f.sodium) },
      servingGrams: num(f.serving), servingLabel: null, ingredientsText: null, allergens: [], missing, source: 'family_manual', sourceUrl: null,
    };
    try {
      await backend.saveProduct(membership.family.id, p);
      setSaved(p);
    } finally {
      setBusy(false);
    }
  };

  if (saved) return <ProductView p={saved} />;
  const field = (k: keyof typeof f, label: string, numeric = true) => (
    <View style={{ flex: 1, minWidth: 130 }}>
      <Field label={label} value={f[k]} onChangeText={(v) => setF({ ...f, [k]: numeric ? v.replace(/[^0-9.]/g, '') : v })} keyboardType={numeric ? 'decimal-pad' : 'default'} />
    </View>
  );
  return (
    <Card>
      <View style={{ gap: 12 }}>
        <Txt v="h3">{t('product.manualTitle')}</Txt>
        {field('name', t('product.name'), false)}
        {field('brand', `${t('product.brand')} (${t('common.optional')})`, false)}
        <Txt v="label" muted>{t('product.per100')}</Txt>
        <Row wrap gap={10} align="flex-start">{field('kcal', `${t('macro.kcal')} (${t('common.kcal')})`)}{field('protein', `${t('macro.protein')} (${t('common.g')})`)}</Row>
        <Row wrap gap={10} align="flex-start">{field('carbs', `${t('macro.carbs')} (${t('common.g')})`)}{field('fat', `${t('macro.fat')} (${t('common.g')})`)}</Row>
        <Row wrap gap={10} align="flex-start">{field('sugar', `${t('macro.sugar')} (${t('common.g')})`)}{field('fiber', `${t('macro.fiber')} (${t('common.g')})`)}</Row>
        <Row wrap gap={10} align="flex-start">{field('sodium', `${t('macro.sodium')} (mg)`)}{field('serving', t('product.servingG'))}</Row>
        <Button title={t('product.saveFamily')} icon="people-outline" disabled={!valid} loading={busy} onPress={save} />
        <Button kind="secondary" icon="camera-outline" title={`${t('product.ocr')} · ${t('common.phase', { n: 4 })}`} disabled />
      </View>
    </Card>
  );
}

import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { backend } from '../../../backend';
import { TopBar } from '../../../components/recipe';
import { Banner, Button, Card, Field, Icon, Row, Screen, Txt } from '../../../components/ui';
import { useI18n } from '../../../i18n';
import { applyAnalysis } from '../../../lib/importFlow';
import { useApp } from '../../../state/app';
import { setDraft } from '../../../state/recipeDraft';
import { emptyRecipe } from '../../../state/recipes';

const MAX_FRAMES = 8;

async function toJpeg(uri: string): Promise<string | null> {
  const r = await manipulateAsync(uri, [{ resize: { width: 768 } }], { compress: 0.6, format: SaveFormat.JPEG, base64: true });
  return r.base64 ?? null;
}

/** Evenly spaced frames from a local video (on the device; the video itself is never uploaded). */
async function framesFromVideo(uri: string, durationMs: number): Promise<string[]> {
  const dur = Math.max(1000, durationMs || 30000);
  const times = Array.from({ length: MAX_FRAMES }, (_, i) => Math.round((dur * (i + 0.5)) / MAX_FRAMES));
  const out: string[] = [];
  for (const time of times) {
    try {
      const th = await VideoThumbnails.getThumbnailAsync(uri, { time, quality: 0.7 });
      const b = await toJpeg(th.uri);
      if (b) out.push(b);
    } catch {
      // skip unreadable frame
    }
  }
  return out;
}

export default function ImportMedia() {
  const { kind = 'video' } = useLocalSearchParams<{ kind?: 'video' | 'screen' | 'photos' }>();
  const { t, n, lang } = useI18n();
  const { viewingMember, membership, theme: th } = useApp();
  const ai = backend.aiAvailable();
  const [frames, setFrames] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState<'pick' | 'analyze' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isVideo = kind !== 'photos';
  const title = kind === 'photos' ? t('imp.photos') : kind === 'screen' ? t('imp.screen') : t('imp.video');
  const body = kind === 'photos' ? t('imp.photosBody') : kind === 'screen' ? t('imp.screenBody') : t('imp.videoBody');

  const pick = async (camera = false) => {
    setError(null);
    setBusy('pick');
    try {
      const opts: ImagePicker.ImagePickerOptions = isVideo
        ? { mediaTypes: ['videos'], quality: 1 }
        : { mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: MAX_FRAMES, quality: 0.8 };
      const res = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled) return;
      if (isVideo) {
        const a = res.assets[0];
        setFrames(await framesFromVideo(a.uri, a.duration ?? 0));
      } else {
        const out: string[] = [];
        for (const a of res.assets.slice(0, MAX_FRAMES)) {
          const b = await toJpeg(a.uri).catch(() => null);
          if (b) out.push(b);
        }
        setFrames((f) => [...f, ...out].slice(0, MAX_FRAMES));
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setBusy(null);
    }
  };

  const analyze = async () => {
    if (!viewingMember || !membership || !frames.length) return;
    setBusy('analyze');
    setError(null);
    try {
      const r = await backend.analyzeRecipe({ mode: 'frames', frames, text: notes.trim() || undefined, lang });
      if (r.status !== 'ok' || !r.ingredients.length) return setError(r.message ? `${t('imp.noRecipe')}\n${r.message}` : t('imp.noRecipe'));
      const base = emptyRecipe(viewingMember.id, membership.family.id, lang, { sourceKind: kind === 'photos' ? 'photos' : 'video' });
      setDraft({ recipe: applyAnalysis(base, r), sourceText: r.sourceText, alternatives: r.alternatives, message: r.message });
      router.replace('/recipes/review');
    } catch {
      setError(t('imp.unreachable'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen header={<TopBar title={title} subtitle={body} />}>
      {!ai ? (
        <>
          <Banner tone="warning" icon="cloud-offline-outline" text={t('imp.aiOff')} />
          <Button icon="document-text-outline" title={t('imp.text')} onPress={() => router.replace('/recipes/import/text')} />
        </>
      ) : isVideo && Platform.OS === 'web' ? (
        <>
          <Banner tone="warning" text={t('imp.webVideo')} />
          <Button icon="images-outline" title={t('imp.photos')} onPress={() => router.replace({ pathname: '/recipes/import/media', params: { kind: 'photos' } })} />
          <Button kind="secondary" icon="document-text-outline" title={t('imp.text')} onPress={() => router.replace('/recipes/import/text')} />
        </>
      ) : (
        <>
          <Row gap={10}>
            <View style={{ flex: 1 }}><Button icon={isVideo ? 'videocam-outline' : 'images-outline'} title={isVideo ? t('imp.pickVideo') : t('imp.pickPhotos')} loading={busy === 'pick'} onPress={() => pick(false)} /></View>
            {!isVideo && Platform.OS !== 'web' && <View style={{ flex: 1 }}><Button kind="secondary" icon="camera-outline" title={t('imp.takePhoto')} onPress={() => pick(true)} /></View>}
          </Row>
          {frames.length > 0 && (
            <Card tone="alt">
              <Row gap={8}><Icon name="film-outline" size={18} color={th.primary} /><Txt>{t('imp.frames', { n: n(frames.length) })}</Txt></Row>
            </Card>
          )}
          <Field label={t('imp.notes')} value={notes} onChangeText={setNotes} multiline />
          <Button icon="sparkles" title={t('imp.analyze')} disabled={!frames.length} loading={busy === 'analyze'} onPress={analyze} />
          <Txt v="caption" faint>{t('imp.speechNote')}</Txt>
        </>
      )}
      {error && <Banner tone="warning" text={error} />}
      <Banner text={t('imp.legal')} icon="shield-checkmark-outline" />
    </Screen>
  );
}

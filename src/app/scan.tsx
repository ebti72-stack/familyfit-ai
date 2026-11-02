import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Field, haptic, IconButton, Row, Sheet, Txt } from '../components/ui';
import { useI18n } from '../i18n';
import { isLikelyBarcode } from '../lib/openFoodFacts';
import { useApp } from '../state/app';
import { brand, radius } from '../theme';

const FRAME_W = 280;
const FRAME_H = 180;

export default function Scan() {
  const { t } = useI18n();
  const th = useApp().theme;
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState(Platform.OS === 'web');
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const locked = useRef(false);
  const line = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(line, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(line, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [line]);

  const open = (value: string) => {
    if (locked.current) return;
    locked.current = true;
    haptic('success');
    router.replace({ pathname: '/product/[barcode]', params: { barcode: value } });
  };

  const onScanned = (r: BarcodeScanningResult) => {
    const v = (r.data ?? '').trim();
    if (!v) return;
    // QR codes may carry a GTIN inside a URL (GS1 Digital Link): extract the 8–14 digit GTIN.
    const gtin = /^\d{6,14}$/.test(v) ? v : v.match(/\/01\/(\d{8,14})/)?.[1];
    if (gtin) open(gtin);
  };

  const submitManual = () => {
    const v = code.trim();
    if (!isLikelyBarcode(v)) return setErr(t('scan.invalid'));
    setManual(false);
    open(v);
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const granted = permission?.granted && Platform.OS !== 'web';

  return (
    <View style={{ flex: 1, backgroundColor: '#050B09' }}>
      {granted && (
        <CameraView
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
          onBarcodeScanned={onScanned}
        />
      )}
      <SafeAreaView style={{ flex: 1 }}>
        <Row justify="space-between" style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <IconButton tone="dark" icon="close" label={t('common.cancel')} onPress={close} />
          <Txt v="h3" color="#fff">{t('scan.title')}</Txt>
          {granted ? <IconButton tone="dark" icon={torch ? 'flashlight' : 'flashlight-outline'} label={t('scan.torch')} onPress={() => setTorch(!torch)} /> : <View style={{ width: 44 }} />}
        </Row>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22, paddingHorizontal: 24 }}>
          {granted || Platform.OS === 'web' ? (
            <>
              <View style={{ width: FRAME_W, height: FRAME_H }}>
                {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                  <View key={c} style={{
                    position: 'absolute', width: 34, height: 34, borderColor: brand.gold,
                    top: c[0] === 't' ? 0 : undefined, bottom: c[0] === 'b' ? 0 : undefined, left: c[1] === 'l' ? 0 : undefined, right: c[1] === 'r' ? 0 : undefined,
                    borderTopWidth: c[0] === 't' ? 4 : 0, borderBottomWidth: c[0] === 'b' ? 4 : 0, borderLeftWidth: c[1] === 'l' ? 4 : 0, borderRightWidth: c[1] === 'r' ? 4 : 0,
                    borderTopLeftRadius: c === 'tl' ? 18 : 0, borderTopRightRadius: c === 'tr' ? 18 : 0, borderBottomLeftRadius: c === 'bl' ? 18 : 0, borderBottomRightRadius: c === 'br' ? 18 : 0,
                  }} />
                ))}
                <Animated.View style={{
                  position: 'absolute', left: 16, right: 16, height: 2, borderRadius: 1, backgroundColor: brand.gold, opacity: 0.85,
                  transform: [{ translateY: line.interpolate({ inputRange: [0, 1], outputRange: [14, FRAME_H - 16] }) }],
                }} />
              </View>
              <View style={{ backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill }}>
                <Txt v="label" color="#fff" center>{Platform.OS === 'web' ? t('scan.webNote') : t('scan.hint')}</Txt>
              </View>
            </>
          ) : (
            <View style={{ gap: 14, alignItems: 'center' }}>
              <Txt v="h3" color="#fff" center>{t('scan.permission')}</Txt>
              <Button kind="gold" full={false} title={t('scan.grant')} onPress={requestPermission} />
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
          <Button kind="onDark" icon="keypad-outline" title={t('scan.manual')} onPress={() => { setManual(true); setErr(null); }} />
        </View>
      </SafeAreaView>

      <Sheet visible={manual} onClose={() => setManual(false)} title={t('scan.manual')}>
        <Field label="EAN / UPC" value={code} onChangeText={(v) => { setCode(v.replace(/\D/g, '')); setErr(null); }} keyboardType="number-pad" placeholder="6281007012345" maxLength={14} error={err} autoFocus />
        <Button title={t('scan.lookup')} icon="search" onPress={submitManual} disabled={code.length < 6} />
        <Txt v="caption" color={th.textMuted}>{t('scan.webNote')}</Txt>
      </Sheet>
    </View>
  );
}

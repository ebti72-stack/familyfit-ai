import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { backend, BackendError, isLocal } from '../backend';
import { Logo } from '../components/Logo';
import { Banner, Button, IconButton, Field, Row, Screen, Txt } from '../components/ui';
import { useI18n } from '../i18n';
import { useTheme } from '../state/app';

export default function Auth() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const { t } = useI18n();
  const th = useTheme();
  const [mode, setMode] = useState<'in' | 'up'>(params.mode === 'in' ? 'in' : 'up');
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const caps = backend.authCapabilities();

  const fail = (e: unknown) => {
    if (e instanceof BackendError) {
      if (e.code === 'auth') setError(e.message === 'exists' ? t('auth.exists') : t('auth.invalid'));
      else if (e.code === 'not_configured') setError(t('auth.notConfigured'));
      else setError(e.message);
    } else setError(t('common.error'));
  };

  const done = () => router.replace('/');

  const submitEmail = async () => {
    setError(null);
    const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!okEmail || password.length < 8 || (mode === 'up' && !name.trim())) return setError(t('auth.validation'));
    setBusy(true);
    try {
      if (mode === 'up') {
        const r = await backend.signUpEmail(email.trim(), password, name.trim());
        if (r.needsConfirmation) {
          setInfo(t('auth.checkEmail'));
          setMode('in');
          return;
        }
      } else await backend.signInEmail(email.trim(), password);
      done();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const submitPhone = async () => {
    setError(null);
    setBusy(true);
    try {
      if (!otpSent) {
        await backend.sendPhoneOtp(phone.trim());
        setOtpSent(true);
      } else {
        await backend.verifyPhoneOtp(phone.trim(), otp.trim());
        done();
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const social = async (p: 'apple' | 'google') => {
    setError(null);
    try {
      await (p === 'apple' ? backend.signInApple() : backend.signInGoogle());
      done();
    } catch (e) {
      fail(e);
    }
  };

  const phoneOn = caps.includes('phone');
  const appleOn = caps.includes('apple') && Platform.OS === 'ios';
  const googleOn = caps.includes('google');

  return (
    <Screen header={<Row style={{ paddingHorizontal: 20, paddingTop: 8 }}><IconButton icon="chevron-back" label={t('common.back')} flipRtl onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} /></Row>}>
      <View style={{ alignItems: 'center', gap: 10, marginTop: 8 }}>
        <Logo size={60} />
        <Txt v="h1" center>{mode === 'up' ? t('auth.signUp') : t('auth.signIn')}</Txt>
      </View>
      {isLocal && <Banner tone="warning" text={t('local.banner')} />}
      {info && <Banner text={info} />}

      {method === 'email' ? (
        <View style={{ gap: 14 }}>
          {mode === 'up' && <Field label={t('auth.name')} value={name} onChangeText={setName} autoComplete="name" />}
          <Field label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
          <Field label={t('auth.password')} hint={t('auth.passwordHint')} value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'up' ? 'new-password' : 'current-password'} />
          {error && <Txt v="caption" color={th.danger}>{error}</Txt>}
          <Button title={mode === 'up' ? t('auth.signUp') : t('auth.signIn')} onPress={submitEmail} loading={busy} />
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          <Field label={t('auth.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+9665XXXXXXXX" />
          {otpSent && <Field label={t('auth.otp')} value={otp} onChangeText={setOtp} keyboardType="number-pad" />}
          {error && <Txt v="caption" color={th.danger}>{error}</Txt>}
          <Button title={otpSent ? t('auth.verify') : t('auth.sendCode')} onPress={submitPhone} loading={busy} />
        </View>
      )}

      <Txt v="caption" faint center>{t('auth.or')}</Txt>
      <View style={{ gap: 10 }}>
        <Button kind="secondary" icon={method === 'email' ? 'call-outline' : 'mail-outline'} title={method === 'email' ? t('auth.withPhone') : t('auth.withEmail')}
          disabled={method === 'email' && !phoneOn} onPress={() => { setMethod(method === 'email' ? 'phone' : 'email'); setError(null); }} />
        {Platform.OS === 'ios' || Platform.OS === 'web' ? <Button kind="secondary" icon="logo-apple" title={t('auth.apple')} disabled={!appleOn} onPress={() => social('apple')} /> : null}
        <Button kind="secondary" icon="logo-google" title={t('auth.google')} disabled={!googleOn} onPress={() => social('google')} />
        {(!phoneOn || !appleOn || !googleOn) && <Txt v="caption" faint center>{t('auth.notConfigured')}</Txt>}
      </View>
      <Button kind="ghost" title={mode === 'up' ? t('auth.switchToIn') : t('auth.switchToUp')} onPress={() => { setMode(mode === 'up' ? 'in' : 'up'); setError(null); }} />
    </Screen>
  );
}

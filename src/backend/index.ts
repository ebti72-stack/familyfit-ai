import { LocalBackend } from './local';
import { SupabaseBackend } from './supabase';
import type { AuthCapability, Backend } from './types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Sign-in providers are only enabled when you have configured them in Supabase (see README). */
const caps: AuthCapability[] = ['email'];
if (process.env.EXPO_PUBLIC_AUTH_PHONE === 'true') caps.push('phone');
if (process.env.EXPO_PUBLIC_AUTH_APPLE === 'true') caps.push('apple');
if (process.env.EXPO_PUBLIC_AUTH_GOOGLE === 'true') caps.push('google');

export const backend: Backend = url && anon ? new SupabaseBackend(url, anon, caps) : new LocalBackend();
export const isLocal = backend.mode === 'local';
export * from './types';

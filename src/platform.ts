// Native (Capacitor/Android) integration. Everything here degrades to a no-op on desktop web.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export const NATIVE = Capacitor.isNativePlatform();
export const TOUCH = NATIVE || matchMedia('(pointer: coarse)').matches;

const last: Record<string, number> = {};
const gap = (k: string, ms: number) => {
  const n = performance.now();
  if (last[k] && n - last[k] < ms) return true;
  last[k] = n;
  return false;
};

/** Haptic kick. light: shield/pickup, medium: big kills, heavy: mini-boss/boss deaths, death: player killed. */
export function buzz(kind: 'light' | 'medium' | 'heavy' | 'death') {
  if (!TOUCH || buzzOff) return;
  if (gap(kind, kind === 'medium' ? 90 : 40)) return;
  try {
    if (kind === 'death') Haptics.notification({ type: NotificationType.Error });
    else Haptics.impact({ style: kind === 'light' ? ImpactStyle.Light : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Heavy });
  } catch (e) {}
}
export let buzzOff = false;
export const setBuzzOff = (v: boolean) => (buzzOff = v);

/** Android WebView has no speechSynthesis, so voice lines go through native TTS there. Returns false if not handled. */
export function nativeSay(text: string, pitch: number, rate: number): boolean {
  if (!NATIVE) return false;
  TextToSpeech.stop()
    .catch(() => {})
    .then(() => TextToSpeech.speak({ text, lang: 'en-US', pitch: Math.max(0.5, pitch), rate, volume: 1, category: 'ambient' }))
    .catch(() => {});
  return true;
}

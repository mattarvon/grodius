// Tone pass D39: voice lines are recorded clips or nothing. With a shelved or empty bank a hype call shows its comms
// window and plays the sting, but must not speak: the old fallbacks (speechSynthesis, native TTS) are gone.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubDom } from './fakecanvas';

let A: any, FX: any, $: any;
const created = vi.fn(() => ({ connect() {}, start() {}, playbackRate: { value: 1 } }));
const SFX_CATS = Object.keys(import.meta.glob('../../src/sfx/*/*')).map((p) => p.split('/')[4]);
const code = (f: string) => readFileSync(new URL('../../' + f, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

beforeAll(async () => {
  stubDom();
  ({ $ } = await import('../../src/state'));
  A = await import('../../src/audio');
  FX = await import('../../src/fx/update');
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  created.mockClear();
  $.G = {};
  A.AU.c = null;
});

describe('an empty voice bank', () => {
  it('has no clips for the shelved banks, so the case is live and not hypothetical', () => {
    for (const cat of ['hype10', 'hype20', 'babe20', 'bossreward', 'fart_nav', 'fart_ok', 'silly']) expect(SFX_CATS, cat).not.toContain(cat);
  });

  it('plays nothing: sample() reports no clip and builds no audio source, even with a running context', () => {
    A.AU.c = { state: 'running', currentTime: 0, createBufferSource: created };
    expect(A.sample('hype10')).toBe(false);
    expect(created).not.toHaveBeenCalled();
  });

  it('still opens the comms window on a hype call, on the shorter unvoiced timer, and speaks nothing when the clip slot fires', () => {
    vi.useFakeTimers();
    FX.hype(20);
    expect($.G.hype.L).toEqual(FX.HYPE[20]);
    expect($.G.hype.t).toBe(150);
    A.AU.c = { state: 'running', currentTime: 0, createBufferSource: created };
    vi.runAllTimers();
    vi.useRealTimers();
    expect(created).not.toHaveBeenCalled();
  });

  it('has no text-to-speech path left in the code that plays voice lines', () => {
    for (const f of ['src/audio.ts', 'src/fx/update.ts', 'src/render/hype.ts', 'src/platform.ts']) expect(code(f), f).not.toMatch(/speechSynthesis|SpeechSynthesisUtterance|TextToSpeech|nativeSay/);
  });

  it('ships no text-to-speech plugin: package.json does not depend on it and the Android gradle files do not include it', () => {
    expect(JSON.parse(code('package.json')).dependencies).not.toHaveProperty('@capacitor-community/text-to-speech');
    for (const f of ['android/capacitor.settings.gradle', 'android/app/capacitor.build.gradle']) expect(code(f), f).not.toMatch(/text-to-speech/);
  });
});

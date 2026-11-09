// The biome kill layer in sfx.gore() against the voice cap (technical-director, BLOCKING at the ls2-read rebase): the
// layer read a `voices` counter the cap rewrite removed, a ReferenceError inside a sound call made from the update, which
// @ts-nocheck and the harness (no AudioContext) both miss. Driven through a fake AudioContext, one kill per biome.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BIOME_KILL, KILL_LAYER } from '../../src/audiomix';

const M = vi.hoisted(() => ({ biome: 'ice' }));
vi.mock('../../src/save', () => ({ SET: { muted: false } }));
vi.mock('../../src/music', () => ({ duckMusic: () => {}, curBiome: () => M.biome }));

let A: typeof import('../../src/audio');
let played: any[];
let stopped = 0;
const param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
const node = () => ({ connect() {}, disconnect() {} });
const fakeCtx = () => ({
  state: 'running',
  currentTime: 0,
  sampleRate: 48000,
  createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
  createBufferSource() {
    const s: any = { ...node(), buffer: null, playbackRate: param(), onended: null, start() { played.push(s); }, stop() { stopped++; } };
    return s;
  },
  createGain: () => ({ ...node(), gain: param() }),
  createOscillator: () => ({ ...node(), type: '', frequency: param(), detune: param(), start() {}, stop() {} }),
  createBiquadFilter: () => ({ ...node(), type: '', frequency: param(), Q: param() }),
});
const clip = (c: string) => [{ duration: .5, clip: c, c }];
let now = 0;

beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('crypto', { getRandomValues: (u: Uint32Array) => { u[0] = 12345; return u; } }); // audio.ts seeds ar() from it: pin the rolls
  A = await import('../../src/audio');
  played = [];
  stopped = 0;
  A.AU.c = fakeCtx();
  A.AU.m = node();
  A.AU.verb = node();
  for (const c of ['splat_s', 'splat_m', 'splat_l', 'thud', 'bone', 'explode_l', ...Object.values(BIOME_KILL).map((k) => k.cat)]) A.BANK[c] = clip(c) as any;
  vi.spyOn(performance, 'now').mockImplementation(() => (now += 1000)); // past every throttle, each call
});

/** repeat kills until the biome's layer has played: it rolls `chance` per kill */
const killsUntilLayer = (cat: string) => {
  for (let i = 0; i < 200; i++) {
    A.sfx.gore(3);
    if (played.some((s) => s.buffer && s.buffer.c === cat)) return true;
    played.forEach((s) => s.onended && s.onended()); // free the voices, as the clips ending would
    played = [];
  }
  return false;
};

describe('sfx.gore and the biome kill layer', () => {
  it.each(Object.keys(BIOME_KILL))('a big kill in %s does not throw and plays that biome\'s layer', (b) => {
    M.biome = b;
    expect(() => expect(killsUntilLayer(BIOME_KILL[b].cat)).toBe(true)).not.toThrow();
  });

  it('does not throw with no biome', () => {
    M.biome = '';
    expect(() => A.sfx.gore(3)).not.toThrow();
  });

  // gore(1) adds one voice (the splat) before the guard reads LIVE, so `base` voices here are base + 1 at the guard. The
  // extra voices end between kills, so every kill sees the same count; 200 kills out-roll any row's `chance`
  const layerAt = (b: string, atGuard: number) => {
    M.biome = b;
    for (let i = 0; i < atGuard - 1; i++) A.sample('splat_s');
    const base = played.length;
    let heard = false;
    for (let i = 0; i < 200 && !heard; i++) {
      A.sfx.gore(1);
      heard = played.slice(base).some((s) => s.buffer && s.buffer.c === BIOME_KILL[b].cat);
      played.splice(base).forEach((s) => s.onended && s.onended());
    }
    return heard;
  };

  it.each(Object.keys(BIOME_KILL))('in %s it plays at exactly maxVoices live voices', (b) => {
    expect(layerAt(b, KILL_LAYER.maxVoices)).toBe(true);
  });

  it.each(Object.keys(BIOME_KILL))('in %s it skips one voice above maxVoices, and evicts nothing', (b) => {
    expect(layerAt(b, KILL_LAYER.maxVoices + 1)).toBe(false);
    expect(stopped).toBe(0);
  });

  it('keeps the threshold below the cap, so the layer can never be what evicts a voice', () => {
    expect(KILL_LAYER.maxVoices).toBe(10);
  });
});

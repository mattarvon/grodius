// LS2 combined review (game-designer, audio-director): what a run's end does to SGT. RAMROD SLAB's voice lines.
// Game over drops every line queued but not yet started and lets the one talking finish; a new game or the title stops
// every line with a short fade and leaves the comms window nothing to show. Also: a voice line's level jitters only
// .95-1.05, and a new game forgets the last spoken OPENED. Driven through a stubbed BANK and a fake AudioContext.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubDom } from './fakecanvas';

let A: any, FX: any, $: any;
type Src = { cat?: string; at: number | null; stops: (number | undefined)[]; gain: any };
let srcs: Src[];

const param = () => ({ value: 0, targets: [] as number[][], setValueAtTime() {}, setTargetAtTime(v: number, t: number, k: number) { this.targets.push([v, t, k]); }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
const node = () => ({ connect() {}, disconnect() {} });
function fakeCtx() {
  let last: any = null;
  return {
    state: 'running',
    currentTime: 0,
    createBufferSource() {
      const s: any = { ...node(), buffer: null, playbackRate: param(), at: null, stops: [], onended: null, start(t: number) { s.at = t; }, stop(t?: number) { s.stops.push(t); } };
      srcs.push(s);
      last = s;
      return s;
    },
    // sample() makes the source, then its gain: tie the gain to the source it belongs to
    createGain() { const g = { ...node(), gain: param() }; if (last && !last.gain) last.gain = g.gain; return g; },
    createOscillator: () => ({ ...node(), type: '', frequency: param(), start() {}, stop() {} }),
    createBiquadFilter: () => ({ ...node(), type: '', frequency: param(), Q: param() }),
  };
}
const take = (stem: string, duration = 1) => [{ duration, clip: stem }];

beforeAll(() => stubDom());
afterAll(() => vi.unstubAllGlobals());
beforeEach(async () => {
  vi.resetModules();
  ({ $ } = await import('../../src/state'));
  A = await import('../../src/audio');
  FX = await import('../../src/fx/update');
  srcs = [];
  $.G = {};
  A.AU.c = fakeCtx();
  A.AU.m = node();
  A.AU.verb = node();
  A.AU.voice = null;
  A.AU.voiceQ = [];
  for (const k of Object.keys(A.BANK)) delete A.BANK[k];
  Object.assign(A.BANK, { hype10: take('that-one-had-a-name-matty-1'), 'kill-ufo': take('calamari-served-matty-1', .8), splat_s: take('splat') });
});

describe('game over (voiceDropQueued)', () => {
  it('drops the line queued behind the one talking, and lets the talking one finish', () => {
    // Arrange: hype10 talks from 0 to 1; the kill word lands at .2 and queues to start a VOICE_GAP after it
    A.sample('hype10', { spread: 0 });
    A.AU.c.currentTime = .2;
    A.sample('kill-ufo', { spread: 0 });
    const [talking, queued] = srcs;
    expect(queued.at).toBeGreaterThan(1);
    // Act
    A.AU.c.currentTime = .5;
    A.voiceDropQueued();
    // Assert
    expect(queued.stops).toEqual([undefined]); // stopped before its start: it never plays
    expect(talking.stops).toEqual([]);
    expect(A.AU.voiceQ.map((v: any) => v.cat)).toEqual(['hype10']);
    expect(A.AU.voice.cat).toBe('hype10');
  });
  it('leaves ordinary sounds alone and does nothing without audio (the harness)', () => {
    A.sample('splat_s');
    A.voiceDropQueued();
    expect(srcs[0].stops).toEqual([]);
    A.AU.c = null;
    expect(() => A.voiceDropQueued()).not.toThrow();
  });
});

describe('new game or title (voiceStopAll)', () => {
  it('fades and stops every voice line, talking or queued, over VOICE_CUT, and clears the comms queue', () => {
    A.sample('hype10', { spread: 0 });
    A.sample('kill-ufo', { spread: 0 });
    A.sample('splat_s');
    A.AU.c.currentTime = .5;
    A.voiceStopAll();
    const [a, b, splat] = srcs;
    for (const v of [a, b]) {
      expect(v.stops).toEqual([.5 + A.VOICE_CUT]);
      expect(v.gain.targets.at(-1)).toEqual([0, .5, A.VOICE_CUT / 3]);
    }
    expect(A.VOICE_CUT).toBeCloseTo(.06);
    expect(splat.stops).toEqual([]);
    expect(A.AU.voice).toBe(null);
    expect(A.AU.voiceQ).toEqual([]);
  });
  it('lets a solo line (the corpse plea) play again at once after the cut', () => {
    A.BANK.corpsevoice = take('stop-killing-me-matty-1', 3);
    expect(A.sample('corpsevoice', { solo: true })).toBe(true);
    A.voiceStopAll();
    A.AU.c.currentTime = .1;
    A.sample('corpsevoice', { solo: true });
    expect(srcs.length).toBe(2); // without the SOLO reset the second call would be swallowed as "still talking"
  });
  it('clears the comms state even without audio', () => {
    A.AU.c = null;
    A.AU.voice = { cat: 'hype10' };
    A.AU.voiceQ = [A.AU.voice];
    A.voiceStopAll();
    expect(A.AU.voice).toBe(null);
    expect(A.AU.voiceQ).toEqual([]);
  });
});

describe('voice level jitter', () => {
  it('keeps a voice line within .95-1.05 of its volume, while ordinary sounds keep .8-1.1', () => {
    for (let i = 0; i < 200; i++) {
      A.AU.voice = null; // no queue: each line starts now
      A.sample('hype10', { vol: 1 });
      A.sample('splat_s', { vol: 1 });
      for (const s of srcs) (s as any).onended?.(); // each ends at once, so the voice cap never drops one
    }
    const of = (clip: string) => srcs.filter((s: any) => s.buffer.clip === clip).map((s) => s.gain.value);
    const voice = of('that-one-had-a-name-matty-1'), other = of('splat');
    expect(voice.length).toBe(200);
    expect(other.length).toBe(200);
    expect(Math.min(...voice)).toBeGreaterThanOrEqual(.95);
    expect(Math.max(...voice)).toBeLessThanOrEqual(1.05);
    expect(Math.min(...other)).toBeLessThan(.9); // the wide jitter is still there for gore
  });
});

describe('OPENED after a new game (resetOpened)', () => {
  const chain5 = () => { $.G = { combo: 5, cMile: 0, comboT: 30 }; FX.updateCombo(); };
  it('speaks the first 5-chain of a new run even inside the last run\'s OPENED_GAP', () => {
    A.BANK.carn5 = take('opened-matty-1', .5);
    chain5();
    expect(srcs.length).toBe(1);
    A.AU.c.currentTime = 2; // well inside OPENED_GAP (20 s of audio)
    A.AU.voice = null;
    chain5();
    expect(srcs.length).toBe(1); // still cooling down
    A.resetOpened();
    chain5();
    expect(srcs.length).toBe(2);
  });
});

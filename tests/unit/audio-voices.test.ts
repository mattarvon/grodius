// LS1 audit SUMMARY #5/#6 (sound-designer, rows K and F): the sample() voice cap. A dropped sound must report false so
// the caller's fallback runs, and a priority cue (the Maw death, WARNING siren, stinger, forkopen) is never dropped: it
// evicts the oldest ordinary voice. Driven through a fake AudioContext set on AU.c; no real audio.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('../../src/save', () => ({ SET: { muted: false } }));
vi.mock('../../src/platform', () => ({ nativeSay: () => false }));
vi.mock('../../src/music', () => ({ duckMusic: () => {}, curBiome: () => 'acid' }));

type Src = { buffer: any; started: boolean; stopped: boolean; onended: null | (() => void) };
let A: typeof import('../../src/audio');
let srcs: Src[];

const param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
const node = () => ({ connect() {}, disconnect() {} });
function fakeCtx() {
  return {
    state: 'running',
    currentTime: 0,
    createBufferSource() {
      const s: any = { ...node(), buffer: null, playbackRate: param(), started: false, stopped: false, onended: null, start() { s.started = true; }, stop() { s.stopped = true; } };
      srcs.push(s);
      return s;
    },
    createGain: () => ({ ...node(), gain: param() }),
    createOscillator: () => ({ ...node(), type: '', frequency: param(), start() {}, stop() {} }),
    createBiquadFilter: () => ({ ...node(), type: '', frequency: param(), Q: param() }),
  };
}
const clip = (cat: string) => [{ duration: .5, clip: cat }];
const playing = () => srcs.filter((s) => s.started && !s.stopped);
/** the voice cap: sample() has always let 15 voices sound at once (`voices > 14` swallowed the 16th) */
const CAP = 15;
const fill = () => { for (let i = 0; i < CAP; i++) expect(A.sample('splat_s')).toBe(true); };

beforeEach(async () => {
  vi.resetModules(); // the live-voice count is module state: a fresh audio.ts per test
  A = await import('../../src/audio');
  srcs = [];
  A.AU.c = fakeCtx();
  A.AU.m = node();
  A.AU.verb = node();
  for (const c of ['hype20', 'splat_s', 'warning', 'stinger', 'forkopen', 'splat_l']) A.BANK[c] = clip(c);
});

describe('the sample() voice cap', () => {
  it('returns false when it drops a fallback-marked sound at the cap, so the caller can fall back', () => {
    fill();
    const n = srcs.length;
    expect(A.sample('splat_s', { fb: true })).toBe(false);
    expect(srcs.length).toBe(n); // nothing was built for the dropped sound
  });

  it('swallows an unmarked sound at the cap (true, nothing built), so gore adds no synth mud to a full frame', () => {
    fill();
    const n = srcs.length;
    expect(A.sample('splat_s')).toBe(true);
    expect(srcs.length).toBe(n);
  });

  it('plays a priority sound at the cap by evicting the oldest ordinary voice', () => {
    fill();
    const oldest = srcs[0];
    expect(A.sample('splat_l', { prio: true })).toBe(true);
    expect(oldest.stopped).toBe(true);
    expect(srcs[srcs.length - 1].buffer.clip).toBe('splat_l');
    expect(srcs[srcs.length - 1].started).toBe(true);
    expect(playing().length).toBe(CAP);
  });

  it('still drops an ordinary sound at the cap after an eviction', () => {
    fill();
    A.sample('warning', { prio: true });
    expect(A.sample('splat_s', { fb: true })).toBe(false);
    expect(playing().length).toBe(CAP);
  });

  it('frees a slot when a voice ends', () => {
    fill();
    srcs[3].onended!();
    expect(A.sample('splat_s')).toBe(true);
  });

  it('plays the WARNING siren and the stinger together at the cap (sfx.dread)', () => {
    fill();
    A.sfx.dread();
    const cues = playing().map((s) => s.buffer.clip);
    expect(cues).toContain('warning');
    expect(cues).toContain('stinger');
  });

  it('plays forkopen at the cap', () => {
    fill();
    A.sfx.forkOpen();
    expect(playing().map((s) => s.buffer.clip)).toContain('forkopen');
  });

  it('returns false with no audio context, as in the harness, and builds nothing', () => {
    A.AU.c = null;
    expect(A.sample('splat_s')).toBe(false);
    expect(A.sample('warning', { prio: true })).toBe(false);
    expect(srcs.length).toBe(0);
  });

  it('never evicts a voice line: a priority cue takes the oldest ordinary voice after it', () => {
    expect(A.sample('hype20')).toBe(true); // the oldest voice is a voice line
    for (let i = 1; i < CAP; i++) A.sample('splat_s');
    const [voice, oldestSplat] = srcs;
    expect(A.sample('warning', { prio: true })).toBe(true);
    expect(voice.stopped).toBe(false);
    expect(oldestSplat.stopped).toBe(true);
  });
});

describe('the Drive death (render/gross/drive.ts rupture)', () => {
  it('marks every death sound priority, so the final boss never dies silent at the cap', () => {
    const src = readFileSync(new URL('../../src/render/gross/drive.ts', import.meta.url), 'utf8');
    const body = src.slice(src.indexOf('function rupture()'), src.indexOf('// ---------------- drawing'));
    const calls = body.match(/snd\('\w+', \{[^}]*\}/g) || [];
    expect(calls.map((c) => c.slice(5, c.indexOf("'", 5)))).toEqual(['driveburst', 'splat_l', 'explode_l', 'fart_ok']);
    for (const c of calls) expect(c).toContain('prio: true');
  });
});

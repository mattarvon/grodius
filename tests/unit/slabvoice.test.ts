// LS2-slab: SGT. RAMROD SLAB (Matt's own head, src/sprites/slab@3.png) speaks every new line over the comms: the hype
// chain lines, TAKEN DOWN, the midboss kill words (src/sfx/kill-<k>/) and OPENED (src/sfx/carn5/). A folder with a clip
// plays and opens the window with his face; an empty one stays silent with no window; a line that lands while another
// talks waits its turn (OPENED is skipped instead). Driven through a stubbed BANK and a fake AudioContext; no real audio.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubDom } from './fakecanvas';

let A: any, H: any, FX: any, S: any, core: any, $: any;
type Src = { buffer: any; at: number | null };
let srcs: Src[];

const param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
const node = () => ({ connect() {}, disconnect() {} });
function fakeCtx() {
  return {
    state: 'running',
    currentTime: 0,
    createBufferSource() {
      const s: any = { ...node(), buffer: null, playbackRate: param(), at: null, onended: null, start(t: number) { s.at = t; }, stop() {} };
      srcs.push(s);
      return s;
    },
    createGain: () => ({ ...node(), gain: param() }),
    createOscillator: () => ({ ...node(), type: '', frequency: param(), start() {}, stop() {} }),
    createBiquadFilter: () => ({ ...node(), type: '', frequency: param(), Q: param() }),
  };
}
/** a take as the booth names it: after the line's words, not the caller */
const take = (stem: string, duration = 1) => [{ duration, clip: stem }];
const SLAB = 'SGT. RAMROD SLAB';
// the shipped kill-word folders (the booth's slot list, LS2-booth); pinned against the roster below
const KILLS = ['ufo', 'brood', 'choir', 'cyst', 'prentice'];
const code = (f: string) => readFileSync(new URL('../../' + f, import.meta.url), 'utf8');

beforeAll(() => stubDom());
afterAll(() => vi.unstubAllGlobals());
/** fresh modules and state; R is `Math.random` captured at core.ts import, so a spy on it must be set before this */
async function load() {
  vi.resetModules(); // the comms window, the live voice and the OPENED clock are module state
  ({ $ } = await import('../../src/state'));
  A = await import('../../src/audio');
  H = await import('../../src/render/hype');
  FX = await import('../../src/fx/update');
  S = await import('../../src/sprites');
  core = await import('../../src/core');
  srcs = [];
  $.G = {};
  $.T = 0;
  A.AU.c = fakeCtx();
  A.AU.m = node();
  A.AU.verb = node();
  A.AU.voice = null;
  A.AU.voiceQ = [];
  for (const k of Object.keys(A.BANK)) delete A.BANK[k];
  S.SPR.slab = { img: { tag: 'slab' }, n: 3, fw: 48, fh: 52 };
  S.SPR.hface = { img: { tag: 'hface' }, n: 18, fw: 48, fh: 52 };
  core.ctx.drawImage = vi.fn();
  core.ctx.fillText = vi.fn();
}
beforeEach(load);
const tags = () => core.ctx.fillText.mock.calls.map((c: any[]) => c[0]).filter((t: string) => /SLAB|CREWMAN|LESLEY|UNKNOWN/.test(t));

/** run the comms window for a few frames, the audio clock at `now`; which sheets it drew from */
function frames(now: number, n = 20) {
  A.AU.c.currentTime = now;
  for (let i = 0; i < n; i++) ($.T += 1), H.drawHype();
  return new Set(core.ctx.drawImage.mock.calls.map((c: any[]) => c[0].tag));
}

describe("SGT. RAMROD SLAB's folders", () => {
  it('maps every new slot to him by its folder, whatever the take is called', () => {
    for (const cat of ['hype10', 'hype20', 'hype35', 'hype50', 'hype75', 'hype100', 'bossreward', 'carn5', ...KILLS.map((k) => 'kill-' + k)])
      expect(H.voiceOf('some-words-matty-1', cat), cat).toEqual([-1, SLAB]);
  });

  it('keeps the old clip-name route on his face, and matches only his exact folders', () => {
    expect(H.voiceOf('hell-yeah-matty-1', '')).toEqual([-1, SLAB]);
    for (const cat of ['hype', 'kill-', 'corpsevoice', 'carn10', 'bossrewardx']) expect(H.voiceOf('zz-unmapped', cat)[1], cat).toBe('UNKNOWN CALLER');
  });

  it('leaves the other callers on their clip names', () => {
    expect(H.voiceOf('stop-killing-me-matty-1', 'corpsevoice')[1]).toBe('CREWMAN #5 // DECEASED');
    expect(H.voiceOf('lesley-yeah-baby-matty-1', 'startgame')[1]).toBe('LESLEY, MISSION CONTROL');
  });
});

describe('a midboss kill word', () => {
  it('plays its folder and opens the comms window with his face, not a Reticulan', () => {
    A.BANK['kill-ufo'] = take('calamari-served-matty-1');
    expect(A.sample('kill-ufo', { at: .45 })).toBe(true);
    expect(A.AU.voice.cat).toBe('kill-ufo');
    expect(srcs[0].at).toBeCloseTo(.45, 5); // the roar gets the first beat
    expect(frames(.1).size).toBe(0); // no window before the word is nearly due (vLive's .3 s lead)
    expect(frames(.5)).toEqual(new Set(['slab']));
    expect(tags()).toContain(SLAB);
  });

  it('stays silent with no window when its folder is empty', () => {
    expect(A.sample('kill-brood', { at: .45 })).toBe(false);
    expect(srcs.length).toBe(0);
    expect(A.AU.voice).toBeNull();
    expect(frames(.5).size).toBe(0);
    expect(tags()).toEqual([]);
  });

  it('is fired inside the midboss branch of killEnemy, after the kill word banner', () => {
    const src = code('src/enemies/update.ts');
    const block = src.slice(src.indexOf('if (e.mid) {'), src.indexOf('firstKill(e);'));
    expect(block).toMatch(/banner\(M\?\.word[\s\S]*sample\('kill-' \+ e\.k, \{[^}]*at: KILL_WORD_AT/);
  });

  it('has a folder name for every midboss kind with a kill word in the shipped roster', async () => {
    const { ROSTER } = await import('../../src/enemies/mid/roster');
    for (const k of KILLS) expect(ROSTER.map((r: any) => r.k), k).toContain(k);
  });
});

describe('one caller at a time', () => {
  it('queues a kill word behind a line still talking; that caller keeps the window, then he takes it', () => {
    A.BANK.corpsevoice = take('stop-killing-me-matty-1', 2);
    A.BANK['kill-cyst'] = take('burst-matty-1');
    A.sample('corpsevoice');
    const end = A.AU.voice.t1;
    A.AU.c.currentTime = .5;
    A.sample('kill-cyst', { at: .45 });
    expect(srcs[1].at).toBeCloseTo(end + A.VOICE_GAP, 5);
    expect(A.AU.voiceQ.map((v: any) => v.cat)).toEqual(['corpsevoice', 'kill-cyst']);
    expect(frames(1)).toEqual(new Set(['hface'])); // the crewman, mid-sentence
    expect(tags()).toContain('CREWMAN #5 // DECEASED');
    core.ctx.drawImage.mockClear();
    core.ctx.fillText.mockClear();
    expect(frames(A.AU.voice.t0 + .1, 40)).toEqual(new Set(['slab']));
    expect(tags()).toContain(SLAB);
  });

  it('does not delay a line when nobody is talking any more', () => {
    A.BANK.hype10 = take('x', 1);
    A.BANK['kill-ufo'] = take('y');
    A.sample('hype10');
    A.AU.c.currentTime = 2;
    A.sample('kill-ufo', { at: .45 });
    expect(srcs[1].at).toBeCloseTo(2.45, 5);
    expect(A.AU.voiceQ.map((v: any) => v.cat)).toEqual(['kill-ufo']); // the finished line has left the queue
  });

  it("leaves a beat of air even when the line ahead ends inside the kill word's own delay", () => {
    A.BANK.hype10 = take('x', 1);
    A.BANK['kill-ufo'] = take('y');
    A.sample('hype10', { spread: 0 }); // no rate jitter: it ends at exactly 1 s
    A.AU.c.currentTime = .7; // .7 + .45 lands .15 s after the hype line ends, short of VOICE_GAP
    A.sample('kill-ufo', { at: .45 });
    expect(srcs[1].at).toBeCloseTo(1 + A.VOICE_GAP, 5);
  });

  it('keeps the talking line on the window three lines deep, with no chain caption to fall back on', () => {
    A.BANK.corpsevoice = take('stop-killing-me-matty-1', 2);
    A.BANK['kill-cyst'] = take('burst-matty-1');
    A.BANK.bossreward = take('taken-down-matty-1');
    A.sample('corpsevoice');
    A.AU.c.currentTime = .2;
    A.sample('kill-cyst', { at: .45 });
    A.sample('bossreward');
    expect(frames(1.5)).toEqual(new Set(['hface']));
    expect(tags()).toContain('CREWMAN #5 // DECEASED');
  });

  it("shows a chain's caption from its hype call while its line waits behind another caller", () => {
    A.BANK['kill-ufo'] = take('calamari-served-matty-1', 2);
    A.BANK.hype10 = take('that-one-had-a-name-matty-1');
    A.sample('kill-ufo');
    $.G.hype = { L: ['THAT ONE', 'HAD A NAME'], t: 240, ml: 240 };
    A.sample('hype10');
    frames(.5, 30);
    expect(core.ctx.fillText.mock.calls.map((c: any[]) => c[0])).toContain('THAT ONE');
  });

  it('gets a kill word past a full voice cap (the death frame is the busiest gore frame), evicting an ordinary sound', () => {
    A.BANK.splat_s = take('splat', 5);
    A.BANK['kill-ufo'] = take('calamari-served-matty-1');
    for (let i = 0; i < A.VOICE_CAP; i++) A.sample('splat_s');
    expect(A.sample('kill-ufo')).toBe(true);
    expect(srcs[srcs.length - 1].buffer.clip).toBe('calamari-served-matty-1');
    expect(A.AU.voice.cat).toBe('kill-ufo');
  });

});

describe('OPENED, the 5-chain', () => {
  const chain5 = () => { $.G.combo = 5; $.G.cMile = 0; $.G.comboT = 60; FX.updateCombo(); };

  it('plays carn5 in his voice and opens the window', () => {
    A.BANK.carn5 = take('opened-matty-1');
    chain5();
    expect($.G.carn.w).toBe('OPENED');
    expect(A.AU.voice.cat).toBe('carn5');
    expect(frames(.1)).toEqual(new Set(['slab']));
    expect(tags()).toContain(SLAB);
  });

  it('is silent with no window while carn5 is empty', () => {
    chain5();
    expect($.G.carn.w).toBe('OPENED');
    expect(srcs.length).toBe(0);
    expect(frames(.1).size).toBe(0);
  });

  it('is skipped while another line talks, and a skip does not start its cooldown', () => {
    A.BANK.hype10 = take('x', 2);
    A.BANK.carn5 = take('opened-matty-1');
    A.sample('hype10');
    chain5();
    expect(srcs.length).toBe(1);
    A.AU.c.currentTime = 3;
    chain5();
    expect(srcs.length).toBe(2);
    expect(A.AU.voice.cat).toBe('carn5');
  });

  it('speaks at most once per OPENED_GAP of audio time', () => {
    A.BANK.carn5 = take('opened-matty-1', .5);
    chain5();
    A.AU.c.currentTime = 5;
    chain5();
    expect(srcs.length).toBe(1);
    A.AU.c.currentTime = FX.OPENED_GAP + .1;
    chain5();
    expect(srcs.length).toBe(2);
  });

  it('draws nothing from the sim RNG (R is Math.random) with the folders full, empty, or no audio at all (the harness)', async () => {
    const rnd = vi.spyOn(Math, 'random');
    await load(); // R now is the spy
    expect(core.R).toBe(Math.random);
    rnd.mockClear(); // module setup draws at import; only the act below counts
    chain5();
    A.sample('kill-ufo', { at: .45 });
    A.BANK.carn5 = take('opened-matty-1');
    A.BANK['kill-ufo'] = take('calamari-served-matty-1');
    $.G.combo = 0; $.G.cMile = 0;
    chain5();
    A.sample('kill-ufo', { at: .45 });
    A.AU.c = null;
    expect(A.sample('kill-ufo')).toBe(false);
    expect(srcs.length).toBe(2);
    expect(rnd).not.toHaveBeenCalled();
    rnd.mockRestore();
    // render's srnd() tear draws only run with a live voice, which needs an AudioContext the harness doesn't have
  });
});

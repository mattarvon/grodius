// LS2-quips: SGT. RAMROD SLAB's one-liners after a big kill. Story type: Logic (BLOCKING), tests/unit/quips.test.ts.
// The pure rules of src/voice/quiplist.ts (pickQuip, the caption rules, ids, the list parse), the shipped list, and
// audio.ts quipAfterKill driven through a stubbed BANK and a fake AudioContext (the slabvoice.test.ts setup): when a
// quip plays, that it queues behind the kill word, never repeats, never echoes the kill word, and never draws the sim
// RNG. Plus render/hype.ts voiceOf for quip folders and source pins on the two call sites.
import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubDom } from './fakecanvas';
import RAW from '../../src/voice/quips.json';
import {
  QUIP, QUIP_ID_MAX, QUIP_LINE_MAX, newId, normText, parseQuips, pickQuip, quipLines, textError,
} from '../../src/voice/quiplist';

/** a counting rnd() that returns the given values in turn */
function seq(...v: number[]) {
  let i = 0;
  const f = Object.assign(() => { f.n++; return v[Math.min(i++, v.length - 1)]; }, { n: 0 });
  return f;
}

describe('pickQuip', () => {
  const bag = (q: string[] = [], last: string | null = null) => ({ q, last });

  it('returns null with no rnd() draw when nothing is recorded', () => {
    const r = seq(0);
    expect(pickQuip([], bag(), r)).toBeNull();
    expect(r.n).toBe(0);
  });

  it('returns null with no rnd() draw when every recorded quip is avoided', () => {
    const r = seq(0);
    expect(pickQuip(['a', 'b'], bag(), r, 1, ['a', 'b'])).toBeNull();
    expect(r.n).toBe(0);
  });

  it('plays when the roll is just under the chance and not when it is at the chance', () => {
    expect(pickQuip(['a'], bag(), seq(QUIP.chance.mid - 1e-9, 0))).toBe('a');
    expect(pickQuip(['a'], bag(), seq(QUIP.chance.mid, 0))).toBeNull();
  });

  it('draws one roll on a miss, and on a hit only the roll while the bag has a quip left', () => {
    const miss = seq(.99), hit = seq(0), b = bag(['a', 'b', 'c']);
    expect(pickQuip(['a', 'b', 'c'], b, miss)).toBeNull();
    expect(miss.n).toBe(1);
    expect(b.q).toEqual(['a', 'b', 'c']); // a miss leaves the bag alone
    expect(pickQuip(['a', 'b', 'c'], b, hit)).toBe('c');
    expect(hit.n).toBe(1);
  });

  it('plays every recorded quip once before any repeats', () => {
    const b = bag(), ids = ['a', 'b', 'c', 'd', 'e'], r = seq(0, .9, .1, .7, .3, .5);
    const round = Array.from({ length: 5 }, () => pickQuip(ids, b, () => (r() + 0) % 1, 1));
    expect(new Set(round)).toEqual(new Set(ids));
  });

  it('never opens a new bag with the last one said, whatever the shuffle', () => {
    for (const p of [0, .25, .5, .75, .999999]) {
      const b = bag([], 'b');
      expect(pickQuip(['a', 'b', 'c'], b, seq(0, p, p), 1)).not.toBe('b');
    }
  });

  it('returns the only ready quip even when it was the last one', () => {
    expect(pickQuip(['a'], bag([], 'a'), seq(0, .9), 1)).toBe('a');
    expect(pickQuip(['a', 'b'], bag(['b'], 'a'), seq(0, .9), 1, ['b'])).toBe('a');
  });

  it('never indexes past the bag when rnd() returns its top value', () => {
    const b = bag();
    expect(['a', 'b']).toContain(pickQuip(['a', 'b'], b, seq(0, 1), 1));
  });

  it('never picks an avoided quip, and keeps it in the bag for the next kill', () => {
    const b = bag(['b', 'c', 'a']);
    expect(pickQuip(['a', 'b', 'c'], b, seq(0), 1, ['a'])).toBe('c');
    expect(b.q).toContain('a');
    expect(pickQuip(['a', 'b', 'c'], b, seq(0), 1)).toBe('a');
  });

  it('drops a quip that is no longer recorded from the bag', () => {
    const b = bag(['a', 'gone']);
    expect(pickQuip(['a'], b, seq(0), 1)).toBe('a');
    expect(b.q).toEqual([]);
  });
});

describe('normText', () => {
  it('upper-cases, collapses spaces and spaces the line split', () => {
    expect(normText('  rest   in pieces ')).toBe('REST IN PIECES');
    expect(normText('no guts/all glory')).toBe('NO GUTS / ALL GLORY');
    expect(normText('no guts   /   all glory')).toBe('NO GUTS / ALL GLORY');
  });

  it('turns null, undefined and non-strings into a string without throwing', () => {
    expect(normText(null)).toBe('');
    expect(normText(undefined)).toBe('');
    expect(normText(42)).toBe('42');
  });
});

describe('textError', () => {
  it('accepts a one-line and a two-line caption', () => {
    expect(textError('CLOSED CASKET')).toBeNull();
    expect(textError('NO GUTS / ALL GLORY')).toBeNull();
  });

  it('refuses an empty caption', () => {
    expect(textError('')).toBe('empty');
  });

  it("refuses '!' and lower case", () => {
    expect(textError(normText('calamari served!'))).toMatch(/only/);
    expect(textError('closed casket')).toMatch(/only/);
  });

  it('refuses markup characters', () => {
    expect(textError('<B>HI</B>')).toMatch(/only/);
  });

  it('refuses three lines', () => {
    expect(textError(normText('a / b / c'))).toMatch(/at most 2 lines/);
    expect(textError(normText('a // b'))).toMatch(/at most 2 lines/);
  });

  it('accepts a line of exactly the maximum and refuses one character more', () => {
    expect(textError('A'.repeat(QUIP_LINE_MAX))).toBeNull();
    expect(textError('A'.repeat(QUIP_LINE_MAX + 1))).toMatch(/characters a line/);
    expect(textError('OK / ' + 'B'.repeat(QUIP_LINE_MAX + 1))).toMatch(/characters a line/);
  });

  // qa-tester's find: a leading or trailing '/' was accepted and drawn as a stray slash in the caption
  it("refuses a '/' with no line on one side", () => {
    expect(textError(normText('closed casket /'))).not.toBeNull();
    expect(textError(normText('/ closed casket'))).not.toBeNull();
  });
});

describe('quipLines', () => {
  it('splits on the line split and trims', () => {
    expect(quipLines('NO GUTS / ALL GLORY')).toEqual(['NO GUTS', 'ALL GLORY']);
    expect(quipLines('CLOSED CASKET')).toEqual(['CLOSED CASKET']);
    expect(quipLines('')).toEqual([]);
  });
});

describe('newId', () => {
  it('slugs the words', () => {
    expect(newId('NO GUTS / ALL GLORY', [])).toBe('no-guts-all-glory');
    expect(newId("IT'S. OVER?", [])).toBe('it-s-over');
  });

  it('dedupes with -2 then -3', () => {
    expect(newId('CLOSED CASKET', ['closed-casket'])).toBe('closed-casket-2');
    expect(newId('CLOSED CASKET', ['closed-casket', 'closed-casket-2'])).toBe('closed-casket-3');
  });

  it('keeps every id within the maximum length, deduped or not, with no trailing dash', () => {
    const text = 'A '.repeat(20) + 'LONG QUIP';
    const ids: string[] = [];
    for (let k = 0; k < 9; k++) ids.push(newId(text, ids));
    for (const id of ids) {
      expect(id.length).toBeLessThanOrEqual(QUIP_ID_MAX);
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("falls back to 'quip' for words with no letters or digits", () => {
    expect(newId('', [])).toBe('quip');
    expect(newId('?? ..', [])).toBe('quip');
    expect(newId('', ['quip'])).toBe('quip-2');
  });
});

describe('parseQuips', () => {
  it('never throws on a non-array and says why', () => {
    for (const raw of [null, undefined, 'x', 3, { id: 'a', text: 'A' }]) {
      const r = parseQuips(raw);
      expect(r.quips).toEqual([]);
      expect(r.errors).toEqual(['quips.json is not a list']);
    }
  });

  it('normalises the text and trims the note', () => {
    expect(parseQuips([{ id: 'a', text: 'closed  casket', note: '  dry  ' }]).quips).toEqual([{ id: 'a', text: 'CLOSED CASKET', note: 'dry' }]);
    expect(parseQuips([{ id: 'a', text: 'A', note: '   ' }]).quips).toEqual([{ id: 'a', text: 'A' }]);
  });

  it('drops bad and duplicate rows with one error each, keeping the first of a duplicate', () => {
    const r = parseQuips([
      { id: 'ok', text: 'FINE' },
      { id: 'Bad Id', text: 'X' },
      { id: 'x'.repeat(QUIP_ID_MAX + 1), text: 'X' },
      { id: 7, text: 'X' },
      null,
      { id: 'ok', text: 'SECOND' },
      { id: 'loud', text: 'LOUD!' },
      { id: 'three', text: 'A / B / C' },
    ]);
    expect(r.quips).toEqual([{ id: 'ok', text: 'FINE' }]);
    expect(r.errors).toHaveLength(7);
    expect(r.errors[4]).toMatch(/row 6: duplicate id ok/);
  });
});

describe('the shipped quip list', () => {
  it('parses with no errors: nine quips, CALAMARI SERVED as calamari-served', () => {
    const { quips, errors } = parseQuips(RAW);
    expect(errors).toEqual([]);
    expect(quips).toHaveLength(9);
    expect(quips.find((q) => q.id === 'calamari-served')?.text).toBe('CALAMARI SERVED');
  });
});

// ---------------- the game side: audio.ts quipAfterKill, render/hype.ts voiceOf ----------------
let A: any, H: any, $: any, SET: any, rand: any;
type Src = { buffer: any; at: number | null; stopped: boolean };
let srcs: Src[];
const param = () => ({ value: 0, setValueAtTime() {}, setTargetAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
const node = () => ({ connect() {}, disconnect() {} });
function fakeCtx() {
  return {
    state: 'running',
    currentTime: 0,
    createBufferSource() {
      const s: any = { ...node(), buffer: null, playbackRate: param(), at: null, stopped: false, onended: null, start(t: number) { s.at = t; }, stop(t?: number) { s.stopped = true; s.stopAt = t; } };
      srcs.push(s);
      return s;
    },
    createGain: () => ({ ...node(), gain: param() }),
    createOscillator: () => ({ ...node(), type: '', frequency: param(), start() {}, stop() {} }),
    createBiquadFilter: () => ({ ...node(), type: '', frequency: param(), Q: param() }),
  };
}
const take = (stem: string, duration = 1) => [{ duration, clip: stem }];
const SLAB = 'SGT. RAMROD SLAB';
const code = (f: string) => readFileSync(new URL('../../' + f, import.meta.url), 'utf8');

beforeAll(() => stubDom());
afterAll(() => vi.unstubAllGlobals());
/** fresh modules; Math.random is spied before the import so core.ts's R captures the spy */
/** the audio RNG's boot seed (audio.ts: crypto.getRandomValues), pinned so every roll in this file is the same each run
 *  (qa-lead: no unpinned randomness) */
const AUDIO_SEED = 0x9e3779b9;
async function load() {
  vi.resetModules();
  vi.stubGlobal('crypto', { getRandomValues: (a: Uint32Array) => { a[0] = AUDIO_SEED; return a; } });
  rand = vi.spyOn(Math, 'random');
  ({ $ } = await import('../../src/state'));
  ({ SET } = await import('../../src/save'));
  A = await import('../../src/audio');
  H = await import('../../src/render/hype');
  srcs = [];
  $.G = {};
  $.T = 0;
  A.AU.c = fakeCtx();
  A.AU.m = node();
  A.AU.verb = node();
  A.AU.voice = null;
  A.AU.voiceQ = [];
  SET.muted = false;
  for (const k of Object.keys(A.BANK)) delete A.BANK[k];
}
afterEach(() => rand?.mockRestore());

describe('quipAfterKill', () => {
  beforeEach(load);

  it('fires a quip-* sample when a quip folder has takes, and returns its id', () => {
    A.BANK['quip-closed-casket'] = take('closed-casket-matty-1');
    expect(A.quipAfterKill('', 0, true)).toBe('closed-casket');
    expect(A.AU.lastCat).toBe('quip-closed-casket');
    expect(srcs).toHaveLength(1);
  });

  it('is silent and returns null with an empty bank, even forced', () => {
    expect(A.quipAfterKill('', 0, true)).toBeNull();
    expect(srcs).toHaveLength(0);
  });

  it('ignores takes in a quip folder that is not in the list', () => {
    A.BANK['quip-not-a-quip'] = take('not-a-quip-matty-1');
    expect(A.quipAfterKill('', 0, true)).toBeNull();
  });

  it('is silent and returns null with no context, a suspended one, or muted', () => {
    A.BANK['quip-closed-casket'] = take('closed-casket-matty-1');
    const c = A.AU.c;
    A.AU.c = null;
    expect(A.quipAfterKill('', 0, true)).toBeNull();
    A.AU.c = { ...c, state: 'suspended' };
    expect(A.quipAfterKill('', 0, true)).toBeNull();
    A.AU.c = c;
    SET.muted = true;
    expect(A.quipAfterKill('', 0, true)).toBeNull();
    expect(srcs).toHaveLength(0);
  });

  it('always plays when forced and one is recorded', () => {
    A.BANK['quip-dead-weight'] = take('dead-weight-matty-1');
    for (let k = 0; k < 20; k++) {
      expect(A.quipAfterKill('', 0, true)).toBe('dead-weight');
      A.voiceStopAll();
    }
  });

  it('never says the same quip twice running with two recorded', () => {
    A.BANK['quip-closed-casket'] = take('a');
    A.BANK['quip-dead-weight'] = take('b');
    const said: string[] = [];
    for (let k = 0; k < 30; k++) said.push(A.quipAfterKill('', 0, true));
    for (let k = 1; k < said.length; k++) expect(said[k]).not.toBe(said[k - 1]);
    expect(new Set(said)).toEqual(new Set(['closed-casket', 'dead-weight']));
  });

  it('skips the quip whose words are the kill word just said', () => {
    A.BANK['quip-calamari-served'] = take('calamari-served-matty-1');
    A.BANK['quip-rest-in-pieces'] = take('rest-in-pieces-matty-1');
    for (let k = 0; k < 20; k++) {
      expect(A.quipAfterKill('CALAMARI SERVED', 0, true)).toBe('rest-in-pieces');
      A.voiceStopAll();
    }
  });

  it('is silent when the only recorded quip is the kill word', () => {
    A.BANK['quip-calamari-served'] = take('calamari-served-matty-1');
    expect(A.quipAfterKill('calamari served', 0, true)).toBeNull();
    expect(srcs).toHaveLength(0);
  });

  it('queues behind the kill word on the audio clock', () => {
    A.BANK['kill-ufo'] = take('calamari-served-matty-1', 1);
    A.BANK['quip-closed-casket'] = take('closed-casket-matty-1', 1);
    A.sample('kill-ufo', { at: .45 });
    const end = A.AU.voice.t1;
    expect(A.quipAfterKill('CALAMARI SERVED', .45, true)).toBe('closed-casket');
    expect(srcs[1].at).toBeGreaterThanOrEqual(end + A.VOICE_GAP - 1e-9);
    expect(A.AU.voiceQ.map((v: any) => v.cat)).toEqual(['kill-ufo', 'quip-closed-casket']);
  });

  it('never calls Math.random (the sim RNG), hit or miss', () => {
    A.BANK['kill-ufo'] = take('k');
    A.BANK['quip-closed-casket'] = take('a');
    A.BANK['quip-dead-weight'] = take('b');
    rand.mockClear();
    for (let k = 0; k < 50; k++) {
      A.sample('kill-ufo', { at: .45 });
      A.quipAfterKill('CALAMARI SERVED', .45);
      A.quipAfterKill('TAKEN DOWN', 0, true);
      A.voiceStopAll();
    }
    expect(rand).not.toHaveBeenCalled();
  });

  // seeded (AUDIO_SEED): the same rolls every run, so the counts below are exact for this seed; the band is what the
  // rule promises (sd at n=200 is ~0.034, so any seed lands inside it)
  for (const [moment, p] of Object.entries(QUIP.chance)) it(`hits at about QUIP.chance.${moment} (${p}) over 200 kills`, () => {
    A.BANK['quip-closed-casket'] = take('a');
    A.BANK['quip-dead-weight'] = take('b');
    let hits = 0;
    for (let k = 0; k < 200; k++) {
      if (A.quipAfterKill('TAKEN DOWN', 0, false, { moment }) != null) hits++;
      A.voiceStopAll();
    }
    expect(hits / 200).toBeGreaterThan(p - .14);
    expect(hits / 200).toBeLessThan(p + .14);
  });

  it('rolls the same with the same audio seed (no unpinned randomness)', async () => {
    const run = async () => {
      await load();
      A.BANK['quip-closed-casket'] = take('a');
      A.BANK['quip-dead-weight'] = take('b');
      const out: (string | null)[] = [];
      for (let k = 0; k < 40; k++) { out.push(A.quipAfterKill('TAKEN DOWN')); A.voiceStopAll(); }
      return out;
    };
    expect(await run()).toEqual(await run());
  });

  it('is dropped at game over while still queued', () => {
    A.BANK['kill-ufo'] = take('k', 1);
    A.BANK['quip-closed-casket'] = take('a', 1);
    A.sample('kill-ufo', { at: .45 });
    A.quipAfterKill('', .45, true);
    A.AU.c.currentTime = .6; // the kill word is talking, the quip waits
    A.voiceDropQueued();
    expect(srcs[1].stopped).toBe(true);
    expect(srcs[0].stopped).toBe(false);
    expect(A.AU.voiceQ.map((v: any) => v.cat)).toEqual(['kill-ufo']);
    expect(A.AU.voice.cat).toBe('kill-ufo');
  });

  it('is stopped by a new game once talking', () => {
    A.BANK['quip-closed-casket'] = take('a', 1);
    A.quipAfterKill('', 0, true);
    A.AU.c.currentTime = .3;
    A.voiceStopAll();
    expect(srcs[0].stopped).toBe(true);
    expect(A.AU.voice).toBeNull();
    expect(A.AU.voiceQ).toEqual([]);
  });

  // audio-director's queue rules (LS2-quips review): flavour never delays feedback or lands in the next fight
  it('follows its own kill word: plays within 100 kills when only that word is on the comms', () => {
    A.BANK['kill-ufo'] = take('k', 1);
    A.BANK['quip-closed-casket'] = take('a', 1);
    let hit = null;
    for (let k = 0; k < 100 && hit == null; k++) {
      A.voiceStopAll();
      A.sample('kill-ufo', { at: .45 });
      hit = A.quipAfterKill('CALAMARI SERVED', .45);
    }
    expect(hit).toBe('closed-casket');
  });

  it('is skipped with no roll drawn while another line besides its kill word is on the comms', () => {
    A.BANK['hype10'] = take('h', 1);
    A.BANK['kill-ufo'] = take('k', 1);
    A.BANK['quip-closed-casket'] = take('a', 1);
    A.sample('hype10');
    A.sample('kill-ufo', { at: .45 });
    const n = srcs.length;
    for (let k = 0; k < 100; k++) expect(A.quipAfterKill('CALAMARI SERVED', .45)).toBeNull();
    expect(srcs).toHaveLength(n);
  });

  it('is skipped when a non-kill line alone is talking (a chain line, not its trigger)', () => {
    A.BANK['hype10'] = take('h', 1);
    A.BANK['quip-closed-casket'] = take('a', 1);
    A.sample('hype10');
    for (let k = 0; k < 100; k++) expect(A.quipAfterKill('TAKEN DOWN')).toBeNull();
  });

  it(`is skipped when it could not start within QUIP.maxLate.mid (${QUIP.maxLate.mid} s) of the kill`, () => {
    A.BANK['kill-ufo'] = take('k', QUIP.maxLate.mid); // .45 + maxLate + the gap: past the limit
    A.BANK['quip-closed-casket'] = take('a', 1);
    for (let k = 0; k < 100; k++) {
      A.voiceStopAll();
      A.sample('kill-ufo', { at: .45 });
      expect(A.quipAfterKill('CALAMARI SERVED', .45)).toBeNull();
    }
    expect(srcs.every((x: any) => x.buffer.clip === 'k')).toBe(true);
  });

  it('gives its place to any other voice line called before it starts', () => {
    A.BANK['kill-ufo'] = take('k', 1);
    A.BANK['quip-closed-casket'] = take('a', 1);
    A.BANK['hype10'] = take('h', 1);
    A.sample('kill-ufo', { at: .45 });
    A.quipAfterKill('', .45, true);
    const kwEnd = A.AU.voiceQ[0].t1;
    A.sample('hype10'); // the chain line lands while the quip still waits
    expect(srcs[1].stopped).toBe(true);
    expect(A.AU.voiceQ.map((v: any) => v.cat)).toEqual(['kill-ufo', 'hype10']);
    expect(srcs[2].at).toBeCloseTo(kwEnd + A.VOICE_GAP, 6); // straight behind the kill word, not behind the quip
  });

  it('lets a quip already talking finish when another line is called', () => {
    A.BANK['quip-closed-casket'] = take('a', 1);
    A.BANK['hype10'] = take('h', 1);
    A.quipAfterKill('', 0, true);
    A.AU.c.currentTime = .3;
    A.sample('hype10');
    expect(srcs[0].stopped).toBe(false);
    expect(A.AU.voiceQ.map((v: any) => v.cat)).toEqual(['quip-closed-casket', 'hype10']);
  });

  it('stays queued when OPENED is skipped behind the kill word (an OPENED that does not play takes nothing)', () => {
    A.BANK['kill-ufo'] = take('k', 1);
    A.BANK['quip-closed-casket'] = take('a', 1);
    A.BANK['carn5'] = take('o', .6);
    A.sample('kill-ufo', { at: .45 });
    A.quipAfterKill('', .45, true);
    A.AU.c.currentTime = .6; // the kill word is talking
    expect(A.sample('carn5', { queue: false })).toBe(false);
    expect(srcs[1].stopped).toBeFalsy();
    expect(A.AU.voiceQ.map((v: any) => v.cat)).toEqual(['kill-ufo', 'quip-closed-casket']);
    expect(A.AU.voice.cat).toBe('quip-closed-casket');
  });

  it('gives its place to an OPENED that would play at once (the comms otherwise clear)', () => {
    A.BANK['quip-closed-casket'] = take('a', 1);
    A.BANK['carn5'] = take('o', .6);
    A.quipAfterKill('', .45, true); // queued for .45, nothing talking
    expect(A.sample('carn5', { queue: false })).toBe(true);
    expect(srcs[0].stopped).toBe(true);
    expect(A.AU.voiceQ.map((v: any) => v.cat)).toEqual(['carn5']);
  });

  it('avoids every readout the moment may have shown', () => {
    A.BANK['quip-calamari-served'] = take('a');
    A.BANK['quip-rest-in-pieces'] = take('b');
    for (let k = 0; k < 10; k++) {
      expect(A.quipAfterKill(['TAKEN DOWN', 'CALAMARI SERVED'], 0, true)).toBe('rest-in-pieces');
      A.voiceStopAll();
    }
  });

  it('goes round every recorded quip before repeating, across calls', () => {
    const ids = ['closed-casket', 'dead-weight', 'rest-in-pieces'];
    for (const id of ids) A.BANK['quip-' + id] = take(id);
    const said: string[] = [];
    for (let k = 0; k < 3; k++) { said.push(A.quipAfterKill('', 0, true)); A.voiceStopAll(); }
    expect(new Set(said)).toEqual(new Set(ids));
  });
});

describe('voiceOf for a quip folder', () => {
  beforeEach(load);

  it("gives SLAB's face, tag and the quip's own words as the caption", () => {
    expect(H.voiceOf('x-matty-1', 'quip-closed-casket')).toEqual([-1, SLAB, ['CLOSED CASKET']]);
    expect(H.voiceOf('x-matty-1', 'quip-no-guts-all-glory')).toEqual([-1, SLAB, ['NO GUTS', 'ALL GLORY']]);
  });

  it('still gives SLAB, with no caption, for a quip folder not in the list', () => {
    expect(H.voiceOf('x-matty-1', 'quip-gone')).toEqual([-1, SLAB]);
  });
});

describe('the studio review batch (LS2-quips)', () => {
  beforeEach(load);

  it('fades a talking quip over VOICE_CUT on a death, while the kill word talking with it finishes', () => {
    A.BANK['kill-ufo'] = take('k', 1);
    A.BANK['quip-closed-casket'] = take('a', 1);
    A.BANK['hype10'] = take('h', 1);
    A.quipAfterKill('', 0, true); // the quip talks now
    A.AU.c.currentTime = .3;
    A.voiceCutQuips();
    expect(srcs[0].stopped).toBe(true);
    expect(srcs[0].stopAt).toBeCloseTo(.3 + A.VOICE_CUT, 6);
    expect(A.AU.voiceQ).toEqual([]);
    expect(A.AU.voice).toBeNull();
    // a kill word talking at the death is not a quip: it finishes (D50)
    A.sample('kill-ufo');
    A.AU.c.currentTime = .5;
    A.voiceCutQuips();
    expect(srcs[1].stopped).toBeFalsy();
    expect(A.AU.voice.cat).toBe('kill-ufo');
  });

  it('drops a quip still queued behind the kill word at a death, and the kill word finishes', () => {
    A.BANK['kill-ufo'] = take('k', 1);
    A.BANK['quip-closed-casket'] = take('a', 1);
    A.sample('kill-ufo', { at: .45 });
    A.quipAfterKill('', .45, true);
    A.AU.c.currentTime = .6;
    A.voiceCutQuips();
    expect(srcs[1].stopped).toBe(true);
    expect(srcs[0].stopped).toBeFalsy();
    expect(A.AU.voiceQ.map((v: any) => v.cat)).toEqual(['kill-ufo']);
  });

  it('is cut on every lost life and at game over (flow.ts killPlayer and gameOver)', () => {
    const f = code('src/flow.ts');
    const body = (name: string) => f.slice(f.indexOf(`export function ${name}(`), f.indexOf('\nexport function', f.indexOf(`export function ${name}(`) + 10));
    expect(body('killPlayer')).toMatch(/\$\.P\.alive = false;[\s\S]*voiceCutQuips\(\)/);
    expect(body('gameOver')).toMatch(/voiceDropQueued\(\);[^\n]*\n\s*voiceCutQuips\(\);/);
  });

  it('counts a stage-boss quip late from the death: a bossreward take at its booth warning still leaves room', () => {
    A.BANK['bossreward'] = take('r', 2.5); // TAKEN DOWN at its warning: 2 s target + 0.5 slack
    A.BANK['quip-closed-casket'] = take('a', 1);
    let hit = null;
    for (let k = 0; k < 100 && hit == null; k++) {
      A.voiceStopAll();
      A.sample('bossreward');
      hit = A.quipAfterKill('TAKEN DOWN', 0, false, { moment: 'boss', since: 50 / 60 });
    }
    expect(hit).toBe('closed-casket');
  });

  it('skips a stage-boss quip past QUIP.maxLate.boss from the death', () => {
    A.BANK['bossreward'] = take('r', QUIP.maxLate.boss);
    A.BANK['quip-closed-casket'] = take('a', 1);
    for (let k = 0; k < 100; k++) {
      A.voiceStopAll();
      A.sample('bossreward');
      expect(A.quipAfterKill('TAKEN DOWN', 0, false, { moment: 'boss', since: 50 / 60 })).toBeNull();
    }
  });

  it('keeps the gate boss (GATE SEALED) in play past BOSS_REWARD_WAIT, so it gets its quip too', () => {
    const clearT = +/\$\.G\.clearT = (\d+);/.exec(code('src/boss/update.ts'))![1];
    const wait = +/export const BOSS_REWARD_WAIT = (\d+);/.exec(code('src/stages.ts'))![1];
    expect(clearT).toBeGreaterThan(wait); // endLoop (the shop) comes clearT frames after the gate boss dies
    expect(code('src/step.ts')).toMatch(/\$\.state === 'play' && \$\.G\.clearT > 0 && --\$\.G\.clearT === 0\) endLoop\(\)/);
  });

  it('leaves a queued quip alone when a solo line returns early still talking (drop only for a line that plays)', () => {
    A.BANK['corpsevoice'] = take('c', 1);
    A.BANK['quip-closed-casket'] = take('a', 1);
    A.sample('corpsevoice', { solo: true }); // talking until 1
    A.quipAfterKill('', 0, true); // queued behind it
    A.AU.c.currentTime = .2;
    expect(A.sample('corpsevoice', { solo: true })).toBe(true); // the previous take still talks: early return
    expect(srcs[1].stopped).toBeFalsy();
    expect(A.AU.voiceQ.map((v: any) => v.cat)).toEqual(['corpsevoice', 'quip-closed-casket']);
  });
});

describe('the call sites', () => {
  it('enemies/update.ts calls quipAfterKill with the kill word right after the kill-word sample', () => {
    expect(code('src/enemies/update.ts')).toMatch(/sample\('kill-' \+ e\.k, \{[^}]*at: KILL_WORD_AT \}\);\s*(\/\/[^\n]*\n\s*)*quipAfterKill\(M\?\.word, KILL_WORD_AT\);/);
  });

  it('stages.ts calls quipAfterKill with every stage-boss readout right after the bossreward sample, only in play', () => {
    const st = code('src/stages.ts');
    expect(st).toMatch(/if \(\$\.state !== 'play'\) return; sample\('bossreward', \{[^}]*\}\); quipAfterKill\(BOSS_READOUTS, 0, false, \{ moment: 'boss', since: BOSS_REWARD_WAIT \/ 60 \}\);/);
    expect(st).toMatch(/G\.pend\.push\(\{ t: BOSS_REWARD_WAIT, f: \(\) => \{ if \(\$\.state !== 'play'\) return; sample\('bossreward'/);
    expect(st).toContain("const BOSS_READOUTS = ['TAKEN DOWN', 'TORN APART', 'GATE SEALED'] as const;");
    // each readout is a banner a stage-boss kill really shows
    const shown = code('src/enemies/update.ts') + code('src/boss/update.ts');
    for (const w of ['TAKEN DOWN', 'TORN APART', 'GATE SEALED']) expect(shown).toContain(`banner('${w}'`);
  });

  it('neither call site line nor quipAfterKill draws R( or Math.random', () => {
    const upd = code('src/enemies/update.ts'), st = code('src/stages.ts'), au = code('src/audio.ts');
    const line = (src: string, needle: string) => src.split('\n').find((l) => l.includes(needle) && !l.trim().startsWith('//'))!;
    for (const l of [line(upd, 'quipAfterKill(M'), line(st, 'quipAfterKill(BOSS_READOUTS'), line(upd, "sample('kill-' + e.k")]) {
      expect(l).toBeDefined();
      expect(l).not.toMatch(/\bR\(|Math\.random/);
    }
    const fn = au.slice(au.indexOf('export function quipAfterKill'), au.indexOf('export function voiceOn'));
    expect(fn.length).toBeGreaterThan(100);
    expect(fn).not.toMatch(/\bR\(|Math\.random/);
    expect(fn).toMatch(/pickQuip\(ready, QBAG, ar,/);
  });
});

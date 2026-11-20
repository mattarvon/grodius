// The booth's reprocess (tools/booth/plugin.ts reprocess) on a throwaway repo root in the OS temp dir: which takes it
// redoes, which it leaves alone, and which squeeze setting each gets. ffmpeg is stood in for by o.process, so this
// needs no ffmpeg; the chain itself is proven by tools/booth/chain-probe.mjs (production/qa/evidence/ls2-booth2.md).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Clipped, LegacyTakes, legacyTakes, legacyWhy, readOpts, reprocess } from '../../tools/booth/plugin';
import { FX_CHAIN, PRESETS, defaults, fxName, fxOn, type FxSet } from '../../tools/booth/fx';

const ROBOT = PRESETS.find((p) => p.name === 'Robot')!.fx, GHOST = PRESETS.find((p) => p.name === 'Ghost')!.fx;
const opts = (f: string) => JSON.parse(fs.readFileSync(path.join(raw, f), 'utf8'));

const CAT = 'hype10', OLD = 'old take';
let root: string, sfx: string, raw: string;
/** a stand-in processTake: records the squeeze each take got, writes the output, refuses a raw whose bytes say CLIP */
const calls: { raw: string; squeeze?: boolean; fx?: FxSet | null }[] = [];
const fake = async (r: string, out: string, o: { squeeze?: boolean; fx?: FxSet | null } = {}) => {
  calls.push({ raw: path.basename(r), squeeze: o.squeeze, ...(o.fx ? { fx: o.fx } : {}) });
  if (fs.readFileSync(r, 'utf8') === 'CLIP') throw new Clipped(2.8);
  fs.writeFileSync(out, 'new take');
  return { gain: 0, gate: -40, expand: -32, rawPeak: -8, squeeze: o.squeeze !== false, squeezed: 0, fx: fxName(o.fx), lufs: -12, peak: -1, dur: 1.9, warn: undefined };
};
const put = (dir: string, f: string, body: string) => fs.writeFileSync(path.join(dir, f), body);
const read = (f: string) => fs.readFileSync(path.join(sfx, f), 'utf8');

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'booth-reprocess-'));
  sfx = path.join(root, 'src', 'sfx', CAT);
  raw = path.join(root, 'assets-raw', 'voice', CAT);
  fs.mkdirSync(sfx, { recursive: true });
  fs.mkdirSync(raw, { recursive: true });
  calls.length = 0;
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('readOpts', () => {
  it("reads a take's saved squeeze choice, and null for an older take or a broken record", () => {
    put(raw, 'a-matty-1.json', '{"squeeze":false}');
    put(raw, 'a-matty-2.json', '{nope');
    put(raw, 'a-matty-3.json', '{"squeeze":"no"}');
    expect(readOpts(raw, 'a-matty-1.ogg')).toEqual({ squeeze: false });
    expect(readOpts(raw, 'a-matty-2.ogg')).toBeNull();
    expect(readOpts(raw, 'a-matty-3.ogg')).toBeNull();
    expect(readOpts(raw, 'a-matty-4.ogg')).toBeNull();
  });
  it('returns the FX rack only when it is on, cleaned', () => {
    put(raw, 'a-matty-1.json', JSON.stringify({ squeeze: true, fx: ROBOT }));
    put(raw, 'a-matty-2.json', '{"squeeze":true,"fx":{}}');
    put(raw, 'a-matty-3.json', '{"squeeze":true,"fx":{"bogus":{"x":1},"constructor":{}}}');
    put(raw, 'a-matty-4.json', '{"squeeze":false,"fx":"1;volume=100"}');
    put(raw, 'a-matty-5.json', '{"squeeze":true,"text":"HI","fx":{"pitch":{"semi":99,"evil":"x"}}}');
    expect(readOpts(raw, 'a-matty-1.ogg')).toEqual({ squeeze: true, fx: ROBOT });
    expect(readOpts(raw, 'a-matty-2.ogg')).toEqual({ squeeze: true });
    expect(readOpts(raw, 'a-matty-3.ogg')).toEqual({ squeeze: true });
    expect(readOpts(raw, 'a-matty-4.ogg')).toEqual({ squeeze: false });
    expect(readOpts(raw, 'a-matty-5.ogg')).toEqual({ squeeze: true, text: 'HI', fx: { pitch: { semi: 12, formant: 0 } } });
  });
  it('reads the chain stamp only as a positive whole number', () => {
    put(raw, 'a-matty-1.json', JSON.stringify({ squeeze: true, chain: 2 }));
    put(raw, 'a-matty-2.json', '{"squeeze":true,"chain":"2"}');
    put(raw, 'a-matty-3.json', '{"squeeze":true,"chain":1.5}');
    expect(readOpts(raw, 'a-matty-1.ogg')).toEqual({ squeeze: true, chain: 2 });
    expect(readOpts(raw, 'a-matty-2.ogg')).toEqual({ squeeze: true });
    expect(readOpts(raw, 'a-matty-3.ogg')).toEqual({ squeeze: true });
  });
});

describe('reprocess', () => {
  it('rewrites a take that has a raw, and never brings back one whose processed take was deleted', async () => {
    put(raw, 'a-matty-1.webm', 'voice'); put(sfx, 'a-matty-1.ogg', OLD);
    put(raw, 'a-matty-2.webm', 'voice'); // its .ogg was deleted
    const r = await reprocess(root, [CAT], { process: fake });
    expect(r.map((x) => [x.name, x.done])).toEqual([['a-matty-1.ogg', true], ['a-matty-2.ogg', false]]);
    expect(r[1].why).toMatch(/no processed take/);
    expect(read('a-matty-1.ogg')).toBe('new take');
    expect(fs.existsSync(path.join(sfx, 'a-matty-2.ogg'))).toBe(false);
    expect(calls.map((c) => c.raw)).toEqual(['a-matty-1.webm']);
  });
  it('leaves a clipped raw\'s take as it was, and no temp file behind', async () => {
    put(raw, 'a-matty-1.webm', 'CLIP'); put(sfx, 'a-matty-1.ogg', OLD);
    const [r] = await reprocess(root, [CAT], { process: fake });
    expect(r).toMatchObject({ done: false, why: 'input clipped (raw peak +2.8 dBFS): kept as it was' });
    expect(read('a-matty-1.ogg')).toBe(OLD);
    expect(fs.readdirSync(raw)).toEqual(['a-matty-1.webm']);
  });
  it("gives each take its own saved squeeze over the run's setting; an older take gets the run's", async () => {
    put(raw, 'a-matty-1.webm', 'voice'); put(sfx, 'a-matty-1.ogg', OLD); put(raw, 'a-matty-1.json', '{"squeeze":true}');
    put(raw, 'a-matty-2.webm', 'voice'); put(sfx, 'a-matty-2.ogg', OLD); // kept before the record existed
    await reprocess(root, [CAT], { process: fake, squeeze: false });
    expect(calls).toEqual([{ raw: 'a-matty-1.webm', squeeze: true }, { raw: 'a-matty-2.webm', squeeze: false }]);
  });
  it('ignores files that are not raw takes (records, temp files, other names)', async () => {
    for (const f of ['a-matty-1.json', 'a-matty-1.ogg.part.ogg', 'notes.txt', 'a-matty-0.webm']) put(raw, f, 'x');
    expect(await reprocess(root, [CAT], { process: fake })).toEqual([]);
  });
  it('refuses a folder that is not a voice slot before touching any take', async () => {
    put(raw, 'a-matty-1.webm', 'voice'); put(sfx, 'a-matty-1.ogg', OLD);
    await expect(reprocess(root, [CAT, '../etc'], { process: fake })).rejects.toThrow('"../etc" is not a voice slot');
    expect(calls).toEqual([]);
    expect(read('a-matty-1.ogg')).toBe(OLD);
  });
  it("reprocesses a take with the FX rack it was kept with, and a clean take with none", async () => {
    put(raw, 'a-matty-1.webm', 'voice'); put(sfx, 'a-matty-1.ogg', OLD); put(raw, 'a-matty-1.json', JSON.stringify({ squeeze: false, fx: ROBOT, chain: FX_CHAIN }));
    put(raw, 'a-matty-2.webm', 'voice'); put(sfx, 'a-matty-2.ogg', OLD); put(raw, 'a-matty-2.json', '{"squeeze":true}');
    const before = opts('a-matty-1.json');
    const r = await reprocess(root, [CAT], { process: fake });
    expect(calls).toEqual([{ raw: 'a-matty-1.webm', squeeze: false, fx: ROBOT }, { raw: 'a-matty-2.webm', squeeze: true }]);
    expect(r.some((x) => x.legacy)).toBe(false);
    // without an override the records keep their choices, stamped with the chain they now carry
    expect(opts('a-matty-1.json')).toEqual(before);
    expect(opts('a-matty-2.json')).toEqual({ squeeze: true, chain: FX_CHAIN });
  });
  it('refuses to rewrite a racked take kept before fx-dsp (no chain stamp) without confirm, touching nothing', async () => {
    // the shipped DESCEND take's shape: a Hive mind rack, no chain stamp
    const HIVE = PRESETS.find((p) => p.name === 'Hive mind')!.fx;
    put(raw, 'a-matty-1.webm', 'voice'); put(sfx, 'a-matty-1.ogg', OLD); put(raw, 'a-matty-1.json', JSON.stringify({ squeeze: true, fx: HIVE }));
    put(raw, 'a-matty-2.webm', 'voice'); put(sfx, 'a-matty-2.ogg', OLD); // clean, no record: the chain's own
    const before = opts('a-matty-1.json');
    const e = await reprocess(root, [CAT], { process: fake }).catch((x) => x);
    expect(e).toBeInstanceOf(LegacyTakes);
    expect(e.message).toMatch(/^this will change a shipped take: listen first\. hype10\/a-matty-1\.ogg \(kept with .* before fx-dsp/);
    expect(e.takes.map((t: { name: string }) => t.name)).toEqual(['a-matty-1.ogg']);
    expect(calls).toEqual([]);
    expect(read('a-matty-1.ogg')).toBe(OLD);
    expect(opts('a-matty-1.json')).toEqual(before);
    // confirmed: rewritten, flagged for a listen, and stamped (the next reprocess does not ask again)
    const r = await reprocess(root, [CAT], { process: fake, confirm: true });
    expect(r.map((x) => [x.name, x.done, !!x.legacy])).toEqual([['a-matty-1.ogg', true, true], ['a-matty-2.ogg', true, false]]);
    expect(opts('a-matty-1.json')).toEqual({ ...before, chain: FX_CHAIN });
    expect(legacyTakes(root, [CAT])).toEqual([]);
  });
  it('legacyWhy: stamped takes never; unstamped racked takes on a reprocess; any unstamped take an Apply FX re-racks', () => {
    expect(legacyWhy({ squeeze: true, fx: ROBOT, chain: FX_CHAIN }, undefined)).toBeNull();
    expect(legacyWhy({ squeeze: true, chain: FX_CHAIN }, GHOST)).toBeNull();
    expect(legacyWhy({ squeeze: true, fx: ROBOT }, undefined)).toMatch(/before fx-dsp/);
    expect(legacyWhy({ squeeze: true }, undefined)).toBeNull();
    expect(legacyWhy(null, undefined)).toBeNull();
    expect(legacyWhy(null, GHOST)).toMatch(/Apply FX rewrites a shipped take/);
    expect(legacyWhy({ squeeze: true }, {})).toMatch(/Apply FX/);
  });
  it("o.fx overrides every take's own rack and rewrites its record, keeping its squeeze (and words)", async () => {
    put(raw, 'a-matty-1.webm', 'voice'); put(sfx, 'a-matty-1.ogg', OLD); put(raw, 'a-matty-1.json', JSON.stringify({ squeeze: false, fx: ROBOT }));
    put(raw, 'a-matty-2.webm', 'voice'); put(sfx, 'a-matty-2.ogg', OLD); put(raw, 'a-matty-2.json', '{"squeeze":true,"text":"OLD WORDS"}');
    put(raw, 'a-matty-3.webm', 'voice'); put(sfx, 'a-matty-3.ogg', OLD); // kept before the record existed
    await expect(reprocess(root, [CAT], { process: fake, fx: GHOST, squeeze: false })).rejects.toBeInstanceOf(LegacyTakes);
    expect(calls).toEqual([]);
    const r = await reprocess(root, [CAT], { process: fake, fx: GHOST, squeeze: false, confirm: true });
    expect(r.every((x) => x.done && x.legacy)).toBe(true);
    expect(calls).toEqual([
      { raw: 'a-matty-1.webm', squeeze: false, fx: GHOST },
      { raw: 'a-matty-2.webm', squeeze: true, fx: GHOST },
      { raw: 'a-matty-3.webm', squeeze: false, fx: GHOST },
    ]);
    expect(opts('a-matty-1.json')).toEqual({ squeeze: false, fx: GHOST, chain: FX_CHAIN });
    expect(opts('a-matty-2.json')).toEqual({ squeeze: true, text: 'OLD WORDS', fx: GHOST, chain: FX_CHAIN });
    expect(opts('a-matty-3.json')).toEqual({ squeeze: false, fx: GHOST, chain: FX_CHAIN });
    expect(readOpts(raw, 'a-matty-1.ogg')).toEqual({ squeeze: false, fx: GHOST, chain: FX_CHAIN });
    // and the next plain reprocess repeats the applied rack
    calls.length = 0;
    await reprocess(root, [CAT], { process: fake });
    expect(calls.map((c) => c.fx)).toEqual([GHOST, GHOST, GHOST]);
  });
  it('an empty o.fx (apply "no FX") strips the rack from every take', async () => {
    put(raw, 'a-matty-1.webm', 'voice'); put(sfx, 'a-matty-1.ogg', OLD); put(raw, 'a-matty-1.json', JSON.stringify({ squeeze: true, fx: ROBOT }));
    await reprocess(root, [CAT], { process: fake, fx: {}, confirm: true });
    // the take is processed with an empty rack (fxGraph: null, no FX pass)
    expect(calls.map((c) => [c.raw, c.squeeze, fxOn(c.fx)])).toEqual([['a-matty-1.webm', true, false]]);
    expect(readOpts(raw, 'a-matty-1.ogg')).toEqual({ squeeze: true, chain: FX_CHAIN });
  });
  it('o.only re-keeps that one take with o.fx and records the rack in its .json; the others are untouched', async () => {
    put(raw, 'a-matty-1.webm', 'voice'); put(sfx, 'a-matty-1.ogg', OLD); put(raw, 'a-matty-1.json', JSON.stringify({ squeeze: false, fx: ROBOT, chain: FX_CHAIN }));
    put(raw, 'a-matty-2.webm', 'voice'); put(sfx, 'a-matty-2.ogg', OLD); put(raw, 'a-matty-2.json', JSON.stringify({ squeeze: true, chain: FX_CHAIN }));
    const before = opts('a-matty-1.json');
    const r = await reprocess(root, [CAT], { process: fake, fx: GHOST, only: 'a-matty-2.ogg' });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: 'a-matty-2.ogg', done: true, lufs: -12, peak: -1, dur: 1.9, gain: 0, fx: fxName(GHOST) });
    expect(calls).toEqual([{ raw: 'a-matty-2.webm', squeeze: true, fx: GHOST }]);
    expect(read('a-matty-1.ogg')).toBe(OLD);
    expect(read('a-matty-2.ogg')).toBe('new take');
    expect(opts('a-matty-1.json')).toEqual(before);
    expect(opts('a-matty-2.json')).toEqual({ squeeze: true, fx: GHOST, chain: FX_CHAIN });
    // and the rack off strips it again
    await reprocess(root, [CAT], { process: fake, fx: {}, only: 'a-matty-2.ogg' });
    expect(readOpts(raw, 'a-matty-2.ogg')).toEqual({ squeeze: true, chain: FX_CHAIN });
  });
  it('o.only asks about a take kept before fx-dsp only when it is that take', async () => {
    put(raw, 'a-matty-1.webm', 'voice'); put(sfx, 'a-matty-1.ogg', OLD); put(raw, 'a-matty-1.json', JSON.stringify({ squeeze: true, fx: ROBOT })); // unstamped
    put(raw, 'a-matty-2.webm', 'voice'); put(sfx, 'a-matty-2.ogg', OLD); put(raw, 'a-matty-2.json', JSON.stringify({ squeeze: true, chain: FX_CHAIN }));
    expect(legacyTakes(root, [CAT], GHOST, 'a-matty-2.ogg')).toEqual([]);
    expect(legacyTakes(root, [CAT], GHOST, 'a-matty-1.ogg').map((t) => t.name)).toEqual(['a-matty-1.ogg']);
    expect((await reprocess(root, [CAT], { process: fake, fx: GHOST, only: 'a-matty-2.ogg' }))[0].done).toBe(true);
    await expect(reprocess(root, [CAT], { process: fake, fx: GHOST, only: 'a-matty-1.ogg' })).rejects.toBeInstanceOf(LegacyTakes);
    expect(read('a-matty-1.ogg')).toBe(OLD);
  });
  it('o.only refuses a bad name, a take with no raw, and more than one slot, before touching anything', async () => {
    put(raw, 'a-matty-1.webm', 'voice'); put(sfx, 'a-matty-1.ogg', OLD);
    for (const bad of ['../a-matty-1.ogg', 'a-matty-1.webm', 'a-matty-1', '']) await expect(reprocess(root, [CAT], { process: fake, fx: GHOST, only: bad })).rejects.toThrow('not a take name');
    await expect(reprocess(root, [CAT], { process: fake, fx: GHOST, only: 'a-matty-9.ogg' })).rejects.toThrow('no raw take for a-matty-9.ogg');
    await expect(reprocess(root, [CAT, 'hype35'], { process: fake, only: 'a-matty-1.ogg' })).rejects.toThrow('one slot');
    expect(calls).toEqual([]);
    expect(read('a-matty-1.ogg')).toBe(OLD);
  });
  it('o.only on a clipped raw leaves the take and its record as they were', async () => {
    put(raw, 'a-matty-1.webm', 'CLIP'); put(sfx, 'a-matty-1.ogg', OLD); put(raw, 'a-matty-1.json', JSON.stringify({ squeeze: true, chain: FX_CHAIN }));
    const [r] = await reprocess(root, [CAT], { process: fake, fx: GHOST, only: 'a-matty-1.ogg' });
    expect(r).toMatchObject({ done: false, why: 'input clipped (raw peak +2.8 dBFS): kept as it was' });
    expect(read('a-matty-1.ogg')).toBe(OLD);
    expect(opts('a-matty-1.json')).toEqual({ squeeze: true, chain: FX_CHAIN });
  });
  it("a clipped raw keeps its old record when o.fx is applied", async () => {
    put(raw, 'a-matty-1.webm', 'CLIP'); put(sfx, 'a-matty-1.ogg', OLD); put(raw, 'a-matty-1.json', JSON.stringify({ squeeze: true, fx: ROBOT }));
    const [r] = await reprocess(root, [CAT], { process: fake, fx: { echo: defaults('echo') }, confirm: true });
    expect(r.done).toBe(false);
    expect(read('a-matty-1.ogg')).toBe(OLD);
    expect(opts('a-matty-1.json')).toEqual({ squeeze: true, fx: ROBOT });
  });
});

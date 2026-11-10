// The booth's reprocess (tools/booth/plugin.ts reprocess) on a throwaway repo root in the OS temp dir: which takes it
// redoes, which it leaves alone, and which squeeze setting each gets. ffmpeg is stood in for by o.process, so this
// needs no ffmpeg; the chain itself is proven by tools/booth/chain-probe.mjs (production/qa/evidence/ls2-booth2.md).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Clipped, readOpts, reprocess } from '../../tools/booth/plugin';

const CAT = 'hype10', OLD = 'old take';
let root: string, sfx: string, raw: string;
/** a stand-in processTake: records the squeeze each take got, writes the output, refuses a raw whose bytes say CLIP */
const calls: { raw: string; squeeze?: boolean }[] = [];
const fake = async (r: string, out: string, o: { squeeze?: boolean } = {}) => {
  calls.push({ raw: path.basename(r), squeeze: o.squeeze });
  if (fs.readFileSync(r, 'utf8') === 'CLIP') throw new Clipped(2.8);
  fs.writeFileSync(out, 'new take');
  return { gain: 0, gate: -40, expand: -32, rawPeak: -8, squeeze: o.squeeze !== false, squeezed: 0, lufs: -12, peak: -1, dur: 1.9, warn: undefined };
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
});

// LS2-quips: the booth's quip editor (tools/booth/plugin.ts editQuips) on a throwaway repo root in the OS temp dir,
// plus the quip slots (tools/booth/slots.ts) and the reprocess CLI's quip arguments (tools/booth/args.ts).
// Story type: Integration (BLOCKING), tests/integration/booth-quips.test.ts. Cleans its temp root in afterEach.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { QuipRefused, editQuips, quipJson, readQuips } from '../../tools/booth/plugin';
import { MAX_LEN, SLOTS, quipSlot, voiceSlot } from '../../tools/booth/slots';
import { parseArgs } from '../../tools/booth/args';
import { parseQuips, type Quip } from '../../src/voice/quiplist';

let root: string, sfx: string, rawBase: string, file: string;
const START: Quip[] = [
  { id: 'closed-casket', text: 'CLOSED CASKET', note: 'dry' },
  { id: 'dead-weight', text: 'DEAD WEIGHT / LEAVE IT' },
];
const disk = () => fs.readFileSync(file, 'utf8');
const ids = () => readQuips(root).quips.map((q) => q.id);
/** the refusal editQuips throws, or null */
function refused(op: unknown): QuipRefused | null {
  try { editQuips(root, op); } catch (e) { if (e instanceof QuipRefused) return e; throw e; }
  return null;
}
const put = (dir: string, f: string, body = 'x') => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, f), body); };

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'booth-quips-'));
  sfx = path.join(root, 'src', 'sfx');
  rawBase = path.join(root, 'assets-raw', 'voice');
  file = path.join(root, 'src', 'voice', 'quips.json');
  fs.mkdirSync(sfx, { recursive: true });
  fs.mkdirSync(rawBase, { recursive: true });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, quipJson(START));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('editQuips add', () => {
  it('normalises the words to caps and makes the id from them', () => {
    const r = editQuips(root, { op: 'add', text: '  rest in   pieces ' });
    expect(r.quip).toEqual({ id: 'rest-in-pieces', text: 'REST IN PIECES' });
    expect(ids()).toEqual(['closed-casket', 'dead-weight', 'rest-in-pieces']);
  });

  it('never reuses an id left behind as a quip folder in assets-raw/voice or src/sfx', () => {
    fs.mkdirSync(path.join(rawBase, 'quip-rest-in-pieces'));
    fs.mkdirSync(path.join(sfx, 'quip-rest-in-pieces-2'));
    expect(editQuips(root, { op: 'add', text: 'REST IN PIECES' }).quip!.id).toBe('rest-in-pieces-3');
  });

  it('refuses words already in the list with 409, and the file is untouched', () => {
    const before = disk();
    expect(refused({ op: 'add', text: 'closed casket' })?.code).toBe(409);
    expect(disk()).toBe(before);
  });

  it('refuses bad words with 400', () => {
    for (const text of ['', 'LOUD!', 'A / B / C', 'X'.repeat(21), undefined]) expect(refused({ op: 'add', text })?.code, String(text)).toBe(400);
  });
});

describe('editQuips edit', () => {
  it('changes the words and keeps the id', () => {
    const r = editQuips(root, { op: 'edit', id: 'closed-casket', text: 'casket / closed' });
    expect(r.quips[0]).toEqual({ id: 'closed-casket', text: 'CASKET / CLOSED', note: 'dry' });
    expect(readQuips(root).quips).toEqual(r.quips);
  });

  it("refuses another quip's words with 409 but lets a quip keep its own", () => {
    expect(refused({ op: 'edit', id: 'closed-casket', text: 'DEAD WEIGHT / LEAVE IT' })?.code).toBe(409);
    expect(refused({ op: 'edit', id: 'closed-casket', text: 'CLOSED CASKET' })).toBeNull();
  });

  it('refuses an unknown id with 404 and a malformed id with 400', () => {
    expect(refused({ op: 'edit', id: 'nope', text: 'A' })?.code).toBe(404);
    for (const id of ['../x', 'Bad', '', 7, undefined]) expect(refused({ op: 'edit', id, text: 'A' })?.code, String(id)).toBe(400);
  });

  it('refuses bad words with 400', () => {
    expect(refused({ op: 'edit', id: 'closed-casket', text: 'NO!' })?.code).toBe(400);
  });
});

describe('editQuips del', () => {
  it('deletes a quip with no takes', () => {
    editQuips(root, { op: 'del', id: 'closed-casket' });
    expect(ids()).toEqual(['dead-weight']);
  });

  it('refuses a quip with takes with 409 unless takes: true', () => {
    const dir = path.join(sfx, 'quip-closed-casket');
    put(dir, 'closed-casket-matty-1.ogg');
    const e = refused({ op: 'del', id: 'closed-casket' });
    expect(e?.code).toBe(409);
    expect(e?.message).toMatch(/1 take:/);
    expect(refused({ op: 'del', id: 'closed-casket', takes: 'yes' })?.code).toBe(409);
    expect(ids()).toContain('closed-casket');
    expect(fs.existsSync(path.join(dir, 'closed-casket-matty-1.ogg'))).toBe(true);
  });

  it('with takes: true removes only the processed takes and the empty folder, and keeps the raw takes', () => {
    const dir = path.join(sfx, 'quip-closed-casket'), raw = path.join(rawBase, 'quip-closed-casket');
    put(dir, 'closed-casket-matty-1.ogg'); put(dir, 'closed-casket-matty-2.ogg');
    put(raw, 'closed-casket-matty-1.webm'); put(raw, 'closed-casket-matty-1.json', '{}');
    put(path.join(sfx, 'quip-dead-weight'), 'dead-weight-matty-1.ogg');
    editQuips(root, { op: 'del', id: 'closed-casket', takes: true });
    expect(fs.existsSync(dir)).toBe(false);
    expect(fs.readdirSync(raw).sort()).toEqual(['closed-casket-matty-1.json', 'closed-casket-matty-1.webm']);
    expect(fs.existsSync(path.join(sfx, 'quip-dead-weight', 'dead-weight-matty-1.ogg'))).toBe(true);
    expect(ids()).toEqual(['dead-weight']);
    // the leftover raw folder keeps the id out of reach
    expect(editQuips(root, { op: 'add', text: 'CLOSED CASKET' }).quip!.id).toBe('closed-casket-2');
  });

  it('keeps the folder when it holds a file that is not audio', () => {
    const dir = path.join(sfx, 'quip-closed-casket');
    put(dir, 'closed-casket-matty-1.ogg'); put(dir, 'README.txt');
    editQuips(root, { op: 'del', id: 'closed-casket', takes: true });
    expect(fs.readdirSync(dir)).toEqual(['README.txt']);
  });

  it('refuses with 409 a folder holding audio the booth did not name, and deletes nothing', () => {
    const dir = path.join(sfx, 'quip-closed-casket');
    put(dir, 'closed-casket-matty-1.ogg'); put(dir, 'my-edit.wav');
    expect(refused({ op: 'del', id: 'closed-casket', takes: true })?.code).toBe(409);
    expect(fs.readdirSync(dir).sort()).toEqual(['closed-casket-matty-1.ogg', 'my-edit.wav']);
    expect(ids()).toContain('closed-casket');
  });

  it('refuses an unknown id with 404', () => {
    expect(refused({ op: 'del', id: 'nope' })?.code).toBe(404);
  });
});

describe('editQuips requests and the file', () => {
  it('refuses a missing or unknown op with 400', () => {
    for (const op of [null, undefined, {}, { op: 'rename', id: 'closed-casket' }, 'add']) expect(refused(op)?.code, JSON.stringify(op)).toBe(400);
  });

  it('refuses every write with 409 while quips.json has a bad row, and leaves it byte-identical', () => {
    const broken = '[\n  { "id": "closed-casket", "text": "CLOSED CASKET" },\n  { "id": "Bad Row", "text": "X" }\n]\n';
    fs.writeFileSync(file, broken);
    for (const op of [{ op: 'add', text: 'NEW ONE' }, { op: 'edit', id: 'closed-casket', text: 'B' }, { op: 'del', id: 'closed-casket' }]) {
      expect(refused(op)?.code, op.op).toBe(409);
      expect(disk()).toBe(broken);
    }
  });

  it('refuses every write with 409 while quips.json is not JSON, and leaves it byte-identical', () => {
    fs.writeFileSync(file, '[{ nope');
    expect(refused({ op: 'add', text: 'NEW ONE' })?.code).toBe(409);
    expect(disk()).toBe('[{ nope');
  });

  it('writes valid JSON, one quip a line, that parses back to the same list, with no temp file left', () => {
    const r = editQuips(root, { op: 'add', text: 'no guts/all glory' });
    const text = disk(), lines = text.trimEnd().split('\n');
    expect(lines[0]).toBe('[');
    expect(lines.at(-1)).toBe(']');
    expect(lines.slice(1, -1)).toHaveLength(3);
    for (const l of lines.slice(1, -1)) expect(() => JSON.parse(l.replace(/,$/, ''))).not.toThrow();
    const back = parseQuips(JSON.parse(text));
    expect(back.errors).toEqual([]);
    expect(back.quips).toEqual(r.quips);
    expect(fs.readdirSync(rawBase).filter((f) => f.includes('tmp'))).toEqual([]);
    expect(fs.readdirSync(path.dirname(file))).toEqual(['quips.json']);
  });
});

describe('quipSlot and voiceSlot', () => {
  const Q: Quip = { id: 'x', text: 'EX / WHY', note: 'n' };

  it("makes SLAB's slot for a quip under its fixed id", () => {
    const s = quipSlot(Q);
    expect(s).toMatchObject({ cat: 'quip-x', slug: 'x', caller: 'SGT. RAMROD SLAB', wired: true, test: 'stage=orbit&vox=quip-x', maxLen: 2, note: 'n', quip: Q });
    expect(MAX_LEN.quip).toBe(2);
    expect(s.copy!.lines).toEqual(['EX', 'WHY']);
  });

  it('finds the fixed slots and the quips in the list, and nothing else', () => {
    expect(voiceSlot('hype10', [])).toBe(SLOTS[0]);
    expect(voiceSlot('quip-x', [Q])?.cat).toBe('quip-x');
    expect(voiceSlot('quip-x', [])).toBeUndefined();
    expect(voiceSlot('quip-y', [Q])).toBeUndefined();
  });
});

describe('parseArgs with a quip list', () => {
  const Q: Quip[] = [{ id: 'x', text: 'EX' }];
  const yes = () => true, at = () => Q;

  it('accepts a quip folder only when it is in the list', () => {
    expect(parseArgs(['quip-x'], '/r', yes, at)).toEqual({ root: '/r', cats: ['quip-x'], squeeze: true });
    expect(parseArgs(['quip-x'], '/r', yes)).toMatchObject({ error: expect.stringMatching(/"quip-x" is not a voice slot/) });
  });

  it('refuses a quip not in the list', () => {
    expect(parseArgs(['hype10', 'quip-gone'], '/r', yes, at)).toMatchObject({ error: expect.stringMatching(/"quip-gone"/) });
  });

  it('includes every quip with --all', () => {
    const r = parseArgs(['--all'], '/r', yes, at) as any;
    expect(r.cats).toEqual([...SLOTS.map((s) => s.cat), 'quip-x']);
  });

  it('reads the quip list from the --root given', () => {
    const seen: string[] = [];
    parseArgs(['--root', '/other', 'quip-x'], '/r', yes, (r) => (seen.push(r), Q));
    expect(seen).toEqual(['/other']);
  });
});

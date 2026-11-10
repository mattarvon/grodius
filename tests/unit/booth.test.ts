// The voice booth (LS2-booth): the name rules every path the dev plugin writes is built from, its request guard, the
// slot list against the game it describes, and the ?vox= hook's calls against the call sites they copy.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { CAT_RE, SLUG_MAX, TAKE_MAX, TAKE_RE, gainTo, nextTake, okCat, rawExt, slugify, squeezeCuts, takeName } from '../../tools/booth/names';
import { USAGE, parseArgs } from '../../tools/booth/args';
import { DIRECTION, LEN_SLACK, MAX_LEN, SLOTS, lenLimit, lenWarn, slotOf } from '../../tools/booth/slots';
import { Clipped, RAW_RE, VOX, guard, levels, rawVerdict, skipWhy, squeezeParam } from '../../tools/booth/plugin';

const src = (f: string) => fs.readFileSync(f, 'utf8');

describe('slugify', () => {
  it('turns a caption into lower-case dash-joined words', () => {
    expect(slugify('THAT ONE HAD A NAME')).toBe('that-one-had-a-name');
    expect(slugify('STOP KILLING ME / WITH YOUR SPACESHIP, SIR')).toBe('stop-killing-me-with-your-spaceship-sir');
  });
  it('drops every character that could name a path', () => {
    for (const s of ['../../etc/passwd', '..\\..\\win', '/abs/path', 'a\0b', '%2e%2e%2f', 'C:\\x', '~/.ssh']) {
      const out = slugify(s);
      expect(out).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(out).not.toMatch(/[./\\:~%\0]/);
    }
    expect(slugify('../../etc/That One')).toBe('etc-that-one');
  });
  it('is empty for nothing usable, and never starts or ends with a dash', () => {
    for (const s of ['', '..', '///', '  ', null, undefined, 'ÉÀ']) expect(slugify(s)).toBe('');
    expect(slugify('-a-')).toBe('a');
  });
  it('keeps exactly SLUG_MAX characters of one long word, and a capped slug still makes a valid take name', () => {
    expect(slugify('a'.repeat(100))).toBe('a'.repeat(SLUG_MAX));
    expect(TAKE_RE.test(takeName(slugify('word '.repeat(40)), 1))).toBe(true);
    expect(slugify(0)).toBe('0');
  });
  it('caps the length without leaving a trailing dash', () => {
    const out = slugify('word '.repeat(40));
    expect(out.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(out.endsWith('-')).toBe(false);
  });
});

describe('okCat', () => {
  it('takes plain folder names only', () => {
    for (const c of ['hype10', 'kill-ufo', 'carn5']) expect(okCat(c)).toBe(true);
    for (const c of ['', '.', '..', '../music', 'a/b', 'Hype10', 'kill-', '-x', 'a..b', 'x'.repeat(33), 5 as any, null]) expect(okCat(c)).toBe(false);
  });
});

describe('nextTake', () => {
  it('numbers from 1, then one past the highest take of that slug', () => {
    expect(nextTake([], 'opened')).toBe(1);
    expect(nextTake(['opened-matty-1.ogg', 'opened-matty-3.ogg'], 'opened')).toBe(4);
  });
  it('counts raw takes too, so a deleted take never reuses a number', () => {
    expect(nextTake(['opened-matty-2.webm'], 'opened')).toBe(3);
  });
  it('ignores other slugs, even one the slug is a prefix of, and stray files', () => {
    const names = ['that-one-had-a-name-matty-7.ogg', 'that-one-matty-x.ogg', 'that-one-matty-.ogg', 'that-one-matty-02.ogg', 'that-one-matty-5.ogg.part.ogg', 'README.md'];
    expect(nextTake(names, 'that-one')).toBe(1);
    expect(nextTake(names, 'that-one-had-a-name')).toBe(8);
  });
  it('caps at TAKE_MAX, the last number a take name can carry (the plugin refuses a keep past it)', () => {
    expect(TAKE_RE.test(takeName('x', TAKE_MAX))).toBe(true);
    expect(TAKE_RE.test(takeName('x', TAKE_MAX + 1))).toBe(false);
    expect(nextTake(['x-matty-9999.ogg'], 'x')).toBeGreaterThan(TAKE_MAX);
  });
  it('ignores a number past the cap or with a leading zero, and another slug that shares a prefix', () => {
    expect(nextTake(['x-matty-12345.ogg', 'x-matty-0.ogg'], 'x')).toBe(1);
    expect(nextTake(['x-y-matty-4.ogg'], 'x')).toBe(1);
  });
  it('gives names the delete endpoint accepts, and only those', () => {
    expect(TAKE_RE.test(takeName('taken-down', 12))).toBe(true);
    for (const n of ['../x-matty-1.ogg', 'x-matty-1.ogg/..', 'x-matty-0.ogg', 'x-matty-1.wav', 'X-matty-1.ogg', 'lesley.ogg']) expect(TAKE_RE.test(n)).toBe(false);
  });
});

describe('rawExt and gainTo', () => {
  it('maps recorder types to an extension and refuses anything else', () => {
    expect(rawExt('audio/webm;codecs=opus')).toBe('webm');
    expect(rawExt('audio/ogg; codecs=opus')).toBe('ogg');
    expect(rawExt('AUDIO/WEBM')).toBe('webm');
    expect(rawExt('audio/x-wav')).toBe('wav');
    expect(rawExt('audio/mp4')).toBe('m4a');
    for (const t of ['', 'audio/webm/../x', 'audio/webmx', 'video/webm']) expect(rawExt(t), t).toBe(null);
    expect(rawExt('text/html')).toBe(null);
    expect(rawExt(undefined)).toBe(null);
  });
  it('gives the gain to the target, and null for a silent take', () => {
    expect(gainTo(-12, -30)).toBe(18);
    expect(gainTo(-12, -9.5)).toBe(-2.5);
    expect(gainTo(-12, -70)).toBe(null);
    expect(gainTo(-12, null)).toBe(null);
    expect(gainTo(-12, -60)).toBe(null);
    expect(gainTo(-12, -59.99)).toBe(47.99);
    for (const m of [NaN, Infinity, -Infinity]) expect(gainTo(-12, m)).toBe(null);
  });
});

describe('guard', () => {
  const TOK = 'a'.repeat(32);
  const req = (o: { ip?: string | undefined; method?: string; headers?: Record<string, any>; noSocket?: boolean }) =>
    ({ method: o.method ?? 'GET', socket: o.noSocket ? undefined : { remoteAddress: 'ip' in o ? o.ip : '127.0.0.1' }, headers: { host: 'localhost:5173', ...o.headers } }) as any;
  const write = { method: 'POST', headers: { origin: 'http://localhost:5173', 'x-booth': TOK } };
  it('serves the page to this machine without a token, for GET only', () => {
    expect(guard(req({}), null)).toBe(null);
    expect(guard(req({ ip: '::1' }), null)).toBe(null);
    expect(guard(req({ method: 'POST' }), null)).toMatch(/method/);
  });
  it('lets this machine read and write the endpoints with the token', () => {
    expect(guard(req({ headers: { 'x-booth': TOK } }), TOK)).toBe(null);
    expect(guard(req({ ip: '::ffff:127.0.0.1', ...write }), TOK)).toBe(null);
  });
  it('refuses the endpoints without the token, or with a wrong one, even for a read', () => {
    expect(guard(req({}), TOK)).toMatch(/token/);
    expect(guard(req({ headers: { 'x-booth': '1' } }), TOK)).toMatch(/token/);
    expect(guard(req({ headers: { 'x-booth': [TOK] } }), TOK)).toMatch(/token/);
    expect(guard(req({ method: 'POST', headers: { origin: 'http://localhost:5173', 'x-booth': 'b'.repeat(32) } }), TOK)).toMatch(/token/);
  });
  it('refuses the LAN even with every header right (npm run dev passes --host)', () => {
    expect(guard(req({ ip: '10.0.0.13', ...write }), TOK)).toMatch(/loopback/);
    expect(guard(req({ ip: '10.0.0.13' }), null)).toMatch(/loopback/);
  });
  it('refuses a LAN or odd loopback-looking peer', () => {
    for (const ip of ['::ffff:10.0.0.13', '::ffff:192.168.1.5', '127.0.0.2', '::ffff:7f00:1', '0.0.0.0', '', undefined])
      expect(guard(req({ ip }), null), String(ip)).toMatch(/loopback/);
    expect(guard(req({ noSocket: true }), null)).toMatch(/loopback/);
  });
  it('refuses anything a proxy or tunnel forwarded, though it arrives on loopback', () => {
    for (const h of ['x-forwarded-for', 'x-forwarded-host', 'forwarded', 'via', 'x-real-ip'])
      expect(guard(req({ ...write, headers: { ...write.headers, [h]: '1.2.3.4' } }), TOK), h).toMatch(/forwarded/);
  });
  it('accepts the local Host forms and refuses ones that only look local (DNS rebinding)', () => {
    for (const host of ['localhost', 'localhost:5173', '127.0.0.1:5173', '[::1]:5173']) expect(guard(req({ headers: { host } }), null), host).toBe(null);
    for (const host of ['evil.example:5173', 'localhost.', 'localhost.:5173', 'LOCALHOST:5173', '127.0.0.1.nip.io:5173', 'localhost.evil.example',
      'user@localhost:5173', 'localhost:5173@evil.example', 'localhost:5173 ', ' localhost', 'localhost:', 'localhost:5173:1', '[::ffff:127.0.0.1]:5173', '::1', ''])
      expect(guard(req({ headers: { host } }), null), host).toMatch(/Host/);
    expect(guard(req({ headers: { host: undefined } }), null)).toMatch(/Host/);
  });
  it('refuses a write from any other origin, another local port included (Vite answers its preflight)', () => {
    const w = (origin: string | undefined, host = 'localhost:5173') => guard(req({ method: 'POST', headers: { host, origin, 'x-booth': TOK } }), TOK);
    for (const o of ['http://localhost:3000', 'http://evil.example', 'null', 'https://localhost:5173', 'http://localhost:5173/', undefined]) expect(w(o), String(o)).toMatch(/Origin/);
    expect(w('http://localhost:5173', '127.0.0.1:5173')).toMatch(/Origin/);
    for (const method of ['DELETE', 'PUT', 'HEAD', 'OPTIONS']) expect(guard(req({ method, headers: { 'x-booth': TOK } }), TOK), method).toMatch(/Origin/);
  });
});

describe('the slot list', () => {
  const voiceCat = new RegExp(/const VOICE_CAT = \/(.+)\/;/.exec(src('src/audio.ts'))![1]);
  it('has one plain, unique folder per slot', () => {
    expect(new Set(SLOTS.map((s) => s.cat)).size).toBe(SLOTS.length);
    for (const s of SLOTS) expect(s.cat).toMatch(CAT_RE);
    expect(slotOf('warning')).toBe(undefined);
  });
  it('wires every slot since LS2-slab, each a folder the game plays as voice', () => {
    expect(SLOTS.filter((s) => !s.wired).map((s) => s.cat)).toEqual([]);
    for (const s of SLOTS) expect(voiceCat.test(s.cat)).toBe(s.wired); // unwired folders aren't voice in audio.ts yet
    for (const s of SLOTS) expect(!!s.test).toBe(s.wired);
  });
  it('lists every HYPE line and every finished midboss kill word the game has', () => {
    const fx = src('src/fx/update.ts');
    const hype = /export const HYPE = \{([\s\S]*?)\n\};/.exec(fx)![1];
    const ns = [...hype.matchAll(/^\s*(\d+):/gm)].map((m) => +m[1]);
    expect(SLOTS.filter((s) => s.text && 'hype' in s.text).map((s) => (s.text as any).hype)).toEqual(ns);
    expect(/\[5, 'OPENED'\]/.test(fx)).toBe(true);
    for (const s of SLOTS) if (s.text && 'mid' in s.text) {
      const f = `src/enemies/mid/${s.text.mid}.ts`;
      expect(fs.existsSync(f), f).toBe(true);
      expect(/word: '/.test(src(f)), f).toBe(true);
    }
  });
  it('has a kill slot for exactly the midboss kinds defineMid registers with a word, keyed by kind, not file name', () => {
    const dir = 'src/enemies/mid';
    const kinds = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') && !['index.ts', 'roster.ts'].includes(f) && !f.startsWith('_'))
      .flatMap((f) => [...src(`${dir}/${f}`).matchAll(/defineMid\('([a-z0-9-]+)', \{[\s\S]*?\bword: '/g)].map((m) => m[1]));
    const slots = SLOTS.filter((s) => s.text && 'mid' in s.text).map((s) => (s.text as any).mid);
    expect([...slots].sort()).toEqual([...kinds].sort());
    for (const k of slots) expect(slotOf('kill-' + k), k).toBeTruthy();
  });
  it('shows only copied words the source literal contains (YEAH BABY is booth-only text: the game has just the clip name)', () => {
    for (const s of SLOTS) if (s.copy && s.cat !== 'startgame')
      for (const l of s.copy.lines) expect(s.copy.lit.includes(l), `${s.cat}: '${l}' not in ${s.copy.lit}`).toBe(true);
  });
  it('copies only words the game still says, with callers the comms window knows', () => {
    for (const s of SLOTS) {
      if (s.copy) expect(src(s.copy.from).includes(s.copy.lit), `${s.cat}: ${s.copy.from} no longer has ${s.copy.lit}`).toBe(true);
      expect(src('src/render/hype.ts').includes(`'${s.caller}'`), s.caller).toBe(true);
      if (s.slug) expect(src('src/render/hype.ts').includes(`'${s.slug}'`), s.slug).toBe(true); // the face is keyed by this clip slug
    }
  });
  it("gives SGT. RAMROD SLAB's face to exactly the slots the booth says are his (render/hype.ts SLAB_CAT, by folder)", () => {
    const re = new RegExp(/const SLAB_CAT = \/(.+)\/;/.exec(src('src/render/hype.ts'))![1]);
    for (const s of SLOTS) expect(re.test(s.cat), s.cat).toBe(s.caller === 'SGT. RAMROD SLAB');
  });
});

describe('delivery direction and length targets (LS2 review)', () => {
  it('gives every caller a delivery note, and SLAB is a deadpan, not a hype yell', () => {
    for (const s of SLOTS) expect(DIRECTION[s.caller], s.caller).toBeTruthy();
    expect(DIRECTION['SGT. RAMROD SLAB']).toMatch(/deadpan/i);
    expect(DIRECTION['SGT. RAMROD SLAB']).toMatch(/not a hype yell/i);
  });
  it('reads CALAMARI SERVED, and only it, as a joke', () => {
    expect(SLOTS.filter((s) => /joke/i.test(s.note ?? '')).map((s) => s.cat)).toEqual(['kill-ufo']);
  });
  it('sets the length target by kind: OPENED .8 s, kill words 1.2 s, hype, TAKEN DOWN and quips 2 s', () => {
    expect(MAX_LEN).toEqual({ hype: 2, bossreward: 2, kill: 1.2, carn5: .8, quip: 2 });
    for (const s of SLOTS) {
      const want = s.cat === 'carn5' ? .8 : s.cat.startsWith('kill-') ? 1.2 : /^(hype|bossreward)/.test(s.cat) ? 2 : undefined;
      expect(s.maxLen, s.cat).toBe(want);
    }
  });
});

describe('the long-take warning (LS2-booth2)', () => {
  it('warns past target + 0.5 s: hype and TAKEN DOWN 2.5 s, kill words 1.7 s, OPENED 1.3 s; nothing for an untimed slot', () => {
    expect(LEN_SLACK).toBe(0.5);
    const want: Record<string, number | null> = {};
    for (const s of SLOTS) want[s.cat] = s.cat === 'carn5' ? 1.3 : s.cat.startsWith('kill-') ? 1.7 : /^(hype|bossreward)/.test(s.cat) ? 2.5 : null;
    expect(Object.fromEntries(SLOTS.map((s) => [s.cat, lenLimit(s)]))).toEqual(want);
  });
  it('is quiet at exactly the limit and warns just past it, naming the length, the limit and the target', () => {
    const hype = slotOf('hype10')!;
    expect(lenWarn(hype, 2.5)).toBeUndefined();
    expect(lenWarn(hype, 2.51)).toMatch(/2\.51 s, over 2\.5 s; the target is 2 s/);
    expect(lenWarn(hype, 4.31)).toMatch(/long take/);
  });
  it('is quiet at exactly 1.7 s for a kill word and 1.3 s for OPENED, and warns just past', () => {
    expect(lenWarn(slotOf('kill-ufo')!, 1.7)).toBeUndefined();
    expect(lenWarn(slotOf('carn5')!, 1.3)).toBeUndefined();
    expect(lenWarn(slotOf('kill-ufo')!, 1.71)).toMatch(/over 1\.7 s/);
    expect(lenWarn(slotOf('carn5')!, 1.31)).toMatch(/over 1\.3 s/);
  });
  it('never warns without a length or a target (corpsevoice has none)', () => {
    expect(lenWarn(slotOf('hype10')!, NaN)).toBeUndefined();
    expect(lenWarn(slotOf('hype10')!, null)).toBeUndefined();
    expect(lenWarn(slotOf('corpsevoice')!, 9)).toBeUndefined();
  });
});

describe('the chain levels (LS2-booth2, audio-director)', () => {
  it('pins the signed-off numbers: expander trough+15, 3:1, -20 dB range, 5/150 ms, knee 4, trough clamp [-80, -45]; lowpass 14 kHz; clip at -0.5, hot past -3', () => {
    expect(VOX.expand).toEqual({ over: 15, ratio: 3, range: 0.1, attack: 5, release: 150, knee: 4, min: -80, max: -45 });
    expect(VOX.lowpass).toBe(14000);
    expect(VOX.clipAt).toBe(-0.5);
    expect(VOX.hotAt).toBe(-3);
    expect(VOX.squeeze).toEqual({ over: 0.4, keep: 0.25, after: 0.15, xfade: 0.005 });
    expect(VOX.denoise).toBe('afftdn=nr=10:nf=-50:tn=1'); // kept at nr=10 (audio-director)
  });
  it('sets the trim gate from the noise floor and the expander from the RMS trough, each over its own offset', () => {
    // a floor (windowed peak minimum) of -60 and a trough (RMS) of -66, both inside their clamps
    expect(levels(-60, -66)).toEqual({ gate: -60 + VOX.gate.over, expand: -66 + VOX.expand.over });
  });
  it('clamps a loud room to the top of each range, and a dead-silent one to the bottom', () => {
    expect(levels(-20, -30)).toEqual({ gate: VOX.gate.max, expand: VOX.expand.max + VOX.expand.over });
    expect(levels(-120, -140)).toEqual({ gate: VOX.gate.min, expand: VOX.expand.min + VOX.expand.over });
  });
  it('never sets the expander above -30 dBFS RMS, 8 dB under a spoken phrase, however loud the room', () => {
    expect(levels(-10, -20).expand).toBe(-30);
  });
  it('rounds a fractional floor and trough to whole dB', () => {
    expect(levels(-60.4, -66.6)).toEqual({ gate: -46, expand: -52 });
  });
  it('takes the top of each clamp when the room cannot be measured', () => {
    expect(levels(NaN, -Infinity)).toEqual({ gate: VOX.gate.max, expand: VOX.expand.max + VOX.expand.over });
  });
  it('says how hot a clipped take was and what to do', () => {
    const e = new Clipped(5.1);
    expect(e.rawPeak).toBe(5.1);
    expect(e.message).toBe('input clipped (raw peak +5.1 dBFS): lower the mic level and record it again');
    expect(new Clipped(-0.4).message).toMatch(/raw peak -0\.4 dBFS/);
  });
  it("keeps the page's HOT and CLIP marks on the plugin's thresholds and its rule: HOT past, CLIP at or above", () => {
    const b = src('tools/booth/booth.ts');
    expect(b).toContain(`HOT = 10 ** (${VOX.hotAt} / 20), CLIP = 10 ** (${VOX.clipAt} / 20)`);
    expect(b).toContain('if (p >= CLIP)');
    expect(b).toContain('if (p > HOT)');
  });
  it('draws the meter band at -10 to -6 dBFS on its -60..0 scale', () => {
    const h = src('tools/booth/booth.html');
    expect(h).toMatch(/\.meter b \{[^}]*left: 83\.333%; width: 6\.667%;/); // (60 - 10) / 60, 4 / 60
  });
});

describe('rawVerdict (the clip guard)', () => {
  it('refuses at exactly -0.5 dBFS and above, and keeps -0.51 as hot', () => {
    expect(rawVerdict(-0.5)).toBe('clip');
    expect(rawVerdict(5.1)).toBe('clip');
    expect(rawVerdict(-0.51)).toBe('hot');
  });
  it('is hot only past -3 dBFS, the same rule as the meter, and silent for an unmeasured peak', () => {
    expect(rawVerdict(-3)).toBeNull();
    expect(rawVerdict(-2.99)).toBe('hot');
    expect(rawVerdict(-7.9)).toBeNull();
    expect(rawVerdict(null)).toBeNull();
    expect(rawVerdict(-Infinity)).toBeNull();
  });
});

describe('reprocess rules', () => {
  it('matches raw takes only: never a temp file, a record, a zero or a capital', () => {
    expect(RAW_RE.exec('hype-matty-3.webm')?.[1]).toBe('hype-matty-3');
    for (const f of ['hype-matty-3.ogg.part.ogg', 'hype-matty-3.json', 'hype-matty-0.wav', 'HYPE-matty-1.wav', 'hype-matty-3.ogg.sq.wav', 'x.webm'])
      expect(RAW_RE.test(f), f).toBe(false);
  });
  it('reads a Clipped error as a take kept as it was', () => {
    expect(skipWhy(new Clipped(0.4))).toBe('input clipped (raw peak +0.4 dBFS): kept as it was');
    expect(skipWhy(new Error('spawn ffmpeg ENOENT'))).toBe('spawn ffmpeg ENOENT');
  });
  it('squeezes unless the request says squeeze=0', () => {
    expect(squeezeParam(new URLSearchParams(''))).toBe(true);
    expect(squeezeParam(new URLSearchParams('squeeze=1'))).toBe(true);
    expect(squeezeParam(new URLSearchParams('squeeze=0'))).toBe(false);
  });
  it("resets the page checkbox to the line's default after a keep and a line change (off for a quip), never on record", () => {
    const b = src('tools/booth/booth.ts');
    const rec = b.slice(b.indexOf('async function record()'), b.indexOf('function stop()'));
    expect(rec).not.toContain('S.squeeze');
    expect(b).toMatch(/squeeze: true,/);
    expect(b.slice(b.indexOf('async function keep()'), b.indexOf('async function del('))).toContain('S.squeeze = sqDefault(s)');
    expect(b.slice(b.indexOf('function move('), b.indexOf('function testGame('))).toContain('S.squeeze = sqDefault(ALL[S.sel])');
    expect(b).toContain('const sqDefault = (s: Slot) => !s.quip;');
  });
});

describe('parseArgs (the reprocess CLI)', () => {
  const REPO = '/repo', yes = () => true;
  it('refuses a bare --root rather than reading it as the current folder', () => {
    expect(parseArgs(['hype10', '--root'], REPO, yes)).toEqual({ error: USAGE });
  });
  it('refuses --root followed by a flag (--root --all is not a root called --all)', () => {
    expect(parseArgs(['--root', '--all'], REPO, yes)).toEqual({ error: USAGE });
  });
  it('refuses a root without src/sfx', () => {
    expect(parseArgs(['hype10', '--root', '/tmp'], REPO, (r) => r === REPO)).toEqual({ error: 'not a Grodius repo (no src/sfx): /tmp' });
  });
  it('refuses a folder that is not a voice slot, ../etc included, before anything runs', () => {
    expect(parseArgs(['../etc'], REPO, yes)).toEqual({ error: '"../etc" is not a voice slot (tools/booth/slots.ts) or a quip (src/voice/quips.json)' });
    expect(parseArgs(['hype10', 'bogus'], REPO, yes)).toMatchObject({ error: expect.stringContaining('"bogus"') });
  });
  it('refuses no folders at all, and an unknown flag', () => {
    expect(parseArgs([], REPO, yes)).toEqual({ error: USAGE });
    expect(parseArgs(['--squeeze'], REPO, yes)).toEqual({ error: USAGE });
  });
  it('takes folders, --all, --no-squeeze and --root, defaulting to the script\'s repo and squeezing', () => {
    expect(parseArgs(['hype10', 'hype10', 'carn5'], REPO, yes)).toEqual({ root: REPO, cats: ['hype10', 'carn5'], squeeze: true });
    expect(parseArgs(['--all', '--no-squeeze', '--root', '/other'], REPO, yes)).toEqual({ root: '/other', cats: SLOTS.map((s) => s.cat), squeeze: false });
  });
});

describe('the clip guard reads the raw as recorded', () => {
  it('measures the float peak over the channels, never a mono downmix (Chrome writes two identical channels: +3 dB)', () => {
    const p = src('tools/booth/plugin.ts');
    const peak = p.slice(p.indexOf('async function peakOf('), p.indexOf('export function levels('));
    expect(peak).toContain('sample_fmts=flt');
    expect(peak).not.toContain('channel_layouts=mono');
    expect(peak).toContain('Peak_level');
  });
});

describe('squeezeCuts', () => {
  const Q = { over: 0.4, keep: 0.25, after: 0.15 };
  it('cuts a 1 s pause to 0.25 s, keeping 0.15 s after the word and 0.1 s before the next', () => {
    const [[a, b]] = squeezeCuts([1.0], [2.0], Q);
    expect(a).toBeCloseTo(1.15, 9);
    expect(b).toBeCloseTo(1.9, 9);
    expect(1.0 - (b - a)).toBeCloseTo(Q.keep, 9);
  });
  it('leaves a pause of 0.4 s or less alone (a breath between words stays as read)', () => {
    expect(squeezeCuts([1.0, 2.0], [1.4, 2.39], Q)).toEqual([]);
    expect(squeezeCuts([0], [0.4], Q)).toEqual([]);
    expect(squeezeCuts([0], [0.41], Q).length).toBe(1);
  });
  it('cuts nothing when the pause is shorter than what it keeps', () => {
    expect(squeezeCuts([0], [0.5], { over: 0.1, keep: 0.6, after: 0.15 })).toEqual([]);
  });
  it('ignores an unmatched end and a pause that is not a number', () => {
    expect(squeezeCuts([1], [2, 3], Q).length).toBe(1);
    expect(squeezeCuts([NaN], [1], Q)).toEqual([]);
  });
  it('leaves a pause that ends at the end of the file to the tail trim (ffmpeg reports one at EOF)', () => {
    expect(squeezeCuts([1, 3], [2, 4], Q, 4)).toEqual([[expect.closeTo(1.15, 9), expect.closeTo(1.9, 9)]]);
  });
  it('cuts only the long pauses of several, in order', () => {
    const cuts = squeezeCuts([0.5, 1.2, 2.0], [0.7, 1.9, 2.5], Q);
    expect(cuts.length).toBe(2);
    expect(cuts[0][0]).toBeCloseTo(1.35, 9);
    expect(cuts[1][1]).toBeCloseTo(2.4, 9);
  });
  it('ignores a pause that runs into the end of the file (no end: the tail trim owns it)', () => {
    expect(squeezeCuts([1.0, 3.0], [2.0], Q).length).toBe(1);
  });
  it('treats a negative start (silencedetect at the file head) as 0', () => {
    const [[a]] = squeezeCuts([-0.01], [0.6], Q);
    expect(a).toBeCloseTo(0.15, 9);
  });
});

describe('?vox= hook', () => {
  const vox = src('src/vox.ts');
  it('makes the same sample() call as each line it fires', () => {
    const where: Record<string, string> = { corpsevoice: 'src/enemies/update.ts', bossreward: 'src/stages.ts', startgame: 'src/menus.ts', carn5: 'src/fx/update.ts' };
    expect(Object.keys(where).sort()).toEqual(SLOTS.filter((s) => s.wired && !/^(hype|kill-)/.test(s.cat)).map((s) => s.cat).sort());
    for (const [cat, f] of Object.entries(where)) {
      const call = new RegExp(`sample\\('${cat}', \\{[^}]*\\}\\)`).exec(vox)?.[0];
      expect(call, cat).toBeTruthy();
      expect(src(f).includes(call!), `${f} no longer calls ${call}`).toBe(true);
    }
    // the kill words: one call for every kind, with killEnemy's options (it builds the folder as 'kill-' + e.k)
    const kill = /sample\('kill-' \+ k, (\{[^}]*\})\)/.exec(vox)?.[1];
    expect(kill).toBeTruthy();
    expect(src('src/enemies/update.ts').includes(`sample('kill-' + e.k, ${kill})`), `killEnemy no longer calls sample('kill-' + e.k, ${kill})`).toBe(true);
  });
  it('never runs the once-a-stage corpse count or the OPENED cooldown (it tests the line, not the rule)', () => {
    const code = vox.replace(/^\s*\/\/.*$/gm, ''); // the header says what it skips, in words
    expect(code).not.toMatch(/corpseKilled|corpseN|corpseVo|\.st\b|opened\(|openedAt/);
  });
  it('fires every wired slot, and every test query names its own folder', () => {
    const hypeKeys = [...src('src/fx/update.ts').matchAll(/^\s*(\d+): \[/gm)].map((m) => 'hype' + m[1]);
    for (const s of SLOTS.filter((x) => x.wired)) {
      expect(new URLSearchParams(s.test!).get('vox'), s.cat).toBe(s.cat);
      const fires = hypeKeys.includes(s.cat) || vox.includes(`sample('${s.cat}', {`) || (s.cat.startsWith('kill-') && vox.includes("sample('kill-' + k, {"));
      expect(fires, `${s.cat} has no VOX_FIRE entry`).toBe(true);
    }
  });
  it('is loaded by main.ts on the dev server only', () => {
    expect(src('src/main.ts')).toMatch(/if \(import\.meta\.env\.DEV\) import\('\.\/vox'\)/);
    expect(vox).not.toMatch(/\bR\(|Math\.random|Date\.now/);
  });
});

describe('the booth page', () => {
  it('never pulls in the Vite client, so a keep cannot reload it: no CSS, no HMR, no import outside tools/booth but the quip rules', () => {
    // LS2-quips: src/voice/quiplist.ts, the one game file the page and slots.ts read, is itself a leaf with no imports
    for (const f of ['tools/booth/booth.ts', 'tools/booth/slots.ts', 'tools/booth/names.ts', 'src/voice/quiplist.ts']) {
      const t = src(f);
      expect(t, f).not.toMatch(/\.css['"]/);
      expect(t, f).not.toMatch(/import\.meta\.hot/);
      for (const m of t.matchAll(/^import [^'"]*['"]([^'"]+)['"]/gm)) expect(m[1], f).toMatch(/^(\.\/[a-z]+|\.\.\/\.\.\/src\/voice\/quiplist(\.ts)?)$/);
    }
    expect(src('src/voice/quiplist.ts')).not.toMatch(/^import /m);
  });
  it('keeps the text frame from writing the save or acting on input before any game module runs', () => {
    const h = src('tools/booth/text.html');
    const guardAt = h.indexOf('Storage.prototype.setItem'), modAt = h.indexOf('type="module"');
    expect(guardAt).toBeGreaterThan(0);
    expect(guardAt).toBeLessThan(modAt);
    for (const ev of ['pagehide', 'blur', 'visibilitychange', 'keydown']) expect(h).toContain(`'${ev}'`);
  });
});

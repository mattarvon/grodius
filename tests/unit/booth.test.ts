// The voice booth (LS2-booth): the name rules every path the dev plugin writes is built from, its request guard, the
// slot list against the game it describes, and the ?vox= hook's calls against the call sites they copy.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { CAT_RE, SLUG_MAX, TAKE_RE, gainTo, nextTake, okCat, rawExt, slugify, takeName } from '../../tools/booth/names';
import { SLOTS, slotOf } from '../../tools/booth/slots';
import { guard } from '../../tools/booth/plugin';

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
  it('gives names the delete endpoint accepts, and only those', () => {
    expect(TAKE_RE.test(takeName('taken-down', 12))).toBe(true);
    for (const n of ['../x-matty-1.ogg', 'x-matty-1.ogg/..', 'x-matty-0.ogg', 'x-matty-1.wav', 'X-matty-1.ogg', 'lesley.ogg']) expect(TAKE_RE.test(n)).toBe(false);
  });
});

describe('rawExt and gainTo', () => {
  it('maps recorder types to an extension and refuses anything else', () => {
    expect(rawExt('audio/webm;codecs=opus')).toBe('webm');
    expect(rawExt('audio/ogg; codecs=opus')).toBe('ogg');
    expect(rawExt('text/html')).toBe(null);
    expect(rawExt(undefined)).toBe(null);
  });
  it('gives the gain to the target, and null for a silent take', () => {
    expect(gainTo(-12, -30)).toBe(18);
    expect(gainTo(-12, -9.5)).toBe(-2.5);
    expect(gainTo(-12, -70)).toBe(null);
    expect(gainTo(-12, null)).toBe(null);
  });
});

describe('guard', () => {
  const req = (o: { ip?: string; method?: string; headers?: Record<string, string> }) =>
    ({ method: o.method ?? 'GET', socket: { remoteAddress: o.ip ?? '127.0.0.1' }, headers: { host: 'localhost:5173', ...o.headers } }) as any;
  const write = { method: 'POST', headers: { origin: 'http://localhost:5173', 'x-booth': '1' } };
  it('lets this machine read and write', () => {
    expect(guard(req({}))).toBe(null);
    expect(guard(req({ ip: '::1' }))).toBe(null);
    expect(guard(req({ ip: '::ffff:127.0.0.1', ...write }))).toBe(null);
  });
  it('refuses the LAN even with every header right (npm run dev passes --host)', () => {
    expect(guard(req({ ip: '10.0.0.13', ...write }))).toMatch(/loopback/);
  });
  it('refuses a foreign Host (DNS rebinding)', () => {
    expect(guard(req({ headers: { host: 'evil.example:5173' } }))).toMatch(/Host/);
  });
  it('refuses a write from another origin or without the booth header', () => {
    expect(guard(req({ method: 'POST', headers: { origin: 'http://evil.example', 'x-booth': '1' } }))).toMatch(/Origin/);
    expect(guard(req({ method: 'POST', headers: { 'x-booth': '1' } }))).toMatch(/Origin/);
    expect(guard(req({ method: 'DELETE', headers: { origin: 'http://localhost:5173' } }))).toMatch(/x-booth/);
  });
});

describe('the slot list', () => {
  const voiceCat = new RegExp(/const VOICE_CAT = \/(.+)\/;/.exec(src('src/audio.ts'))![1]);
  it('has one plain, unique folder per slot', () => {
    expect(new Set(SLOTS.map((s) => s.cat)).size).toBe(SLOTS.length);
    for (const s of SLOTS) expect(s.cat).toMatch(CAT_RE);
    expect(slotOf('warning')).toBe(undefined);
  });
  it('wires exactly the folders the game plays as voice today', () => {
    expect(SLOTS.filter((s) => s.wired).map((s) => s.cat)).toEqual(['hype10', 'hype20', 'hype35', 'hype50', 'hype75', 'hype100', 'bossreward', 'corpsevoice', 'startgame']);
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
  it('copies only words the game still says, with callers the comms window knows', () => {
    for (const s of SLOTS) {
      if (s.copy) expect(src(s.copy.from).includes(s.copy.lit), `${s.cat}: ${s.copy.from} no longer has ${s.copy.lit}`).toBe(true);
      expect(src('src/render/hype.ts').includes(`'${s.caller}'`), s.caller).toBe(true);
      if (s.slug) expect(src('src/render/hype.ts').includes(`'${s.slug}'`), s.slug).toBe(true); // the face is keyed by this clip slug
    }
  });
});

describe('?vox= hook', () => {
  const vox = src('src/vox.ts');
  it('makes the same sample() call as each line it fires', () => {
    const where: Record<string, string> = { corpsevoice: 'src/enemies/update.ts', bossreward: 'src/stages.ts', startgame: 'src/menus.ts' };
    for (const [cat, f] of Object.entries(where)) {
      const call = new RegExp(`sample\\('${cat}', \\{[^}]*\\}\\)`).exec(vox)?.[0];
      expect(call, cat).toBeTruthy();
      expect(src(f).includes(call!), `${f} no longer calls ${call}`).toBe(true);
    }
  });
  it('is loaded by main.ts on the dev server only', () => {
    expect(src('src/main.ts')).toMatch(/if \(import\.meta\.env\.DEV\) import\('\.\/vox'\)/);
    expect(vox).not.toMatch(/\bR\(|Math\.random|Date\.now/);
  });
});

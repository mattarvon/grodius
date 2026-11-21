// A keep filed from its preview (tools/booth/plugin.ts: POST /__booth/take &preview=<id>) against one rendered from
// scratch, through the real plugin on a throwaway Vite dev server (an OS-picked port, a temp repo root) and real
// ffmpeg: the same answer, the same .json record and the same audio. And the cases that must render instead: another
// squeeze, another rack, other bytes, an id already used. Runs only where ffmpeg and ffprobe are on PATH (like
// booth-fx-ffmpeg, which fails on CI without them). The take is synthetic, made here.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createServer, type ViteDevServer } from 'vite';
import { booth } from '../../tools/booth/plugin';
import { PRESETS } from '../../tools/booth/fx';

const has = (bin: string) => { try { execFileSync(bin, ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } };
const FF = has('ffmpeg') && has('ffprobe');
const SKIP = 'SKIPPED: the keep-from-preview test (booth-keep-preview) did not run: ffmpeg/ffprobe are not on PATH';
if (!FF) {
  console.warn(SKIP);
  it(SKIP, () => { if (process.env.CI) throw new Error(`${SKIP} on CI`); });
}

const SR = 48000, CAT = 'hype10', SLUG = 'cache-test';
const ROBOT = PRESETS.find((p) => p.name === 'Robot')!.fx;
/** a 1.6 s voiced take over a quiet room, 16-bit mono wav; `seed` varies the room so two takes differ in their bytes */
function synth(seed: number): Buffer {
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const len = Math.round(1.6 * SR), x = new Float32Array(len);
  for (const [a, n] of [[0.5, 2], [1.05, 1]] as const) for (let s = 0; s < n; s++) {
    const t0 = Math.round((a + s * 0.25) * SR), L = Math.round(0.2 * SR);
    for (let i = 0; i < L; i++) {
      const t = i / L, env = t < 0.1 ? t / 0.1 : t > 0.6 ? Math.exp(-(t - 0.6) * 9) : 1;
      let v = 0;
      for (let k = 1; k < 20; k++) v += Math.sin(2 * Math.PI * 120 * k * (i / SR)) / k;
      x[t0 + i] += 0.25 * v * env;
    }
  }
  for (let i = 0; i < len; i++) x[i] += 0.01 * (rnd() * 2 - 1);
  const b = Buffer.alloc(44 + len * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + len * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(len * 2, 40);
  x.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  return b;
}

let root: string, server: ViteDevServer, base: string, token: string;
beforeAll(async () => {
  if (!FF) return;
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'booth-keep-preview-'));
  fs.mkdirSync(path.join(root, 'tools', 'booth'), { recursive: true });
  fs.copyFileSync(path.resolve('tools/booth/booth.html'), path.join(root, 'tools', 'booth', 'booth.html'));
  server = await createServer({ root, configFile: false, logLevel: 'silent', plugins: [booth()], server: { port: 0, host: '127.0.0.1', strictPort: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] } });
  await server.listen();
  base = `http://localhost:${(server.httpServer!.address() as AddressInfo).port}`;
  const page = await (await fetch(base + '/booth.html')).text();
  token = /[0-9a-f]{32}/.exec(page)![0];
}, 30_000);
afterAll(async () => {
  await server?.close();
  if (root) fs.rmSync(root, { recursive: true, force: true });
});

const post = (ep: string, q: Record<string, string>, body: Buffer) => fetch(`${base}/__booth/${ep}?${new URLSearchParams(q)}`, {
  method: 'POST', body, headers: { 'x-booth': token, origin: base, 'content-type': 'audio/wav' },
});
async function previewOf(body: Buffer, q: Record<string, string>) {
  const r = await post('preview', { cat: CAT, ...q }, body);
  expect(r.status).toBe(200);
  return JSON.parse(decodeURIComponent(r.headers.get('x-booth-info')!)) as { preview?: string; lufs: number };
}
async function keep(body: Buffer, q: Record<string, string>) {
  const r = await post('take', { cat: CAT, slug: SLUG, ...q }, body);
  const j = await r.json();
  expect(r.status, JSON.stringify(j)).toBe(200);
  return { j, promoted: r.headers.get('x-booth-promoted') === '1' };
}
const rec = (name: string) => fs.readFileSync(path.join(root, 'assets-raw', 'voice', CAT, name.replace(/\.ogg$/, '.json')), 'utf8');
const pcm = (name: string) => execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(root, 'src', 'sfx', CAT, name), '-f', 'md5', '-']).toString().trim();
/** the answer without what differs between two keeps by design: the take's number */
const same = (j: Record<string, unknown>) => { const { name: _n, url: _u, raw: _r, ...rest } = j; return rest; };

describe.skipIf(!FF)('keep from the preview (real plugin, real ffmpeg)', () => {
  it('files the preview render: the same answer, record and audio as a keep rendered from scratch', async () => {
    const body = synth(11), fx = JSON.stringify(ROBOT);
    const info = await previewOf(body, { fx });
    expect(info.preview).toMatch(/^[0-9a-f]{24}$/);
    const a = await keep(body, { fx, preview: info.preview! });
    const b = await keep(body, { fx });
    expect(a.promoted).toBe(true);
    expect(b.promoted).toBe(false);
    expect(a.j.name).not.toBe(b.j.name);
    expect(same(a.j)).toEqual(same(b.j));
    expect(a.j.lufs).toBe(info.lufs);
    expect(rec(a.j.name)).toBe(rec(b.j.name));
    expect(pcm(a.j.name)).toBe(pcm(b.j.name));
    // the raw take is filed as ever
    expect(fs.readFileSync(path.join(root, a.j.raw))).toEqual(body);
    // and the id is spent: a second keep naming it renders
    expect((await keep(body, { fx, preview: info.preview! })).promoted).toBe(false);
  }, 120_000);
  it('a clean keep of a clean preview, squeeze off (the A render is kept too)', async () => {
    const body = synth(12);
    const info = await previewOf(body, { fx: '{}', squeeze: '0' });
    const a = await keep(body, { squeeze: '0', preview: info.preview! });
    const b = await keep(body, { squeeze: '0' });
    expect(a.promoted).toBe(true);
    expect(same(a.j)).toEqual(same(b.j));
    expect(rec(a.j.name)).toBe(rec(b.j.name));
    expect(pcm(a.j.name)).toBe(pcm(b.j.name));
  }, 120_000);
  it('renders instead when the keep is not what was previewed: another squeeze, rack or take', async () => {
    const body = synth(13), fx = JSON.stringify(ROBOT);
    const p1 = await previewOf(body, { fx });
    // (each of these renders in full: the other mismatches, and the malformed ids, are cache.ts's unit tests)
    expect((await keep(body, { fx, squeeze: '0', preview: p1.preview! })).promoted).toBe(false);
    expect((await keep(synth(14), { fx, preview: p1.preview! })).promoted).toBe(false);
    // a mismatch leaves it for the keep that matches
    expect((await keep(body, { fx, preview: p1.preview! })).promoted).toBe(true);
  }, 180_000);
});

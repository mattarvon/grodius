// The voice booth's dev-server half (LS2-booth): serves /booth.html and the /__booth/ endpoints that list, save and
// delete takes. `apply: 'serve'`, so `vite build` never loads it: the production bundle and the APK carry neither the
// page nor the endpoints (the proof is a grep of dist/, production/qa/evidence/ls2-booth.md).
//
// Endpoints (all refuse a request that isn't from this machine, see guard()):
//   GET    /__booth/takes                      -> { [cat]: ["<slug>-matty-<n>.ogg", ...] } for every slot
//   POST   /__booth/take?cat=<cat>&slug=<s>    body: the raw recording (audio/webm|ogg|wav|mp4, <= 25 MB)
//          saves the raw take to assets-raw/voice/<cat>/ (git-ignored), runs the ffmpeg chain below and writes
//          src/sfx/<cat>/<slug>-matty-<n>.ogg; -> { name, url, lufs, peak, dur }
//   DELETE /__booth/take?cat=<cat>&name=<file> removes one processed take (the raw stays in assets-raw/)
// Every path is built from slots.ts (the category must be a slot) and names.ts (sanitised slug, numbered name),
// never from the request as written.
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { slotOf, SLOTS } from './slots.ts';
import { gainTo, nextTake, okCat, rawExt, slugify, takeName, TAKE_RE } from './names.ts';

const run = promisify(execFile);

/** the processing chain (audio-director sign-off in production/qa/evidence/ls2-booth.md) */
export const VOX = {
  /** integrated loudness the takes are matched to: the voiced clips in the game measure -12.2 (corpsevoice) and
   *  -11.7 LUFS (startgame) with ebur128; the shelved hype/bossreward takes -12.9 to -13.7. sample() plays voice at
   *  vol 1.1-1.15, so a new take at -12 sits with the two that ship */
  lufs: -12,
  /** sample ceiling after the gain, linear (0.891 = -1 dBFS): the shipped clips peak at -0.8 and -1.2 dBFS */
  ceil: 0.891,
  /** rumble and desk thumps off; the lowest male fundamental is above it */
  highpass: 80,
  /** light FFT denoise for the laptop mic: 10 dB reduction against a tracked noise floor. A USB mic in a quiet room
   *  barely needs it, and more starts to smear consonants */
  denoise: 'afftdn=nr=10:nf=-50:tn=1',
  /** below this a frame counts as silence for the head and tail trim; keeps 50 ms before the first word and 120 ms
   *  after the last so plosives and the tail of a breath aren't clipped */
  gate: '-45dB',
  head: 0.05,
  tail: 0.12,
  /** Vorbis quality 5 (~160 kbit/s mono): the shipped clips are q5-ish; a 2 s line is ~40 KB */
  q: 5,
  /** within this many LU of the target is on target (the shipped clips sit 0.3 LU either side of -12) */
  tol: 0.5,
  /** most extra gain the second pass may add into the limiter */
  makeup: 3,
} as const;

const MAX_BODY = 25 * 1024 * 1024; // a minute of 256 kbit/s Opus is ~2 MB; this only stops a runaway upload

/** the loopback addresses a booth request may come from: `npm run dev` passes --host, so the dev server listens on
 *  the LAN too, but the booth answers only this machine */
const LOOP = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** null if the request may use the booth, else why not. Loopback socket; Host must name this machine (a DNS-rebinding
 *  page has its own host name); a write must also carry Origin = Host and the x-booth header, which a cross-site
 *  form or fetch cannot send without a CORS preflight that this server never answers */
export function guard(req: Pick<IncomingMessage, 'method' | 'headers' | 'socket'>): string | null {
  if (!LOOP.has(req.socket?.remoteAddress ?? '')) return 'booth: loopback only';
  const host = String(req.headers.host ?? '');
  if (!LOCAL_HOST.test(host)) return 'booth: bad Host';
  if (req.method === 'GET') return null;
  const origin = String(req.headers.origin ?? '');
  if (origin !== 'http://' + host) return 'booth: bad Origin';
  if (req.headers['x-booth'] !== '1') return 'booth: missing x-booth header';
  return null;
}

function send(res: ServerResponse, code: number, body: unknown) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((ok, no) => {
    const parts: Buffer[] = [];
    let n = 0;
    req.on('data', (c: Buffer) => {
      n += c.length;
      if (n > MAX_BODY) { no(new Error('booth: take too large')); req.destroy(); return; }
      parts.push(c);
    });
    req.on('end', () => ok(Buffer.concat(parts)));
    req.on('error', no);
  });
}

const list = (dir: string) => { try { return fs.readdirSync(dir); } catch { return []; } };

/** integrated loudness and true-ish peak of a file, from ffmpeg's ebur128 summary */
export async function measure(file: string): Promise<{ lufs: number | null; peak: number | null; dur: number | null }> {
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=sample', '-f', 'null', '-'], { maxBuffer: 1 << 24 });
  const sum = stderr.slice(stderr.lastIndexOf('Summary:'));
  const num = (re: RegExp) => { const m = re.exec(sum); return m ? +m[1] : null; };
  const pr = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  const dur = Math.round(+pr.stdout.trim() * 1000) / 1000 || null;
  return { lufs: num(/I:\s*(-?[\d.]+) LUFS/), peak: num(/Peak:\s*(-?[\d.inf]+) dBFS/), dur };
}

/** raw take -> the game's clip: mono, highpass, denoise, head/tail trim, a 10 ms fade at each cut, gain to VOX.lufs,
 *  a -1 dBFS ceiling, 44.1 kHz Vorbis. Two passes: the trim has to happen before the loudness is measured */
export async function processTake(raw: string, out: string) {
  const tmp = out.replace(/\.ogg$/, '.tmp.wav');
  const trim = (s: number) => `silenceremove=start_periods=1:start_threshold=${VOX.gate}:start_silence=${s}:detection=peak`;
  const chain = [
    'aformat=channel_layouts=mono',
    `highpass=f=${VOX.highpass}`,
    VOX.denoise,
    trim(VOX.head), 'afade=t=in:d=0.01',
    'areverse', trim(VOX.tail), 'afade=t=in:d=0.01', 'areverse',
  ].join(',');
  try {
    await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-af', chain, '-ar', '44100', '-ac', '1', tmp]);
    const pre = await measure(tmp);
    let g = gainTo(VOX.lufs, pre.lufs);
    if (g == null) throw new Error('booth: the take is silent or too short to measure (nothing above the gate?)');
    const enc = (gain: number) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', tmp,
      '-af', `volume=${gain}dB,alimiter=limit=${VOX.ceil}:level=false:attack=1:release=40`,
      '-ar', '44100', '-ac', '1', '-c:a', 'libvorbis', '-q:a', String(VOX.q), out]);
    await enc(g);
    let m = await measure(out);
    // a peaky take loses loudness to the ceiling: one more pass makes up the shortfall, at most VOX.makeup dB, so a
    // take that only reaches the target by being crushed comes back quiet rather than squashed
    const short = m.lufs == null ? 0 : VOX.lufs - m.lufs;
    if (short > VOX.tol) {
      g += Math.min(short, VOX.makeup);
      await enc(g);
      m = await measure(out);
    }
    return { gain: Math.round(g * 100) / 100, ...m };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/** the booth plugin: dev server only */
export function booth(): Plugin {
  let root = process.cwd();
  // keeps are processed one at a time, so two quick keeps can't pick the same take number
  let queue: Promise<unknown> = Promise.resolve();
  return {
    name: 'grodius-voice-booth',
    apply: 'serve',
    configResolved(c) { root = c.root; },
    configureServer(server: ViteDevServer) {
      const sfx = path.join(root, 'src', 'sfx'), rawDir = path.join(root, 'assets-raw', 'voice');
      const page = path.join(root, 'tools', 'booth', 'booth.html');
      server.middlewares.use((req, res, next) => {
        const u = new URL(req.url ?? '/', 'http://x');
        const isPage = u.pathname === '/booth.html';
        if (!isPage && !u.pathname.startsWith('/__booth/')) return next();
        const bad = guard(req);
        if (bad) return send(res, 403, { error: bad });
        // served as written, not through transformIndexHtml: no Vite client, so a keep (a new file the audio glob
        // sees) reloads the game tab but never the booth
        if (isPage) {
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.setHeader('cache-control', 'no-store');
          return res.end(fs.readFileSync(page));
        }
        const cat = u.searchParams.get('cat') ?? '';
        const catDir = (base: string) => {
          if (!okCat(cat) || !slotOf(cat)) return null;
          const d = path.join(base, cat);
          return path.dirname(d) === base ? d : null; // belt and braces: okCat already forbids dots and slashes
        };
        if (u.pathname === '/__booth/takes' && req.method === 'GET') {
          const out: Record<string, string[]> = {};
          for (const s of SLOTS) out[s.cat] = list(path.join(sfx, s.cat)).filter((f) => /\.(ogg|wav|mp3|m4a)$/.test(f)).sort();
          return send(res, 200, out);
        }
        if (u.pathname !== '/__booth/take') return send(res, 404, { error: 'booth: no such endpoint' });
        const dir = catDir(sfx), rdir = catDir(rawDir);
        if (!dir || !rdir) return send(res, 400, { error: `booth: ${JSON.stringify(cat)} is not a voice slot` });
        if (req.method === 'DELETE') {
          const name = u.searchParams.get('name') ?? '';
          if (!TAKE_RE.test(name)) return send(res, 400, { error: 'booth: not a take name' });
          fs.rmSync(path.join(dir, name), { force: true });
          return send(res, 200, { deleted: name });
        }
        if (req.method !== 'POST') return send(res, 405, { error: 'booth: method' });
        const slug = slugify(u.searchParams.get('slug'));
        const ext = rawExt(req.headers['content-type']);
        if (!slug) return send(res, 400, { error: 'booth: empty slug' });
        if (!ext) return send(res, 415, { error: 'booth: body must be recorded audio' });
        const job = queue.then(async () => {
          const body = await readBody(req);
          if (body.length < 256) throw new Error('booth: empty take');
          fs.mkdirSync(dir, { recursive: true });
          fs.mkdirSync(rdir, { recursive: true });
          const n = nextTake([...list(dir), ...list(rdir)], slug);
          const name = takeName(slug, n), raw = path.join(rdir, name.replace(/\.ogg$/, '.' + ext));
          fs.writeFileSync(raw, body);
          // written beside the folder and renamed in, so the audio glob never sees a half-written .ogg
          const part = path.join(rdir, name + '.part.ogg');
          try {
            const r = await processTake(raw, part);
            fs.renameSync(part, path.join(dir, name));
            return { name, url: `/src/sfx/${cat}/${name}`, raw: path.relative(root, raw), ...r };
          } finally {
            fs.rmSync(part, { force: true });
          }
        });
        queue = job.catch(() => {});
        job.then((r) => send(res, 200, r), (e) => send(res, 500, { error: String(e?.message ?? e) }));
      });
    },
  };
}

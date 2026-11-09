// The voice booth's dev-server half (LS2-booth): serves /booth.html (and its text frame) and the /__booth/ endpoints
// that list, save and delete takes. `apply: 'serve'`, so `vite build` never loads it: the production bundle and the
// APK carry neither the pages nor the endpoints (the dist grep is in production/qa/evidence/ls2-booth.md).
//
// Endpoints (guard() below; every one needs the per-process token the booth page is served with):
//   GET    /__booth/takes                      -> { [cat]: ["<slug>-matty-<n>.ogg", ...] } for every slot
//   POST   /__booth/take?cat=<cat>&slug=<s>    body: the raw recording (audio/webm|ogg|wav|mp4, <= 25 MB)
//          saves the raw take to assets-raw/voice/<cat>/ (git-ignored), runs the ffmpeg chain below and writes
//          src/sfx/<cat>/<slug>-matty-<n>.ogg; -> { name, url, lufs, peak, dur, gain, warn? }
//   DELETE /__booth/take?cat=<cat>&name=<file> removes one processed take (a raw take stays in assets-raw/)
// Every path is built from slots.ts (the category must be a slot) and names.ts (sanitised slug, numbered name),
// never from the request as written. Requires ffmpeg and ffprobe on PATH.
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { slotOf, SLOTS } from './slots.ts';
import { TAKE_MAX, gainTo, nextTake, okCat, rawExt, slugify, takeName, TAKE_RE } from './names.ts';

const exec = promisify(execFile);
/** every ffmpeg/ffprobe call: a hung decoder must not hold the keep queue for ever */
const run = (cmd: string, args: string[]) => exec(cmd, args, { timeout: 60_000, killSignal: 'SIGKILL', maxBuffer: 1 << 24 });

/** the processing chain. Audio-director sign-off (with changes, applied here): production/qa/evidence/ls2-booth.md */
export const VOX = {
  /** integrated loudness the takes are matched to: the voiced clips in the game measure -12.2 (corpsevoice) and
   *  -11.7 LUFS (startgame) with ebur128; the shelved hype/bossreward takes -12.9 to -13.7. sample() plays voice at
   *  vol 1.1-1.15, so a new take at -12 sits with the two that ship */
  lufs: -12,
  /** sample ceiling after the gain, linear (0.87 = -1.2 dBFS): the Vorbis encode overshoots the limiter a little, and
   *  the shipped clips peak at -0.8 and -1.2 dBFS */
  ceil: 0.87,
  /** limiter release, ms: 40 distorted hard-limited low syllables (audio-director) */
  release: 80,
  /** rumble and desk thumps off; the lowest male fundamental is above it. A 2-pole filter: 50 Hz hum loses ~8 dB */
  highpass: 80,
  /** light FFT denoise for the laptop mic: 10 dB reduction against a tracked noise floor (it learns the room in the
   *  lead-in). Never above 12: consonants start to smear at 15-20 dB. A quiet take is a gain problem, see quiet */
  denoise: 'afftdn=nr=10:nf=-50:tn=1',
  /** the key click that starts and stops every take (the laptop mic sits over the keyboard): cut before the trim,
   *  or the trim stops at the click and keeps it. A reaction to Space is longer than the head cut */
  click: { head: 0.12, tail: 0.2 },
  /** the head/tail trim's silence gate (peak detection), set per take from the room: the quietest 50 ms of the
   *  cleaned-up take (astats noise floor, an RMS) plus `over`, which clears the noise's own peaks, clamped to
   *  [min, max]. A fixed -45 cut soft onsets (the S of SEVERED) on a quiet take; a fixed -55 kept a noisy room's
   *  tail. Measured before the gain, after the denoise */
  gate: { over: 14, min: -60, max: -40 },
  /** kept before the first word and after the last: a soft onset, and the breath or growl a grim line ends on */
  head: 0.09,
  tail: 0.25,
  /** fades at the cuts: a click-free head, and a tail that decays rather than stops */
  fadeIn: 0.01,
  fadeOut: 0.05,
  /** Vorbis quality 5 (~80-100 kbit/s mono): transparent for voice; a 2 s line is ~20-25 KB */
  q: 5,
  /** within this many LU of the target is on target (the shipped clips sit 0.3 LU either side of -12) */
  tol: 0.5,
  /** the voice compressor after the gain to the target (see processTake pass 1): 3:1 over -20 dBFS with a soft knee,
   *  slow enough (10 ms) to leave consonant attacks to the limiter, released between syllables */
  comp: 'acompressor=threshold=-20dB:ratio=3:attack=10:release=150:knee=6',
  /** most extra gain the second pass may add into the limiter: a peaky take comes back a little quiet, not crushed */
  makeup: 3,
  /** a take needing more gain than this brings the room's hiss up with it: the booth says move closer / raise the
   *  input gain (the denoise is not turned up for it) */
  quiet: 18,
} as const;

const MAX_BODY = 25 * 1024 * 1024; // a minute of 256 kbit/s Opus is ~2 MB; this only stops a runaway upload

/** the loopback addresses a booth request may come from: `npm run dev` passes --host, so the dev server listens on
 *  the LAN too, but the booth answers only this machine */
const LOOP = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
/** a forwarder (ngrok, cloudflared, an ssh tunnel, a reverse proxy) connects from loopback and can rewrite Host:
 *  the headers proxies add are refused outright. Never tunnel the dev server */
const FWD = ['x-forwarded-for', 'x-forwarded-host', 'forwarded', 'via', 'x-real-ip'];

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** null if the request may use the booth, else why not. Loopback socket, no proxy headers, a Host naming this
 *  machine (a DNS-rebinding page has its own host name). The page itself (token null) needs only that. An endpoint
 *  also needs the per-process token the page was served with, in x-booth; a write also needs Origin = Host. Note
 *  Vite's cors middleware does answer another localhost origin's preflight, so the token and the Origin check are
 *  what stop a page on another local port, not the preflight */
export function guard(req: Pick<IncomingMessage, 'method' | 'headers' | 'socket'>, token: string | null): string | null {
  if (!LOOP.has(req.socket?.remoteAddress ?? '')) return 'booth: loopback only';
  if (FWD.some((h) => req.headers[h] != null)) return 'booth: forwarded request';
  const host = String(req.headers.host ?? '');
  if (!LOCAL_HOST.test(host)) return 'booth: bad Host';
  if (token == null) return req.method === 'GET' ? null : 'booth: method';
  const x = req.headers['x-booth'];
  if (typeof x !== 'string' || !same(x, token)) return 'booth: missing or wrong x-booth token';
  if (req.method === 'GET') return null;
  if (String(req.headers.origin ?? '') !== 'http://' + host) return 'booth: bad Origin';
  return null;
}

function send(res: ServerResponse, code: number, body: unknown) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

/** the whole body, or a rejection: too large, aborted, or stalled for 30 s. Read before the keep queue, so a
 *  client that goes away can't hold the queue */
function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((ok, no) => {
    if (+(req.headers['content-length'] ?? 0) > MAX_BODY) return no(new Error('booth: take too large'));
    if (req.destroyed || req.readableAborted) return no(new Error('booth: upload aborted'));
    const parts: Buffer[] = [];
    let n = 0;
    req.setTimeout(30_000, () => { no(new Error('booth: upload stalled')); req.destroy(); });
    req.on('data', (c: Buffer) => {
      n += c.length;
      if (n > MAX_BODY) { no(new Error('booth: take too large')); req.destroy(); return; }
      parts.push(c);
    });
    req.on('end', () => ok(Buffer.concat(parts)));
    req.on('error', no);
    req.on('close', () => { if (!req.complete) no(new Error('booth: upload aborted')); });
  });
}

const list = (dir: string) => { try { return fs.readdirSync(dir); } catch { return []; } };

/** integrated loudness, true peak and length of a file. Padded with 0.5 s of silence first: ebur128 needs a 400 ms
 *  block, and a one-word kill line can be shorter; silence sits under the -70 LUFS gate, so it doesn't skew the
 *  reading */
export async function measure(file: string): Promise<{ lufs: number | null; peak: number | null; dur: number | null }> {
  const { stderr } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'apad=pad_dur=0.5,ebur128=peak=true', '-f', 'null', '-']);
  const sum = stderr.slice(stderr.lastIndexOf('Summary:'));
  const num = (re: RegExp) => { const m = re.exec(sum); return m && Number.isFinite(+m[1]) ? +m[1] : null; };
  const pr = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  const dur = Math.round(+pr.stdout.trim() * 1000) / 1000 || null;
  return { lufs: num(/I:\s*(-?[\d.]+) LUFS/), peak: num(/Peak:\s*(-?[\d.]+) dBFS/), dur };
}

/** the demuxer for a raw take, forced: ffmpeg must not probe the bytes into a playlist or any other format */
const DEMUX: Record<string, string> = { webm: 'matroska', ogg: 'ogg', wav: 'wav', m4a: 'mov' };

/** raw take -> the game's clip: mono, the key clicks cut, highpass, denoise, head/tail trim, fades at the cuts, gain
 *  to VOX.lufs with a soft clip on the peaks, the ceiling, 44.1 kHz Vorbis. Measured after the trim, after the clip
 *  and after the encode (one makeup pass if the limiter still took the take short) */
export async function processTake(raw: string, out: string) {
  const ext = path.extname(raw).slice(1), tmp = out.replace(/\.ogg$/, '.tmp.wav');
  const input = ['-hide_banner', '-protocol_whitelist', 'file', '-f', DEMUX[ext], '-i', raw, '-t', '120'];
  const clean = ['aformat=channel_layouts=mono', `atrim=start=${VOX.click.head}`, 'asetpts=PTS-STARTPTS', `highpass=f=${VOX.highpass}`, VOX.denoise];
  // pass 0: the room's noise floor under the denoise, for the trim gate
  const { stderr } = await run('ffmpeg', [...input, '-nostats', '-af', [...clean, 'astats=measure_overall=Noise_floor:measure_perchannel=0'].join(','), '-f', 'null', '-']);
  const floor = +(/Noise floor dB:\s*(-?[\d.]+)/.exec(stderr)?.[1] ?? NaN);
  const gate = Number.isFinite(floor) ? Math.round(Math.min(VOX.gate.max, Math.max(VOX.gate.min, floor + VOX.gate.over))) : VOX.gate.max;
  const trim = (s: number) => `silenceremove=start_periods=1:start_threshold=${gate}dB:start_silence=${s}:detection=peak`;
  const chain = [
    ...clean,
    trim(VOX.head), `afade=t=in:d=${VOX.fadeIn}`,
    'areverse', `atrim=start=${VOX.click.tail}`, 'asetpts=PTS-STARTPTS', trim(VOX.tail), `afade=t=in:d=${VOX.fadeOut}`, 'areverse',
  ].join(',');
  try {
    await run('ffmpeg', [...input, '-loglevel', 'error', '-y', '-af', chain, '-ar', '44100', '-ac', '1', tmp]);
    const pre = await measure(tmp);
    let g = gainTo(VOX.lufs, pre.lufs);
    if (g == null) throw new Error('the take is silent or too short to measure (did the mic pick anything up?)');
    const first = g;
    // pass 1, to float: the gain to the target, then a gentle voice compressor. Raw speech runs 15-18 LU
    // peak-to-loudness (syllable dynamics), the shipped clips ~11: under a -1.2 dBTP ceiling a limiter alone only
    // turns such a take down. The compressor evens the syllables out instead. (A tanh soft clip was tried: it
    // flat-topped the wave, cost ~6 dB and threw intersample overs to +2.8 dBTP after Vorbis; production/qa/evidence/ls2-booth.md)
    const sat = out.replace(/\.ogg$/, '.sat.wav');
    let m: Awaited<ReturnType<typeof measure>>;
    try {
      await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'wav', '-i', tmp, '-af', `volume=${g}dB,${VOX.comp}`, '-c:a', 'pcm_f32le', '-f', 'wav', sat]);
      const mid = await measure(sat);
      let g2 = gainTo(VOX.lufs, mid.lufs) ?? 0;
      // pass 2: the remaining gain under the ceiling, to Vorbis
      const enc = (gain: number) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'wav', '-i', sat,
        // the limiter runs 4x oversampled so it sees the peaks between samples (the encode would otherwise put them
        // back over the ceiling)
        '-af', `volume=${gain}dB,aresample=176400,alimiter=limit=${VOX.ceil}:level=false:attack=1:release=${VOX.release},aresample=44100`,
        '-ar', '44100', '-ac', '1', '-c:a', 'libvorbis', '-q:a', String(VOX.q), '-f', 'ogg', out]);
      await enc(g2);
      m = await measure(out);
      const short = m.lufs == null ? 0 : VOX.lufs - m.lufs;
      if (short > VOX.tol) {
        g2 += Math.min(short, VOX.makeup);
        await enc(g2);
        m = await measure(out);
      }
      g += g2;
    } finally {
      fs.rmSync(sat, { force: true });
    }
    const warn = first > VOX.quiet ? `quiet take (+${first} dB to reach ${VOX.lufs} LUFS): move closer or raise the input gain, or the room's hiss comes up with it` : undefined;
    return { gain: Math.round(g * 100) / 100, gate, ...m, warn };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/** a category folder that is a real directory inside its base (created if missing): never a symlink out of it */
function realDir(base: string, cat: string): string | null {
  if (!okCat(cat) || !slotOf(cat)) return null;
  const d = path.join(base, cat);
  if (path.dirname(d) !== base) return null; // belt and braces: okCat already forbids dots and slashes
  fs.mkdirSync(d, { recursive: true });
  if (!fs.lstatSync(d).isDirectory() || fs.lstatSync(base).isSymbolicLink()) return null;
  return fs.realpathSync(d).startsWith(fs.realpathSync(base) + path.sep) ? d : null;
}

/** the booth plugin: dev server only */
export function booth(): Plugin {
  let root = process.cwd();
  // keeps are numbered, written and processed one at a time, so two quick keeps can't pick the same take number.
  // Only that part is queued: the body is read first (readBody), so a client that goes away never holds the queue
  let queue: Promise<unknown> = Promise.resolve();
  // per dev-server process: the booth page carries it; a page on another local port, a tunnel peer or a script
  // without the page never sees it
  const token = randomBytes(16).toString('hex');
  return {
    name: 'grodius-voice-booth',
    apply: 'serve',
    configResolved(c) { root = c.root; },
    configureServer(server: ViteDevServer) {
      const sfx = path.join(root, 'src', 'sfx'), rawDir = path.join(root, 'assets-raw', 'voice');
      const PAGES: Record<string, string> = { '/booth.html': 'booth.html', '/tools/booth/text.html': 'text.html' };
      server.middlewares.use((req, res, next) => {
        const u = new URL(req.url ?? '/', 'http://x');
        const page = PAGES[u.pathname];
        if (!page && !u.pathname.startsWith('/__booth/')) return next();
        const bad = guard(req, page ? null : token);
        if (bad) return send(res, 403, { error: bad });
        // served as written, not through transformIndexHtml: no Vite client, so a keep (a new file the audio glob
        // sees) reloads the game tab but never the booth or its text frame. Framable only by the booth itself
        if (page) {
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.setHeader('cache-control', 'no-store');
          res.setHeader('x-frame-options', 'SAMEORIGIN');
          res.setHeader('content-security-policy', "frame-ancestors 'self'");
          return res.end(fs.readFileSync(path.join(root, 'tools', 'booth', page), 'utf8').replace('%BOOTH_TOKEN%', token));
        }
        const cat = u.searchParams.get('cat') ?? '';
        if (u.pathname === '/__booth/takes' && req.method === 'GET') {
          const out: Record<string, { name: string; raw: boolean }[]> = {};
          for (const s of SLOTS) {
            const raws = list(path.join(rawDir, s.cat));
            out[s.cat] = list(path.join(sfx, s.cat)).filter((f) => /\.(ogg|wav|mp3|m4a)$/.test(f)).sort()
              .map((name) => ({ name, raw: raws.some((r) => r.startsWith(name.replace(/\.ogg$/, '.'))) }));
          }
          return send(res, 200, out);
        }
        if (u.pathname !== '/__booth/take') return send(res, 404, { error: 'booth: no such endpoint' });
        if (!okCat(cat) || !slotOf(cat)) return send(res, 400, { error: `booth: ${JSON.stringify(cat)} is not a voice slot` });
        if (req.method === 'DELETE') {
          const name = u.searchParams.get('name') ?? '';
          if (!TAKE_RE.test(name)) return send(res, 400, { error: 'booth: not a take name' });
          const dir = realDir(sfx, cat);
          if (!dir) return send(res, 400, { error: 'booth: the slot folder is not a plain folder' });
          fs.rmSync(path.join(dir, name), { force: true });
          return send(res, 200, { deleted: name });
        }
        if (req.method !== 'POST') return send(res, 405, { error: 'booth: method' });
        const slug = slugify(u.searchParams.get('slug'));
        const ext = rawExt(req.headers['content-type']);
        if (!slug) return send(res, 400, { error: 'booth: empty slug' });
        if (!ext) return send(res, 415, { error: 'booth: body must be recorded audio' });
        const job = readBody(req).then((body) => {
          if (body.length < 256) throw new Error('booth: empty take');
          const step = queue.then(async () => {
            const dir = realDir(sfx, cat), rdir = realDir(rawDir, cat);
            if (!dir || !rdir) throw new Error('booth: the slot folder is not a plain folder');
            const n = nextTake([...list(dir), ...list(rdir)], slug);
            if (n > TAKE_MAX) throw new Error(`booth: ${TAKE_MAX} takes of one line; delete some first`);
            const name = takeName(slug, n), raw = path.join(rdir, name.replace(/\.ogg$/, '.' + ext));
            fs.writeFileSync(raw, body, { flag: 'wx' }); // never over an existing file
            // processed beside the raw and renamed in, so the audio glob never sees a half-written .ogg
            const part = path.join(rdir, name + '.part.ogg'), dest = path.join(dir, name);
            try {
              const r = await processTake(raw, part);
              if (fs.existsSync(dest)) throw new Error(`booth: ${name} appeared meanwhile; not overwritten`);
              fs.renameSync(part, dest);
              return { name, url: `/src/sfx/${cat}/${name}`, raw: path.relative(root, raw), ...r };
            } finally {
              fs.rmSync(part, { force: true });
            }
          });
          queue = step.catch(() => {});
          return step;
        });
        job.then((r) => send(res, 200, r), (e) => send(res, 500, { error: String(e?.message ?? e).replace(/^booth: /, '') }));
      });
    },
  };
}

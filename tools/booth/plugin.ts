// The voice booth's dev-server half (LS2-booth): serves /booth.html (and its text frame) and the /__booth/ endpoints
// that list, save and delete takes. `apply: 'serve'`, so `vite build` never loads it: the production bundle and the
// APK carry neither the pages nor the endpoints (the dist grep is in production/qa/evidence/ls2-booth.md).
//
// Endpoints (guard() below; every one needs the per-process token the booth page is served with):
//   GET    /__booth/takes                      -> { [cat]: ["<slug>-matty-<n>.ogg", ...] } for every slot
//   POST   /__booth/take?cat=<cat>&slug=<s>    body: the raw recording (audio/webm|ogg|wav|mp4, <= 25 MB)
//          saves the raw take to assets-raw/voice/<cat>/ (git-ignored), runs the ffmpeg chain below and writes
//          src/sfx/<cat>/<slug>-matty-<n>.ogg; -> { name, url, lufs, peak, dur, gain, warn? }
//          &squeeze=0 keeps the mid-take pauses as recorded (default: shortened, VOX.squeeze). A raw take that clipped
//          (VOX.clipAt) is saved but refused: 422 { error, clipped: true, rawPeak }
//   DELETE /__booth/take?cat=<cat>&name=<file> removes one processed take (a raw take stays in assets-raw/)
//   POST   /__booth/reprocess?cat=<cat>[&squeeze=0]  re-runs the current chain on that slot's kept raw takes and
//          rewrites the matching src/sfx takes (reprocess() below; the CLI is tools/booth/reprocess.mjs)
//   POST   /__booth/preview?cat=<cat>&fx=<json>[&squeeze=0][&name=<take>]  runs the chain plus the FX rack (fx.ts) on the
//          posted raw take, or on the kept raw take <name> of that slot, into a temp file and answers the .ogg itself
//          (x-booth-info: its numbers). Writes nothing in src/; a clipped take is previewed anyway, with a warning
//   GET    /__booth/quips                      -> { quips: [{ id, text, note? }], errors: [...] } (src/voice/quips.json)
//   POST   /__booth/quips  body JSON { op: 'add', text } | { op: 'edit', id, text } | { op: 'del', id, takes? }
//          edits SLAB's quip list (LS2-quips, editQuips() below): writes only src/voice/quips.json and, for a delete
//          with takes: true, the processed takes in src/sfx/quip-<id>/ (its raw takes stay in assets-raw/)
// Every path is built from slots.ts (the category must be a slot or a quip in the list) and names.ts (sanitised slug, numbered name),
// never from the request as written. Requires ffmpeg and ffprobe on PATH.
import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { lenWarn, quipSlot, SLOTS, voiceSlot } from './slots.ts';
import { newId, normText, parseQuips, QUIP_ID_MAX, QUIP_ID_RE, quipCat, quipLines, textError, type Quip } from '../../src/voice/quiplist.ts';
import { TAKE_MAX, gainTo, nextTake, okCat, rawExt, slugify, squeezeCuts, takeName, TAKE_RE } from './names.ts';
import { cleanFx, fxGraph, fxName, fxOn, type FxSet } from './fx.ts';

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
  /** the laptop's hiss fills the band above 14 kHz (audio-director, LS2-booth2 listen); the shipped reference rolls off
   *  near 17 kHz anyway, and nothing in a voice the game needs lives up there */
  lowpass: 14000,
  /** light FFT denoise for the laptop mic: 10 dB reduction against a tracked noise floor (it learns the room in the
   *  lead-in). Never above 12: consonants start to smear at 15-20 dB. A quiet take is a gain problem, see quiet */
  denoise: 'afftdn=nr=10:nf=-50:tn=1',
  /** the key click that starts and stops every take (the laptop mic sits over the keyboard): cut before the trim,
   *  or the trim stops at the click and keeps it. A reaction to Space is longer than the head cut */
  click: { head: 0.12, tail: 0.2 },
  /** the head/tail trim's silence gate (peak detection), set per take from the room: the quietest 50 ms of the
   *  cleaned-up take (astats noise floor: a windowed peak minimum, not an RMS) plus `over`, clamped to [min, max].
   *  A fixed -45 cut soft onsets (the S of SEVERED) on a quiet take; a fixed -55 kept a noisy room's tail. Measured
   *  after the denoise, before the expander (which then turns the gaps down under it) and the gain */
  gate: { over: 14, min: -60, max: -40 },
  /** the downward expander between the phrases (LS2-booth2, audio-director): right after the denoise, before the trim
   *  and long before the gain and compressor, which otherwise lift the room in every gap to -19..-25 dBFS (the
   *  reference's gaps sit at -32..-39). Threshold = the room's RMS (astats RMS trough: the quietest 50 ms window,
   *  clamped to [min, max]) + `over` dB, RMS detection; ratio 3, at most `range` (0.1 = -20 dB) of reduction, a 5 ms
   *  attack so a word's onset opens it, a 150 ms release so a word's tail decays rather than chops (200 left ~150 ms
   *  of room at -21 dBFS after each phrase; the audio-director's check: word dips within 1.5 dB of the chain without
   *  the expander). The trough's clamp tops out at -45, so the threshold never passes -30 dBFS RMS, 8 dB under a
   *  phrase: a noisy room gets less expansion, never chewed words.
   *  Not the trim gate's floor: astats' "noise floor" is a windowed *peak* minimum, ~8 dB over the room's RMS, so
   *  floor + 12 sat on the voice. Before the trim, so the trim gate and the squeeze see the gaps already turned down
   *  (a -40 dBFS RMS room peaks over the -40 trim gate; untouched, it kept its lead-in room and every pause).
   *  Measured: production/qa/evidence/ls2-booth2.md */
  expand: { over: 15, ratio: 3, range: 0.1, attack: 5, release: 150, knee: 4, min: -80, max: -45 },
  /** a pause inside the take longer than `over` s is cut down to `keep` s, `after` of it kept after the last word
   *  (its tail and the expander's release) and the rest before the next: a breath between two phrases is what puts a
   *  hype line past its target. Found with silencedetect at the trim gate, cut with atrim and joined with an `xfade` s
   *  crossfade (names.ts squeezeCuts);
   *  silenceremove can't do it, since the pause it keeps is tied to the length that triggers it. Per take, default
   *  on (the booth's checkbox, ?squeeze=0) */
  squeeze: { over: 0.4, keep: 0.25, after: 0.15, xfade: 0.005 },
  /** a raw take whose sample peak (the key clicks cut) reaches this, dBFS, clipped at the input: no processing can
   *  undo it (Matt's first three takes peaked at +4.8 to +5.9), so the keep is refused and the raw is kept */
  clipAt: -0.5,
  /** a raw peak past this, dBFS, is kept with a warning: the booth's meter target is the loudest syllable at -10 to -6
   *  and never past -3 (audio-director) */
  hotAt: -3,
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

/** what a raw take's peak (dBFS) says about the input: 'clip' at or above VOX.clipAt (refused), 'hot' past VOX.hotAt
 *  (kept, with a warning), else null. The page's meter lights CLIP and HOT on the same rule (booth.ts) */
export function rawVerdict(peak: number | null): 'clip' | 'hot' | null {
  if (peak == null || !Number.isFinite(peak)) return null;
  return peak >= VOX.clipAt ? 'clip' : peak > VOX.hotAt ? 'hot' : null;
}

/** a raw take that clipped at the input: refused, with its peak */
export class Clipped extends Error {
  readonly rawPeak: number;
  // a plain field, not a parameter property: the CLI (reprocess.mjs) runs this file under Node's type stripping
  constructor(rawPeak: number) {
    super(`input clipped (raw peak ${rawPeak > 0 ? '+' : ''}${rawPeak.toFixed(1)} dBFS): lower the mic level and record it again`);
    this.rawPeak = rawPeak;
  }
}

/** the raw take's sample peak, dBFS, over what the chain keeps (the key clicks at both ends cut: a hard Space must not
 *  fail a good take); null if ffmpeg reports none */
async function peakOf(input: string[]): Promise<number | null> {
  // float: left to negotiate, astats takes s16 and an Opus overshoot past full scale reads as 0.0. No mono downmix:
  // Chrome's MediaRecorder writes two identical channels even for a mono track, and the downmix (0.707 L + 0.707 R)
  // reads them 3 dB hot, which refused a -1.9 dBFS take as +1.1 (LS2-booth2 e2e). The peak over the channels is
  // the input's own
  const af = ['aformat=sample_fmts=flt', `atrim=start=${VOX.click.head}`, 'areverse', `atrim=start=${VOX.click.tail}`, 'areverse',
    'astats=measure_overall=Peak_level:measure_perchannel=0'].join(',');
  const { stderr } = await run('ffmpeg', [...input, '-nostats', '-af', af, '-f', 'null', '-']);
  const m = /Peak level dB:\s*(-?[\d.]+|-?inf)/.exec(stderr);
  return m && Number.isFinite(+m[1]) ? Math.round(+m[1] * 10) / 10 : null;
}

const clampTo = (v: number, lo: number, hi: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : hi);
/** the per-take levels, dBFS, from the room after the denoise: the trim gate from astats' noise floor (a windowed
 *  peak minimum; the gate uses peak detection), clamped to VOX.gate, and the expander threshold from the RMS trough
 *  (RMS detection), clamped to VOX.expand. Either unmeasurable takes its clamp's top */
export function levels(floor: number, trough: number): { gate: number; expand: number } {
  const G = VOX.gate, E = VOX.expand;
  return { gate: Math.round(clampTo(floor + G.over, G.min, G.max)), expand: Math.round(clampTo(trough, E.min, E.max) + E.over) };
}

/** raw take -> the game's clip: the clip guard, mono, the key clicks cut, highpass, lowpass, denoise, the expander
 *  between phrases, head/tail trim, fades at the cuts, the long pauses shortened (unless o.squeeze is false), gain
 *  to VOX.lufs into a gentle voice compressor, the gain again, a 4x-oversampled limiter at the ceiling, 44.1 kHz
 *  Vorbis. Measured after the trim, after the compressor and after the encode (one makeup pass if the limiter still
 *  took the take short) */
export async function processTake(raw: string, out: string, o: { squeeze?: boolean; fx?: FxSet | null; allowClip?: boolean } = {}) {
  const ext = path.extname(raw).slice(1), tmp = out.replace(/\.ogg$/, '.tmp.wav');
  const input = ['-hide_banner', '-protocol_whitelist', 'file', '-f', DEMUX[ext], '-i', raw, '-t', '120'];
  // the clip guard first: a take that clipped at the input is refused before any work (the raw stays in assets-raw/)
  const rawPeak = await peakOf(input);
  // (a preview runs a clipped take anyway, to audition the FX, and says so)
  if (rawVerdict(rawPeak) === 'clip' && !o.allowClip) throw new Clipped(rawPeak!);
  const clean = ['aformat=channel_layouts=mono', `atrim=start=${VOX.click.head}`, 'asetpts=PTS-STARTPTS', `highpass=f=${VOX.highpass}`, `lowpass=f=${VOX.lowpass}`, VOX.denoise];
  // pass 0: the room under the denoise: its noise floor for the trim gate, its RMS trough for the expander (the whole
  // overall set: astats only reports the trough with it; ffmpeg spells it "RMS through")
  const { stderr } = await run('ffmpeg', [...input, '-nostats', '-af', [...clean, 'astats=measure_perchannel=0'].join(','), '-f', 'null', '-']);
  const num = (re: RegExp) => +(re.exec(stderr)?.[1] ?? NaN);
  const { gate, expand } = levels(num(/Noise floor dB:\s*(-?[\d.]+)/), num(/RMS th?rough dB:\s*(-?[\d.]+)/));
  const trim = (s: number) => `silenceremove=start_periods=1:start_threshold=${gate}dB:start_silence=${s}:detection=peak`;
  const E = VOX.expand, Q = VOX.squeeze;
  const chain = [
    ...clean,
    `agate=threshold=${(10 ** (expand / 20)).toFixed(6)}:ratio=${E.ratio}:range=${E.range}:attack=${E.attack}:release=${E.release}:knee=${E.knee}:detection=rms`,
    trim(VOX.head), `afade=t=in:d=${VOX.fadeIn}`,
    'areverse', `atrim=start=${VOX.click.tail}`, 'asetpts=PTS-STARTPTS', trim(VOX.tail), `afade=t=in:d=${VOX.fadeOut}`, 'areverse',
  ].join(',');
  try {
    await run('ffmpeg', [...input, '-loglevel', 'error', '-y', '-af', chain, '-ar', '44100', '-ac', '1', tmp]);
    let squeezed = 0;
    const sq = out.replace(/\.ogg$/, '.sq.wav');
    if (o.squeeze !== false) try {
      // the long pauses: silencedetect at the trim gate (sample peaks, like the trim), then one aselect over the cuts
      const sd = await run('ffmpeg', ['-hide_banner', '-nostats', '-f', 'wav', '-i', tmp, '-af', `silencedetect=n=${gate}dB:d=${Q.over}`, '-f', 'null', '-']);
      const at = (k: string) => [...sd.stderr.matchAll(new RegExp(`silence_${k}: (-?[\\d.]+)`, 'g'))].map((m) => +m[1]);
      const len = (await measure(tmp)).dur ?? Infinity;
      const cuts = squeezeCuts(at('start'), at('end'), Q, len);
      if (cuts.length) {
        // cut at the sample (atrim; aselect drops whole 4096-sample frames, up to 93 ms off) and join the kept
        // stretches with a short crossfade (the audio-director: no hard splice in the room)
        const segs: [number, number | null][] = cuts.map(([a], i) => [i ? cuts[i - 1][1] : 0, a]);
        segs.push([cuts[cuts.length - 1][1], null]);
        const g = segs.map(([a, b], i) => `[0:a]atrim=start=${a.toFixed(5)}${b == null ? '' : `:end=${b.toFixed(5)}`},asetpts=PTS-STARTPTS[s${i}]`);
        let last = 's0';
        for (let i = 1; i < segs.length; i++) { g.push(`[${last}][s${i}]acrossfade=d=${Q.xfade}:c1=tri:c2=tri[x${i}]`); last = `x${i}`; }
        await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'wav', '-i', tmp, '-filter_complex', g.join(';'), '-map', `[${last}]`, '-c:a', 'pcm_f32le', '-f', 'wav', sq]);
        fs.renameSync(sq, tmp);
        squeezed = Math.round(cuts.reduce((n, [a, b]) => n + b - a, 0) * 100) / 100;
      }
    } finally {
      fs.rmSync(sq, { force: true });
    }
    // the FX rack (fx.ts): on the cleaned-up, trimmed, squeezed take, before the gain to the target, so a take with
    // FX still lands at VOX.lufs under the same compressor and limiter
    const graph = fxGraph(o.fx);
    // the take's own level before the rack: the quiet-take warning is about the mic, not about an effect (robot,
    // whisper, a radio band) that thins the take and so needs more gain to reach the target
    const dry = graph ? gainTo(VOX.lufs, (await measure(tmp)).lufs) : null;
    if (graph) {
      const fxw = out.replace(/\.ogg$/, '.fx.wav');
      try {
        await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'wav', '-i', tmp, '-filter_complex', graph, '-map', '[fx]', '-c:a', 'pcm_f32le', '-f', 'wav', fxw]);
        fs.renameSync(fxw, tmp);
      } finally {
        fs.rmSync(fxw, { force: true });
      }
    }
    const pre = await measure(tmp);
    let g = gainTo(VOX.lufs, pre.lufs);
    if (g == null) throw new Error('the take is silent or too short to measure (did the mic pick anything up?)');
    const first = dry ?? g;
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
    const warn = [
      first > VOX.quiet ? `quiet take (+${first} dB to reach ${VOX.lufs} LUFS): move closer or raise the input gain, or the room's hiss comes up with it` : '',
      rawVerdict(rawPeak) === 'clip' ? `clipped input (raw peak ${rawPeak} dBFS): a preview only, the booth refuses to keep it` : '',
      rawVerdict(rawPeak) === 'hot' ? `hot take (raw peak ${rawPeak} dBFS, past ${VOX.hotAt}): back off the mic a little` : '',
    ].filter(Boolean).join('; ') || undefined;
    return { gain: Math.round(g * 100) / 100, gate, expand, rawPeak, squeeze: o.squeeze !== false, squeezed, fx: fxName(o.fx), ...m, warn };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/** a category folder that is a real directory inside its base (created if missing): never a symlink out of it. The
 *  category must be a fixed slot or a quip in `quips` */
function realDir(base: string, cat: string, quips: readonly Quip[] = []): string | null {
  if (!okCat(cat) || !voiceSlot(cat, quips)) return null;
  const d = path.join(base, cat);
  if (path.dirname(d) !== base) return null; // belt and braces: okCat already forbids dots and slashes
  fs.mkdirSync(d, { recursive: true });
  if (!fs.lstatSync(d).isDirectory() || fs.lstatSync(base).isSymbolicLink()) return null;
  return fs.realpathSync(d).startsWith(fs.realpathSync(base) + path.sep) ? d : null;
}

/** a raw take's file name: <slug>-matty-<n>.<ext>, for an extension the chain can demux */
export const RAW_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*-matty-[1-9]\d{0,3})\.(webm|ogg|wav|m4a)$/;

/** why reprocess left a take as it was, from the error processTake threw */
export const skipWhy = (e: unknown) => (e instanceof Clipped ? e.message.replace(/: lower.*/, ': kept as it was') : String((e as Error)?.message ?? e));

/** the per-take record kept beside a raw take (<take>.json in assets-raw/voice/<cat>/): the choices a reprocess must
 *  repeat (the pause squeeze), and the words the take was recorded to (LS2-quips: a quip whose text changed since
 *  shows its older takes as stale) */
export type TakeOpts = { squeeze: boolean; text?: string; fx?: FxSet };
const optsFile = (rdir: string, name: string) => path.join(rdir, name.replace(/\.ogg$/, '.json'));
/** a take's saved choices, or null for a take kept before LS2-booth2 (or an unreadable record) */
export function readOpts(rdir: string, name: string): TakeOpts | null {
  try {
    const j = JSON.parse(fs.readFileSync(optsFile(rdir, name), 'utf8'));
    if (typeof j?.squeeze !== 'boolean') return null;
    const o: TakeOpts = { squeeze: j.squeeze };
    if (typeof j.text === 'string') o.text = j.text;
    // the FX rack the take was kept with (none: a take from before the rack, or kept clean)
    if (fxOn(cleanFx(j.fx))) o.fx = cleanFx(j.fx);
    return o;
  } catch { return null; }
}

export type Redone = { cat: string; name: string; done: boolean; why?: string; lufs?: number | null; dur?: number | null; long?: string; warn?: string };
/** re-runs the current chain on every kept raw take of these slots (assets-raw/voice/<cat>/) and rewrites the matching
 *  src/sfx/<cat>/ take in place, with the pause squeeze the take was kept with (its .json record; o.squeeze for an
 *  older take), so takes recorded under an older chain are redone without re-recording. Skips a raw
 *  take with no processed take (deleted on purpose: never brought back), and one whose raw clipped (the old take
 *  stays as it is). One take at a time; each is processed beside its raw and renamed in. The booth's reprocess
 *  endpoint and tools/booth/reprocess.mjs both call it */
export async function reprocess(root: string, cats: string[], o: { squeeze?: boolean; fx?: FxSet; log?: (r: Redone) => void; process?: typeof processTake } = {}): Promise<Redone[]> {
  const proc = o.process ?? processTake; // a test stands in for ffmpeg here (tests/integration/booth-reprocess.test.ts)
  const out: Redone[] = [];
  const sfx = path.join(root, 'src', 'sfx'), rawBase = path.join(root, 'assets-raw', 'voice'), quips = readQuips(root).quips;
  // every name checked before any take is touched: a typo must not leave the run half done
  for (const cat of cats) if (!okCat(cat) || !voiceSlot(cat, quips)) throw new Error(`booth: ${JSON.stringify(cat)} is not a voice slot`);
  for (const cat of [...new Set(cats)]) {
    const slot = voiceSlot(cat, quips)!;
    if (!fs.existsSync(path.join(rawBase, cat))) continue;
    const dir = realDir(sfx, cat, quips), rdir = realDir(rawBase, cat, quips);
    if (!dir || !rdir) throw new Error(`booth: the ${cat} folder is not a plain folder`);
    for (const f of list(rdir).sort()) {
      const m = RAW_RE.exec(f);
      if (!m) continue;
      const name = m[1] + '.ogg', dest = path.join(dir, name), part = path.join(rdir, name + '.part.ogg');
      let r: Redone;
      if (!fs.existsSync(dest)) r = { cat, name, done: false, why: 'no processed take in src/sfx (deleted, or refused when kept): left alone' };
      else {
        try {
          // the take's own choice when it has one; o.squeeze only for a take kept before the record existed
          // the FX: o.fx replaces the take's own rack (the booth's "apply the current FX"), else the one it was kept with
          const had = readOpts(rdir, name), fx = o.fx ?? had?.fx;
          const p = await proc(path.join(rdir, f), part, { squeeze: had?.squeeze ?? o.squeeze, ...(fx ? { fx } : {}) });
          fs.renameSync(part, dest);
          if (o.fx) fs.writeFileSync(optsFile(rdir, name), JSON.stringify({ ...(had ?? { squeeze: o.squeeze !== false }), fx: o.fx } satisfies TakeOpts));
          r = { cat, name, done: true, lufs: p.lufs, dur: p.dur, long: lenWarn(slot, p.dur), warn: p.warn };
        } catch (e) {
          r = { cat, name, done: false, why: skipWhy(e) };
        } finally {
          fs.rmSync(part, { force: true });
        }
      }
      o.log?.(r);
      out.push(r);
    }
  }
  return out;
}

// ---------------- SLAB's quips (LS2-quips) ----------------
/** where the quip list lives, relative to the repo */
export const QUIP_FILE = path.join('src', 'voice', 'quips.json');
/** the quip list on disk, parsed (src/voice/quiplist.ts parseQuips): a missing or broken file is no quips, with why */
export function readQuips(root: string): { quips: Quip[]; errors: string[] } {
  let raw: unknown;
  try { raw = JSON.parse(fs.readFileSync(path.join(root, QUIP_FILE), 'utf8')); } catch (e) {
    return { quips: [], errors: [`${QUIP_FILE}: ${String((e as Error)?.message ?? e)}`] };
  }
  return parseQuips(raw);
}
/** the list as written: one quip a line, so a hand edit and a diff stay readable */
export const quipJson = (quips: readonly Quip[]) =>
  '[\n' + quips.map((q) => '  { ' + (['id', 'text', 'note'] as const).filter((k) => q[k] != null).map((k) => `${JSON.stringify(k)}: ${JSON.stringify(q[k])}`).join(', ') + ' }').join(',\n') + '\n]\n';

/** a quip edit refused for the client's reason (4xx), not a server fault */
export class QuipRefused extends Error {
  readonly code: number;
  // a plain field, not a parameter property: the CLI runs this file under Node's type stripping
  constructor(msg: string, code = 400) { super(msg); this.code = code; }
}
/** the audio files in a quip's src/sfx folder (none when it has no folder) */
const quipTakes = (sfx: string, id: string) => list(path.join(sfx, quipCat(id))).filter((f) => /\.(ogg|wav|mp3|m4a)$/.test(f));

/** apply one edit ({ op: 'add', text } | { op: 'edit', id, text } | { op: 'del', id, takes? }) to the quip list in
 *  `root` and write it back; -> the new list and, for an add, the new quip.
 *  Refuses (QuipRefused) a malformed request, words textError() turns down, an unknown id, a delete of a quip with
 *  takes unless `takes: true` (then only its processed takes, all named <slug>-matty-<n>.ogg, are removed with it;
 *  its raw takes stay in assets-raw/, and the id is never handed out again while they do), and any write while
 *  quips.json has rows it cannot read (a write would drop them: fix the file by hand first). The list is written
 *  through a temp file in assets-raw/ and renamed in, so the game's import never reads half a file */
export function editQuips(root: string, op: unknown): { quips: Quip[]; quip?: Quip } {
  const sfx = path.join(root, 'src', 'sfx'), rawBase = path.join(root, 'assets-raw', 'voice');
  const o = (op ?? {}) as Record<string, unknown>;
  const { quips, errors } = readQuips(root);
  if (errors.length) throw new QuipRefused(`${QUIP_FILE} has rows the booth cannot read (${errors.join('; ')}): fix it by hand first`, 409);
  const find = () => {
    const id = o.id;
    if (typeof id !== 'string' || !QUIP_ID_RE.test(id)) throw new QuipRefused('booth: not a quip id');
    const i = quips.findIndex((q) => q.id === id);
    if (i < 0) throw new QuipRefused(`booth: no quip ${JSON.stringify(id)}`, 404);
    return i;
  };
  const words = () => {
    const text = normText(o.text), bad = textError(text);
    if (bad) throw new QuipRefused(`booth: ${bad}`);
    return text;
  };
  let next: Quip[], made: Quip | undefined;
  if (o.op === 'add') {
    const text = words();
    if (quips.some((q) => q.text === text)) throw new QuipRefused('booth: that quip is already in the list', 409);
    // the id is new against the list and every folder left on disk (a deleted quip's raw takes)
    const left = [...list(sfx), ...list(rawBase)].filter((f) => f.startsWith('quip-')).map((f) => f.slice(5));
    made = { id: newId(text, [...quips.map((q) => q.id), ...left]), text };
    next = [...quips, made];
  } else if (o.op === 'edit') {
    const i = find(), text = words();
    if (quips.some((q, k) => k !== i && q.text === text)) throw new QuipRefused('booth: another quip already says that', 409);
    // the id stays: its takes keep their names, and the booth flags the ones recorded to the old words
    next = quips.map((q, k) => (k === i ? { ...q, text } : q));
  } else if (o.op === 'del') {
    const i = find(), id = quips[i].id, takes = quipTakes(sfx, id);
    if (takes.length) {
      if (o.takes !== true) throw new QuipRefused(`booth: ${id} has ${takes.length} take${takes.length === 1 ? '' : 's'}: confirm to delete them too`, 409);
      if (takes.some((f) => !TAKE_RE.test(f))) throw new QuipRefused(`booth: src/sfx/${quipCat(id)}/ holds files the booth did not make: delete it by hand`, 409);
      const dir = realDir(sfx, quipCat(id), quips);
      if (!dir) throw new Error('booth: the quip folder is not a plain folder');
      // the list is written first (security review SEC-001): a failed write leaves the quip and its takes as they were.
      // A take left behind by a failed delete is harmless: the game plays only the quips in the list
      next = quips.filter((_, k) => k !== i);
      writeQuips(root, next);
      for (const f of takes) fs.rmSync(path.join(dir, f), { force: true });
      if (!list(dir).length) fs.rmdirSync(dir);
      return { quips: next };
    }
    next = quips.filter((_, k) => k !== i);
  } else throw new QuipRefused('booth: op must be add, edit or del');
  if (made && (made.id.length > QUIP_ID_MAX || !QUIP_ID_RE.test(made.id))) throw new Error(`booth: made a bad quip id ${made.id}`);
  writeQuips(root, next);
  return { quips: next, ...(made ? { quip: made } : {}) };
}

/** the list to src/voice/quips.json: through a temp file in assets-raw/voice/ (git-ignored, unwatched: Vite never sees
 *  it) renamed in, so the game's import never reads half a file. Refuses a symlinked src/voice or quips.json, and an
 *  assets-raw/ on another disk, where the rename cannot be atomic (security review SEC-002) */
function writeQuips(root: string, quips: readonly Quip[]) {
  const vdir = path.join(root, 'src', 'voice'), file = path.join(root, QUIP_FILE), rawBase = path.join(root, 'assets-raw', 'voice');
  if (fs.lstatSync(vdir).isSymbolicLink() || fs.lstatSync(file).isSymbolicLink()) throw new Error('booth: src/voice is not a plain folder');
  fs.mkdirSync(rawBase, { recursive: true });
  if (fs.statSync(rawBase).dev !== fs.statSync(vdir).dev) throw new Error('booth: assets-raw/voice is on another disk than src/voice: the quip list cannot be written safely');
  const tmp = path.join(rawBase, '.quips.json.tmp');
  fs.rmSync(tmp, { force: true });
  fs.writeFileSync(tmp, quipJson(quips), { flag: 'wx' }); // never through a planted link
  fs.renameSync(tmp, file);
}

/** a quip edit's body is a few hundred bytes */
const QUIP_BODY = 4096;
/** the whole JSON body of a quip edit, or a rejection */
function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((ok, no) => {
    if (!/^application\/json\b/.test(String(req.headers['content-type'] ?? ''))) return no(new QuipRefused('booth: body must be JSON', 415));
    if (+(req.headers['content-length'] ?? 0) > QUIP_BODY) return no(new QuipRefused('booth: body too large', 413));
    const parts: Buffer[] = [];
    let n = 0;
    req.setTimeout(10_000, () => { no(new Error('booth: upload stalled')); req.destroy(); });
    req.on('data', (c: Buffer) => {
      n += c.length;
      if (n > QUIP_BODY) { no(new QuipRefused('booth: body too large', 413)); req.destroy(); return; }
      parts.push(c);
    });
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(parts).toString('utf8'))); } catch { no(new QuipRefused('booth: body is not JSON')); } });
    req.on('error', no);
    req.on('close', () => { if (!req.complete) no(new QuipRefused('booth: body aborted')); });
  });
}

/** the per-take pause squeeze from a request: on unless squeeze=0 (the booth's checkbox, default on) */
export const squeezeParam = (q: URLSearchParams) => q.get('squeeze') !== '0';
/** the FX rack from a request (?fx=<json>, cleanFx'd), or undefined when there is none */
export function fxParam(q: URLSearchParams): FxSet | undefined {
  const s = q.get('fx');
  if (s == null || s.length > 4000) return undefined;
  try { return cleanFx(JSON.parse(s)); } catch { return undefined; }
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
  /** an FX preview (POST /__booth/preview): the posted raw take, or the slot's kept raw take `name`, through the chain
   *  and the rack into assets-raw/voice/.preview/ (git-ignored, never served), read back and deleted. Outside the keep
   *  queue: it writes nothing a keep or a reprocess reads */
  async function preview(req: IncomingMessage, cat: string, quips: readonly Quip[], name: string | null, squeeze: boolean, fx: FxSet | undefined) {
    const rawBase = path.join(root, 'assets-raw', 'voice'), pdir = path.join(rawBase, '.preview');
    fs.mkdirSync(pdir, { recursive: true });
    if (fs.lstatSync(pdir).isSymbolicLink()) throw new Error('booth: the preview folder is not a plain folder');
    const id = randomBytes(6).toString('hex');
    let raw: string, made = false;
    if (name) {
      if (!TAKE_RE.test(name)) throw new Error('booth: not a take name');
      const rdir = realDir(rawBase, cat, quips);
      const f = rdir && list(rdir).find((x) => RAW_RE.exec(x)?.[1] + '.ogg' === name);
      if (!rdir || !f) throw new Error(`booth: no raw take for ${name}`);
      raw = path.join(rdir, f);
      req.resume();
    } else {
      const ext = rawExt(req.headers['content-type']);
      if (!ext) throw new Error('booth: body must be recorded audio');
      const body = await readBody(req);
      if (body.length < 256) throw new Error('booth: empty take');
      raw = path.join(pdir, `${id}.${ext}`);
      fs.writeFileSync(raw, body, { flag: 'wx' });
      made = true;
    }
    const out = path.join(pdir, `${id}.ogg`);
    try {
      const r = await processTake(raw, out, { squeeze, allowClip: true, ...(fxOn(fx) ? { fx } : {}) });
      return { file: fs.readFileSync(out), info: { lufs: r.lufs, peak: r.peak, dur: r.dur, fx: r.fx, warn: r.warn } };
    } finally {
      fs.rmSync(out, { force: true });
      if (made) fs.rmSync(raw, { force: true });
    }
  }
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
          const out: Record<string, { name: string; raw: boolean; was?: string; fx?: string }[]> = {};
          for (const s of [...SLOTS, ...readQuips(root).quips.map(quipSlot)]) {
            const rd = path.join(rawDir, s.cat), raws = list(rd), now = s.quip ? quipLines(s.quip.text).join(' ') : '';
            out[s.cat] = list(path.join(sfx, s.cat)).filter((f) => /\.(ogg|wav|mp3|m4a)$/.test(f)).sort()
              .map((name) => {
                // a quip's take recorded to words it no longer has: `was` is what it says (the booth marks it stale)
                const o = readOpts(rd, name), said = s.quip ? o?.text : undefined, fx = fxName(o?.fx);
                return { name, raw: raws.some((r) => r.startsWith(name.replace(/\.ogg$/, '.'))), ...(fx ? { fx } : {}), ...(said != null && said !== now ? { was: said } : {}) };
              });
          }
          return send(res, 200, out);
        }
        if (u.pathname === '/__booth/quips') {
          if (req.method === 'GET') return send(res, 200, readQuips(root));
          if (req.method !== 'POST') return send(res, 405, { error: 'booth: method' });
          // in the keep queue: an edit never lands while a keep is filing a take under the list it read
          const job = readJson(req).then((body) => {
            const step = queue.then(() => editQuips(root, body));
            queue = step.catch(() => {});
            return step;
          });
          return void job.then((r) => send(res, 200, r), (e) => send(res, e instanceof QuipRefused ? e.code : 500,
            { error: String(e?.message ?? e).replace(/^booth: /, '') }));
        }
        if (u.pathname !== '/__booth/take' && u.pathname !== '/__booth/reprocess' && u.pathname !== '/__booth/preview') return send(res, 404, { error: 'booth: no such endpoint' });
        // the quip list read fresh for every request: the booth may have just added or deleted one
        const quips = readQuips(root).quips;
        if (!okCat(cat) || !voiceSlot(cat, quips)) return send(res, 400, { error: `booth: ${JSON.stringify(cat)} is not a voice slot` });
        const squeeze = squeezeParam(u.searchParams), fx = fxParam(u.searchParams);
        if (u.pathname === '/__booth/preview') {
          if (req.method !== 'POST') return send(res, 405, { error: 'booth: method' });
          return void preview(req, cat, quips, u.searchParams.get('name'), squeeze, fx).then(({ file, info }) => {
            res.statusCode = 200;
            res.setHeader('content-type', 'audio/ogg');
            res.setHeader('cache-control', 'no-store');
            res.setHeader('x-booth-info', encodeURIComponent(JSON.stringify(info)));
            res.end(file);
          }, (e) => send(res, 500, { error: String(e?.message ?? e).replace(/^booth: /, '') }));
        }
        if (u.pathname === '/__booth/reprocess') {
          if (req.method !== 'POST') return send(res, 405, { error: 'booth: method' });
          // in the keep queue: a reprocess and a keep never write the same folder at once. ?fx= applies that rack to
          // every take of the line (and records it with each); without it, each take keeps its own
          const step = queue.then(() => reprocess(root, [cat], { squeeze, ...(fx ? { fx } : {}) }));
          queue = step.catch(() => {});
          return void step.then((r) => send(res, 200, { takes: r }), (e) => send(res, 500, { error: String(e?.message ?? e).replace(/^booth: /, '') }));
        }
        if (req.method === 'DELETE') {
          const name = u.searchParams.get('name') ?? '';
          if (!TAKE_RE.test(name)) return send(res, 400, { error: 'booth: not a take name' });
          const dir = realDir(sfx, cat, quips);
          if (!dir) return send(res, 400, { error: 'booth: the slot folder is not a plain folder' });
          // in the keep queue (security review): a reprocess renaming this take back in can't undo the delete
          const step = queue.then(() => fs.rmSync(path.join(dir, name), { force: true }));
          queue = step.catch(() => {});
          return void step.then(() => send(res, 200, { deleted: name }), (e) => send(res, 500, { error: String(e?.message ?? e) }));
        }
        if (req.method !== 'POST') return send(res, 405, { error: 'booth: method' });
        const slug = slugify(u.searchParams.get('slug'));
        const ext = rawExt(req.headers['content-type']);
        if (!slug) return send(res, 400, { error: 'booth: empty slug' });
        if (!ext) return send(res, 415, { error: 'booth: body must be recorded audio' });
        const job = readBody(req).then((body) => {
          if (body.length < 256) throw new Error('booth: empty take');
          const step = queue.then(async () => {
            // the list again, inside the queue: a quip deleted while this take uploaded is not filed
            const now = readQuips(root).quips, s = voiceSlot(cat, now);
            if (!s) throw new Error(`booth: ${cat} is no longer a voice slot`);
            const dir = realDir(sfx, cat, now), rdir = realDir(rawDir, cat, now);
            if (!dir || !rdir) throw new Error('booth: the slot folder is not a plain folder');
            const n = nextTake([...list(dir), ...list(rdir)], slug);
            if (n > TAKE_MAX) throw new Error(`booth: ${TAKE_MAX} takes of one line; delete some first`);
            const name = takeName(slug, n), raw = path.join(rdir, name.replace(/\.ogg$/, '.' + ext));
            fs.writeFileSync(raw, body, { flag: 'wx' }); // never over an existing file
            const rack = fxOn(fx) ? { fx } : {};
            fs.writeFileSync(optsFile(rdir, name), JSON.stringify((s.quip ? { squeeze, text: quipLines(s.quip.text).join(' '), ...rack } : { squeeze, ...rack }) satisfies TakeOpts));
            // processed beside the raw and renamed in, so the audio glob never sees a half-written .ogg
            const part = path.join(rdir, name + '.part.ogg'), dest = path.join(dir, name);
            try {
              const r = await processTake(raw, part, { squeeze, ...(fxOn(fx) ? { fx } : {}) });
              if (fs.existsSync(dest)) throw new Error(`booth: ${name} appeared meanwhile; not overwritten`);
              fs.renameSync(part, dest);
              return { name, url: `/src/sfx/${cat}/${name}`, raw: path.relative(root, raw), ...r, long: lenWarn(s, r.dur) };
            } finally {
              fs.rmSync(part, { force: true });
            }
          });
          queue = step.catch(() => {});
          return step;
        });
        // a clipped take is the singer's to fix, not a server fault: 422, with the peak, and the raw kept
        job.then((r) => send(res, 200, r), (e) => e instanceof Clipped
          ? send(res, 422, { error: e.message, clipped: true, rawPeak: e.rawPeak })
          : send(res, 500, { error: String(e?.message ?? e).replace(/^booth: /, '') }));
      });
    },
  };
}

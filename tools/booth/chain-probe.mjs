// The voice booth's chain probe (LS2-booth2): synthesises booth takes, runs them through the real chain
// (tools/booth/plugin.ts processTake) and measures what the expander, the pause squeeze, the clip guard and the
// long-take warning do. It records nothing and never touches src/sfx/ or assets-raw/.
//
// The takes: additive harmonics shaped by moving formants, syllable envelopes and a fricative at each onset (voice-like,
// not a voice), over pink-ish room noise at -40 dBFS RMS, key clicks at both ends, encoded to WebM/Opus 256k like the
// booth's MediaRecorder:
//   clean    two phrases (peaks -8 dBFS) with a 0.6 s breath between: kept; gaps must land -35..-40 dBFS
//   hot      the same at peaks -2 dBFS: kept with the hot-take warning
//   clipped  the same ~16 dB too hot, hard-clipped: refused
//   long     one 4 s read: kept with the long-take warning (hype10's 2.5 s limit)
// Gaps: 50 ms RMS windows of the processed take; the gap is the median of the longest run 20 dB under the loudest.
// Dips: the mean 50 ms dip between syllables (word tails), compared with the chain run with no expander.
//
// Usage: node tools/booth/chain-probe.mjs [outdir] [--fx] [--real <raw take>...]
//   outdir   where the takes and processed files go (default: <os tmpdir>/booth-chain-probe)
//   --fx     also run the clean take through every FX preset (fx.ts PRESETS: LUFS, length, verdict), and every effect
//            alone at its knobs' minimums and maximums (only a failure is printed)
//   --real   also run these raw takes (e.g. copies of assets-raw/voice/*/*.webm) through the clip guard and chain
// Output: a table on stdout. Needs ffmpeg, ffprobe and a Node that strips TypeScript. Not measured: a real voice,
// a real room, delivery (judge those by ear in the booth).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Clipped, VOX, processTake } from './plugin.ts';
import { lenWarn, slotOf } from './slots.ts';
import { EFFECTS, PRESETS, fxOn } from './fx.ts';

const args = process.argv.slice(2), fi = args.indexOf('--fx'), withFx = fi >= 0;
if (withFx) args.splice(fi, 1);
const ri = args.indexOf('--real');
const real = ri >= 0 ? args.splice(ri).slice(1) : [];
const out = path.resolve(args[0] ?? path.join(os.tmpdir(), 'booth-chain-probe'));
const SR = 48000;
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const db = (x) => 10 ** (x / 20);

const VOWELS = [[700, 1200, 2600], [400, 2000, 2550], [500, 900, 2400], [300, 870, 2250], [600, 1700, 2500]];

/** one phrase: n syllables of `syl` s each, a short dip (< 0.4 s) between them */
function phrase(n, syl = 0.2, dip = 0.05) {
  const len = Math.round(n * (syl + dip) * SR), x = new Float32Array(len);
  let ph = 0;
  for (let s = 0; s < n; s++) {
    const t0 = Math.round(s * (syl + dip) * SR), L = Math.round(syl * SR), V = VOWELS[(s * 3 + 1) % VOWELS.length];
    const f0b = 105 + 20 * rnd();
    for (let i = 0; i < L; i++) {
      const t = i / L, f0 = f0b * (1 + 0.03 * Math.sin(2 * Math.PI * 5 * i / SR)) * (1 - 0.1 * t);
      ph += f0 / SR;
      let v = 0;
      for (let k = 1; k * f0 < 7000; k++) {
        const f = k * f0;
        let a = 0;
        V.forEach((F, j) => { a += [1, 0.5, 0.25][j] * Math.exp(-(((f - F) / (80 + 40 * j)) ** 2)); });
        v += (a + 0.02 / k) * Math.sin(2 * Math.PI * k * ph + k * 0.7);
      }
      // syllable envelope: quick onset, a held body, a decaying tail (the word tail the expander must keep)
      const env = t < 0.1 ? t / 0.1 : t > 0.6 ? Math.exp(-(t - 0.6) * 9) : 1;
      x[t0 + i] += v * env * (0.6 + 0.4 * ((s * 7) % 3) / 2);
    }
    // the fricative: 40 ms of bright noise at the onset, ~25 dB under the vowel
    let hp = 0;
    for (let i = 0; i < 0.04 * SR && t0 + i < len; i++) { const w = rnd() * 2 - 1; hp = w - hp * 0.2; x[t0 + i] += hp * 0.03 * (1 - i / (0.04 * SR)); }
  }
  return x;
}

function noise(len, rmsDb) {
  const x = new Float32Array(len);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = rnd() * 2 - 1;
    b0 = 0.997 * b0 + 0.03 * w; b1 = 0.985 * b1 + 0.06 * w; b2 = 0.95 * b2 + 0.12 * w;
    x[i] = b0 + b1 + b2 + 0.1 * w;
  }
  const r = Math.sqrt(x.reduce((a, v) => a + v * v, 0) / len), g = db(rmsDb) / r;
  for (let i = 0; i < len; i++) x[i] *= g;
  return x;
}

/** a take: [lead s, phrase, gap s, phrase, ..., tail s]; voice peak at peakDb; room noise at noiseDb RMS */
function take(parts, { peakDb = -8, noiseDb = -40, gainDb = 0, clip = false } = {}) {
  const segs = parts.map((p) => (typeof p === 'number' ? new Float32Array(Math.round(p * SR)) : p));
  const len = segs.reduce((a, s) => a + s.length, 0), v = new Float32Array(len);
  let o = 0;
  for (const s of segs) { v.set(s, o); o += s.length; }
  let pk = 0;
  for (const s of v) pk = Math.max(pk, Math.abs(s));
  const g = db(peakDb) / pk;
  const n = noise(len, noiseDb), x = new Float32Array(len);
  for (let i = 0; i < len; i++) x[i] = (v[i] * g + n[i]) * db(gainDb);
  // the key clicks: Space down at the head, Space at the tail
  for (const at of [Math.round(0.04 * SR), len - Math.round(0.08 * SR)]) for (let i = 0; i < 300; i++) x[at + i] += 0.25 * Math.exp(-i / 40) * (rnd() * 2 - 1);
  if (clip) for (let i = 0; i < len; i++) x[i] = Math.max(-1, Math.min(1, x[i]));
  return x;
}

function wav(file, x) {
  const b = Buffer.alloc(44 + x.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + x.length * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(x.length * 2, 40);
  x.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  fs.writeFileSync(file, b);
}


/** 50 ms RMS windows (dBFS) of a file: the gap (median of the longest run 20 dB under the loudest, away from the
 *  ends) and the mean syllable dip */
function profile(file) {
  const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '44100', '-f', 'f32le', '-'], { maxBuffer: 1 << 26 });
  const x = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4), W = 2205, w = [];
  for (let i = 0; i + W <= x.length; i += W) { let s = 0; for (let j = i; j < i + W; j++) s += x[j] * x[j]; w.push(10 * Math.log10(s / W + 1e-20)); }
  const top = Math.max(...w);
  let best = [0, 0], a = -1;
  for (let i = 2; i < w.length - 2; i++) {
    if (w[i] < top - 20) { if (a < 0) a = i; if (i - a + 1 > best[1] - best[0]) best = [a, i + 1]; } else a = -1;
  }
  const run = w.slice(best[0], best[1]).sort((p, q) => p - q);
  const dips = w.filter((v, i) => i > 0 && i < w.length - 1 && v < top - 8 && v > top - 20 && w[i - 1] > top - 8);
  return { gap: run.length ? run[run.length >> 1] : null, lo: run[0], hi: run.at(-1), gapLen: run.length * 0.05, dip: dips.length ? dips.reduce((p, q) => p + q, 0) / dips.length : null };
}

fs.mkdirSync(out, { recursive: true });
const p1 = phrase(4), p2 = phrase(3);
const takes = {
  clean: take([0.6, p1, 0.6, p2, 0.45]),
  hot: take([0.6, p1, 0.6, p2, 0.45], { peakDb: -2 }),
  clipped: take([0.6, p1, 0.6, p2, 0.45], { gainDb: 16, clip: true }),
  long: take([0.6, phrase(16), 0.45]),
};
const files = [];
for (const [k, x] of Object.entries(takes)) {
  wav(path.join(out, k + '.wav'), x);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(out, k + '.wav'), '-c:a', 'libopus', '-b:a', '256k', '-f', 'webm', path.join(out, k + '.webm')]);
  files.push(path.join(out, k + '.webm'));
}
files.push(...real.map((f) => path.resolve(f)));
const hype = slotOf('hype10');
const f1 = (v) => (v == null ? '-' : (+v).toFixed(1));
const row = (...c) => console.log(c.map((v, i) => String(v).padEnd([24, 9, 7, 7, 8, 18, 8, 9][i] ?? 0)).join(' '));
row('take', 'raw pk', 'LUFS', 'dBTP', 'length', 'gaps dBFS (range)', 'dip', 'verdict');
const run1 = async (f, tag, o) => {
  const name = path.basename(f).replace(/\.\w+$/, '') + tag;
  try {
    const r = await processTake(f, path.join(out, name + '.ogg'), o);
    const p = profile(path.join(out, name + '.ogg'));
    const notes = [lenWarn(hype, r.dur) && 'LONG', r.warn && r.warn.split(' (')[0].toUpperCase()].filter(Boolean).join(', ');
    row(name, f1(r.rawPeak), f1(r.lufs), f1(r.peak), r.dur?.toFixed(2) + ' s', p.gap == null ? 'none found' : `${f1(p.gap)} (${f1(p.lo)}..${f1(p.hi)})`, f1(p.dip), 'kept' + (notes ? ': ' + notes : ''));
  } catch (e) {
    row(name, e instanceof Clipped ? f1(e.rawPeak) : '-', '', '', '', '', '', e instanceof Clipped ? 'REFUSED (clipped)' : 'ERROR ' + e.message);
  }
};
for (const f of files) await run1(f, '', {});
await run1(files[0], ' (no squeeze)', { squeeze: false });
// the same take with the expander off (range 1 = no reduction): what the gaps and dips were before LS2-booth2
const range = VOX.expand.range;
VOX.expand.range = 1;
await run1(files[0], ' (no expander)', { squeeze: false });
VOX.expand.range = range;
console.log(`\nexpander: RMS trough + ${VOX.expand.over} dB, ${VOX.expand.ratio}:1, range ${VOX.expand.range}; squeeze: pauses > ${VOX.squeeze.over} s to ${VOX.squeeze.keep} s; hype10 warns past ${2.5} s. Files: ${out}`);

if (withFx) {
  // the FX rack on the clean take: every preset must still land at VOX.lufs under the limiter
  const frow = (...c) => console.log(c.map((v, i) => String(v).padEnd([30, 7, 7, 8, 30][i] ?? 0)).join(' '));
  console.log('\nFX presets on the clean take (fx.ts PRESETS):');
  frow('preset', 'LUFS', 'dBTP', 'length', 'verdict');
  const fxRun = async (fx, name) => {
    try {
      const r = await processTake(files[0], path.join(out, 'fx-' + name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.ogg'), { fx });
      // against the clean take's own level (the synth lands ~1.3 LU under VOX.lufs: its crest, ls2-booth2.md)
      const under = base == null ? 0 : base - r.lufs;
      const notes = [under > 2 && `${under.toFixed(1)} LU UNDER CLEAN`, lenWarn(hype, r.dur) && 'LONG', r.warn && r.warn.split(' (')[0].toUpperCase()].filter(Boolean).join(', ');
      return { ok: true, r, verdict: 'kept' + (notes ? ': ' + notes : '') };
    } catch (e) {
      return { ok: false, verdict: 'ERROR ' + String(e.message).split('\n').slice(0, 3).join(' | ') };
    }
  };
  let bad = 0, base = null;
  for (const p of PRESETS) {
    const { ok, r, verdict } = await fxRun(fxOn(p.fx) ? p.fx : undefined, p.name);
    if (!ok) bad++;
    if (!fxOn(p.fx) && r) base = r.lufs;
    frow(p.name, f1(r?.lufs), f1(r?.peak), r ? r.dur.toFixed(2) + ' s' : '', verdict);
  }
  // every effect alone at the corners of its knobs: ffmpeg must accept the graph at both ends
  let n = 0, failed = 0;
  for (const e of EFFECTS) for (const end of ['min', 'max']) {
    const fx = { [e.id]: Object.fromEntries(e.knobs.map((k) => [k.k, k[end]])) };
    n++;
    const { ok, r, verdict } = await fxRun(fx, `${e.id}-${end}`);
    if (!ok) { failed++; frow(`${e.label} at ${end}`, f1(r?.lufs), f1(r?.peak), r ? r.dur.toFixed(2) + ' s' : '', verdict); }
  }
  console.log(`\n${PRESETS.length - bad}/${PRESETS.length} presets rendered; effects alone at their min/max knobs: ${n - failed}/${n} rendered (failures listed above)`);
  if (bad || failed) process.exitCode = 1;
}

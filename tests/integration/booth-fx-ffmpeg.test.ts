// The FX rack through the real chain (tools/booth/plugin.ts processTake): runs only where ffmpeg and ffprobe are on
// PATH (skipped otherwise; `node tools/booth/chain-probe.mjs --fx` is the full sweep with a table). A synthetic take,
// made here: voiced 120 Hz bursts over a -40 dBFS room, never a real recording. Every effect alone at its defaults and
// every preset is rendered: each must come out a finite, audible take near the target loudness, under the ceiling,
// and no longer than its rack allows.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VOX, processTake } from '../../tools/booth/plugin';
import { EFFECTS, FX_TAIL, PRESETS, defaults, fxOn, type FxSet } from '../../tools/booth/fx';

const has = (bin: string) => { try { execFileSync(bin, ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } };
const FF = has('ffmpeg') && has('ffprobe');

const SR = 48000;
function synth(file: string) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const len = Math.round(2.4 * SR), x = new Float32Array(len);
  // two phrases of three syllables, 0.5 s apart; harmonics of 120 Hz under a syllable envelope
  for (const [a, n] of [[0.5, 3], [1.55, 3]] as const) for (let s = 0; s < n; s++) {
    const t0 = Math.round((a + s * 0.25) * SR), L = Math.round(0.2 * SR);
    for (let i = 0; i < L; i++) {
      const t = i / L, env = t < 0.1 ? t / 0.1 : t > 0.6 ? Math.exp(-(t - 0.6) * 9) : 1;
      let v = 0;
      for (let k = 1; k < 30; k++) v += Math.sin(2 * Math.PI * 120 * k * (i / SR)) / k;
      x[t0 + i] += 0.25 * v * env;
    }
  }
  for (let i = 0; i < len; i++) x[i] += 0.01 * (rnd() * 2 - 1);
  const b = Buffer.alloc(44 + len * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + len * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(len * 2, 40);
  x.forEach((v, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2));
  fs.writeFileSync(file, b);
}

let dir: string, raw: string;
beforeAll(() => {
  if (!FF) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'booth-fx-'));
  raw = path.join(dir, 'take-matty-1.wav');
  synth(raw);
});
afterAll(() => { if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

describe.skipIf(!FF)('processTake with the FX rack (real ffmpeg)', () => {
  const robot = PRESETS.find((p) => p.name === 'Robot')!.fx;
  it('lands a racked take on the target (at least as loud as the clean one), names the rack, and leaves no temp file', async () => {
    const clean = await processTake(raw, path.join(dir, 'clean.ogg'));
    const fx = await processTake(raw, path.join(dir, 'robot.ogg'), { fx: robot });
    expect(fx.fx).toBe('robot + radio band');
    expect(clean.fx).toBe('');
    // this synthetic take is far peakier than a voice: the clean one, with one 3 dB makeup pass (VOX.makeup), lands
    // ~5 LU short of the target; a racked take gets the bigger makeup (VOX.fxMakeup) and reaches it
    expect(fx.lufs!).toBeGreaterThanOrEqual(clean.lufs! - 0.5);
    expect(Math.abs(fx.lufs! - VOX.lufs)).toBeLessThan(1);
    expect(fs.readdirSync(dir).sort()).toEqual(['clean.ogg', 'robot.ogg', 'take-matty-1.wav']);
  }, 60_000);
  it("bases the quiet-take warning on the take's own level, not on what the rack took away", async () => {
    // the Robot preset thins the take by several dB: that gain is the rack's, not the mic's
    const clean = await processTake(raw, path.join(dir, 'c2.ogg'));
    const fx = await processTake(raw, path.join(dir, 'r2.ogg'), { fx: robot });
    expect(clean.warn ?? '').not.toMatch(/quiet take/);
    expect(fx.warn ?? '').not.toMatch(/quiet take/);
    expect(fx.gain).toBeGreaterThan(clean.gain);
  }, 60_000);

  /** how long a rack may make the take: the clean length, moved by a tape speed, a stutter or a swell, plus the tail */
  const maxLen = (fx: FxSet, clean: number) => {
    let len = clean;
    if (fx.speed?.semi) len /= 2 ** (fx.speed.semi / 12);
    if (fx.stutter) len += Math.round(fx.stutter.n) * (fx.stutter.ms / 1000);
    if (fx.revverb?.mix) len += fx.revverb.swell;
    return len + FX_TAIL + 0.03;
  };
  const RACKS: [string, FxSet][] = [
    ...EFFECTS.map((e): [string, FxSet] => [`${e.id} alone`, { [e.id]: defaults(e.id) }]),
    ...PRESETS.filter((p) => fxOn(p.fx)).map((p): [string, FxSet] => [p.name, p.fx]),
  ];
  it(`renders every effect alone and every preset (${RACKS.length} racks): finite, audible, on target, bounded`, async () => {
    const sub = fs.mkdtempSync(path.join(dir, 'all-'));
    const clean = await processTake(raw, path.join(sub, 'clean.ogg'));
    const bad: string[] = [];
    // four at a time: each take has its own temp files (named after its output)
    for (let i = 0; i < RACKS.length; i += 4) {
      await Promise.all(RACKS.slice(i, i + 4).map(async ([name, fx], j) => {
        try {
          const r = await processTake(raw, path.join(sub, `fx-${i + j}.ogg`), { fx });
          const why = [
            !(Number.isFinite(r.lufs) && Number.isFinite(r.peak) && Number.isFinite(r.dur)) && 'not measurable',
            // the target is VOX.lufs (-12): the synthetic take's crest leaves its clean take ~1.4 LU under it; a racked
            // take gets the bigger makeup (VOX.fxMakeup), so it may land a little over the clean one, never far off
            !(r.lufs! >= clean.lufs! - 1.5 && r.lufs! <= VOX.lufs + 1) && `${r.lufs} LUFS (clean ${clean.lufs})`,
            !(r.peak! <= VOX.fxPeak + 0.2) && `peak ${r.peak} dBTP`,
            !(r.dur! <= maxLen(fx, clean.dur!) && r.dur! >= clean.dur! / 2.05) && `${r.dur} s (clean ${clean.dur}, max ${maxLen(fx, clean.dur!).toFixed(2)})`,
            /quiet take/.test(r.warn ?? '') && 'quiet-take warning',
          ].filter(Boolean);
          if (why.length) bad.push(`${name}: ${why.join(', ')}`);
        } catch (e) {
          bad.push(`${name}: ${(e as Error).message.split('\n')[0]}`);
        }
      }));
    }
    expect(bad).toEqual([]);
    // nothing left behind but the takes
    expect(fs.readdirSync(sub).every((f) => /^(clean|fx-\d+)\.ogg$/.test(f))).toBe(true);
  }, 600_000);
});

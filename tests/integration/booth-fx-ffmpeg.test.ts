// The FX rack through the real chain (tools/booth/plugin.ts processTake): runs only where ffmpeg and ffprobe are on
// PATH (skipped otherwise; `node tools/booth/chain-probe.mjs --fx` is the full sweep). A synthetic take, made here:
// voiced 120 Hz bursts over a -40 dBFS room, never a real recording.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { processTake } from '../../tools/booth/plugin';
import { PRESETS } from '../../tools/booth/fx';

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
  it('lands a racked take near the clean one, names the rack, and leaves no temp file', async () => {
    const clean = await processTake(raw, path.join(dir, 'clean.ogg'));
    const fx = await processTake(raw, path.join(dir, 'robot.ogg'), { fx: robot });
    expect(fx.fx).toBe('robot + radio band');
    expect(clean.fx).toBe('');
    // within the makeup pass's reach (VOX.makeup 3 dB): a peakier racked take comes back a little quiet, never far off
    expect(Math.abs(fx.lufs! - clean.lufs!)).toBeLessThan(3);
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
});

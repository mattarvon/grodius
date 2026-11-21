// The booth's denoise stage (plugin.ts prepTake): DeepFilterNet's `deep-filter` CLI when it is installed, else
// ffmpeg's afftdn. Which one runs is decided once per process (denoiser()) from the environment and the disk; the rule
// itself (resolveDenoise) is pure, so the fallback is unit-tested without the binary (tests/unit/booth-denoise.test.ts).
// No binary ships in the repo: CI and a machine without DFN run afftdn, as the booth did before.
//   BOOTH_DFN=<path>        the deep-filter binary (a file), or a folder holding one
//   BOOTH_DENOISE=afftdn    force ffmpeg's afftdn even with DFN installed (an A/B, or a DFN that misbehaves)
// Default install (README): E:/projects/tools/deepfilternet/deep-filter-<version>-x86_64-pc-windows-msvc.exe
import fs from 'node:fs';
import path from 'node:path';

export type DenoiseMode = 'dfn' | 'afftdn';
/** the resolved stage: `dfn` with the binary's path, or `afftdn`; `why` says why DFN is not used (for the note) */
export type Denoise = { mode: 'dfn'; bin: string; version: string | null } | { mode: 'afftdn'; why?: string };

/** where the booth looks for deep-filter when BOOTH_DFN is not set */
export const DFN_HOME = 'E:/projects/tools/deepfilternet';
/** a deep-filter binary's file name: deep-filter[.exe] or the release's deep-filter-<version>-<target>[.exe] */
export const DFN_FILE_RE = /^deep-filter(?:-(\d+\.\d+\.\d+)[-.\w]*)?(?:\.exe)?$/i;

/** a version string's parts for a numeric sort ('0.5.10' after '0.5.6') */
const ver = (s: string | null) => (s ?? '0.0.0').split('.').map(Number);
const newer = (a: string | null, b: string | null) => {
  const x = ver(a), y = ver(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

/** the deep-filter binary in a folder's listing: a plain deep-filter[.exe] first, else the newest versioned release */
export function pickBin(names: readonly string[]): { name: string; version: string | null } | null {
  const hits = names.map((n) => ({ n, m: DFN_FILE_RE.exec(n) })).filter((h) => h.m).map((h) => ({ name: h.n, version: h.m![1] ?? null }));
  if (!hits.length) return null;
  const plain = hits.find((h) => h.version == null);
  if (plain) return plain;
  return hits.sort((a, b) => newer(b.version, a.version))[0];
}

/** what the resolver may look at: the environment and the disk (a test hands in its own) */
export type Probe = {
  env: Record<string, string | undefined>;
  isFile: (p: string) => boolean;
  isDir: (p: string) => boolean;
  list: (dir: string) => string[];
};

/** which denoise runs: `want` (VOX.denoise.mode) unless BOOTH_DENOISE overrides it, and DFN only when its binary is
 *  found (BOOTH_DFN, a file or a folder, else DFN_HOME); otherwise afftdn, with why */
export function resolveDenoise(want: DenoiseMode, p: Probe): Denoise {
  const force = p.env.BOOTH_DENOISE?.trim().toLowerCase();
  const mode: DenoiseMode = force === 'afftdn' || force === 'dfn' ? force : want;
  if (mode === 'afftdn') return { mode: 'afftdn', ...(force === 'afftdn' ? { why: 'BOOTH_DENOISE=afftdn' } : {}) };
  const set = p.env.BOOTH_DFN?.trim();
  const where = set || DFN_HOME;
  const inDir = (dir: string) => {
    const b = pickBin(p.list(dir));
    return b ? { mode: 'dfn' as const, bin: path.join(dir, b.name), version: b.version } : null;
  };
  if (p.isFile(where)) return { mode: 'dfn', bin: where, version: DFN_FILE_RE.exec(path.basename(where))?.[1] ?? null };
  const found = p.isDir(where) ? inDir(where) : null;
  if (found) return found;
  return { mode: 'afftdn', why: set ? `BOOTH_DFN=${set}: no deep-filter binary there` : `no deep-filter in ${DFN_HOME} (set BOOTH_DFN)` };
}

/** the real disk and environment */
export const realProbe = (): Probe => ({
  env: process.env,
  isFile: (f) => { try { return fs.statSync(f).isFile(); } catch { return false; } },
  isDir: (d) => { try { return fs.statSync(d).isDirectory(); } catch { return false; } },
  list: (d) => { try { return fs.readdirSync(d); } catch { return []; } },
});

/** a short name for the stage, as the booth shows it and the caches and records key on */
export const denoiseTag = (d: Denoise) => (d.mode === 'dfn' ? `dfn${d.version ? '-' + d.version : ''}` : 'afftdn');

let cached: Denoise | null = null;
/** the stage this process uses: resolved at the first call, and a one-time console note when DFN was wanted but is
 *  not there (the booth keeps working on afftdn) */
export function denoiser(want: DenoiseMode, note: (s: string) => void = (s) => console.warn(s)): Denoise {
  if (cached) return cached;
  cached = resolveDenoise(want, realProbe());
  if (want === 'dfn' && cached.mode === 'afftdn') note(`booth: denoise falls back to ffmpeg afftdn (${cached.why})`);
  return cached;
}
/** forgets the resolved stage (a test, or after installing DFN in a running process) */
export function resetDenoiser() { cached = null; }

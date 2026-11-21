// The booth's denoise stage choice (tools/booth/denoise.ts): DeepFilterNet's deep-filter when its binary is found,
// ffmpeg's afftdn otherwise. Pure: a fake environment and disk, so it runs (and must pass) on CI, which has no DFN.
import { afterEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { DFN_HOME, denoiseTag, denoiser, pickBin, resetDenoiser, resolveDenoise, type Probe } from '../../tools/booth/denoise';

const WIN = 'deep-filter-0.5.6-x86_64-pc-windows-msvc.exe';
/** a disk of `files` (full paths); folders are their parents */
function disk(files: string[], env: Record<string, string | undefined> = {}): Probe {
  const norm = (p: string) => path.normalize(p);
  const set = new Set(files.map(norm)), dirs = new Set(files.map((f) => norm(path.dirname(f))));
  return {
    env,
    isFile: (p) => set.has(norm(p)),
    isDir: (p) => dirs.has(norm(p)),
    list: (d) => files.filter((f) => norm(path.dirname(f)) === norm(d)).map((f) => path.basename(f)),
  };
}

describe('pickBin', () => {
  it('takes a plain deep-filter[.exe] first, else the newest versioned release; ignores the LADSPA plugin and others', () => {
    expect(pickBin([WIN, 'deep-filter.exe'])).toEqual({ name: 'deep-filter.exe', version: null });
    expect(pickBin(['deep-filter-0.5.4-x86_64-pc-windows-msvc.exe', WIN, 'deep-filter-0.5.10-x86_64-pc-windows-msvc.exe']))
      .toEqual({ name: 'deep-filter-0.5.10-x86_64-pc-windows-msvc.exe', version: '0.5.10' });
    expect(pickBin(['deep-filter-0.5.6-x86_64-unknown-linux-musl'])).toEqual({ name: 'deep-filter-0.5.6-x86_64-unknown-linux-musl', version: '0.5.6' });
    expect(pickBin(['deep_filter_ladspa-0.5.6-x86_64-pc-windows-msvc.dll', 'readme.txt', 'venv'])).toBeNull();
    expect(pickBin([])).toBeNull();
  });
});

describe('resolveDenoise', () => {
  it('finds the release binary in the default install folder', () => {
    const d = resolveDenoise('dfn', disk([path.join(DFN_HOME, WIN)]));
    expect(d).toEqual({ mode: 'dfn', bin: path.join(DFN_HOME, WIN), version: '0.5.6' });
    expect(denoiseTag(d)).toBe('dfn-0.5.6');
  });
  it('BOOTH_DFN names the binary itself, or a folder holding one', () => {
    const bin = 'C:/x/tools/deep-filter.exe';
    expect(resolveDenoise('dfn', disk([bin], { BOOTH_DFN: bin }))).toEqual({ mode: 'dfn', bin, version: null });
    expect(resolveDenoise('dfn', disk([bin], { BOOTH_DFN: 'C:/x/tools' }))).toEqual({ mode: 'dfn', bin: path.join('C:/x/tools', 'deep-filter.exe'), version: null });
    // BOOTH_DFN wins over the default install
    expect(resolveDenoise('dfn', disk([bin, path.join(DFN_HOME, WIN)], { BOOTH_DFN: bin }))).toMatchObject({ mode: 'dfn', bin });
  });
  it('falls back to afftdn when the binary is nowhere (CI), saying why', () => {
    const none = resolveDenoise('dfn', disk([]));
    expect(none.mode).toBe('afftdn');
    expect(none.mode === 'afftdn' && none.why).toMatch(/no deep-filter in .*BOOTH_DFN/);
    const bad = resolveDenoise('dfn', disk([path.join(DFN_HOME, WIN)], { BOOTH_DFN: 'D:/nope/deep-filter.exe' }));
    expect(bad).toEqual({ mode: 'afftdn', why: 'BOOTH_DFN=D:/nope/deep-filter.exe: no deep-filter binary there' });
    // a folder with no binary in it
    expect(resolveDenoise('dfn', disk(['C:/y/readme.txt'], { BOOTH_DFN: 'C:/y' })).mode).toBe('afftdn');
    expect(denoiseTag(none)).toBe('afftdn');
  });
  it('BOOTH_DENOISE=afftdn forces the fallback even with DFN installed; afftdn wanted never looks for DFN', () => {
    expect(resolveDenoise('dfn', disk([path.join(DFN_HOME, WIN)], { BOOTH_DENOISE: 'afftdn' }))).toEqual({ mode: 'afftdn', why: 'BOOTH_DENOISE=afftdn' });
    expect(resolveDenoise('dfn', disk([path.join(DFN_HOME, WIN)], { BOOTH_DENOISE: ' AFFTDN ' })).mode).toBe('afftdn');
    expect(resolveDenoise('afftdn', disk([path.join(DFN_HOME, WIN)]))).toEqual({ mode: 'afftdn' });
    expect(resolveDenoise('afftdn', disk([path.join(DFN_HOME, WIN)], { BOOTH_DENOISE: 'dfn' })).mode).toBe('dfn');
    // junk is ignored
    expect(resolveDenoise('dfn', disk([path.join(DFN_HOME, WIN)], { BOOTH_DENOISE: 'rnnoise' })).mode).toBe('dfn');
  });
});

describe('denoiser (once per process)', () => {
  const was = { ...process.env };
  afterEach(() => { process.env = { ...was }; resetDenoiser(); });
  it('notes a fallback once, and keeps its first answer', () => {
    process.env.BOOTH_DFN = path.join('Z:', 'no', 'such', 'deep-filter.exe');
    delete process.env.BOOTH_DENOISE;
    resetDenoiser();
    const note = vi.fn();
    expect(denoiser('dfn', note).mode).toBe('afftdn');
    expect(denoiser('dfn', note).mode).toBe('afftdn');
    expect(note).toHaveBeenCalledTimes(1);
    expect(note.mock.calls[0][0]).toMatch(/falls back to ffmpeg afftdn/);
  });
  it('says nothing when afftdn is what was asked for', () => {
    process.env.BOOTH_DENOISE = 'afftdn';
    resetDenoiser();
    const note = vi.fn();
    expect(denoiser('afftdn', note).mode).toBe('afftdn');
    expect(note).not.toHaveBeenCalled();
  });
});

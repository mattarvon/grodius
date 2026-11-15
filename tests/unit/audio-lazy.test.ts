// D55: THE KEEPSAKE's kboss_* banks are lazy (audio.ts LAZY / bankWant): they are not fetched when the audio starts, a
// bankWant before the audio runs is remembered and honoured by the later auInit, and asking twice fetches nothing twice.
// A fake AudioContext (any node, any param) and a stubbed fetch that records what was asked for; no real audio.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/save', () => ({ SET: { muted: false } }));
vi.mock('../../src/music', () => ({ duckMusic: () => {}, curBiome: () => null }));

let A: typeof import('../../src/audio');
let urls: string[];
/** any Web Audio node or param: every property is another one, every call returns one, buffers have channel data */
const any = (): any => new Proxy(function () {}, { get: (_t, k) => (k === 'then' ? undefined : k === 'getChannelData' ? () => new Float32Array(4) : any()), apply: () => any(), set: () => true });
const ctx = () => new Proxy({ sampleRate: 100, currentTime: 0, state: 'running', decodeAudioData: () => Promise.resolve({ duration: .1 }) } as any, { get: (t, k) => (k in t ? t[k] : any()) });
const kboss = () => urls.filter((u) => /kboss_/.test(u)).length;

beforeEach(async () => {
  vi.resetModules(); // WANT / LOADED are module state: a fresh audio.ts per test
  urls = [];
  vi.stubGlobal('fetch', (u: string) => { urls.push(String(u)); return Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)) }); });
  vi.stubGlobal('window', { AudioContext: function () { return ctx(); } });
  A = await import('../../src/audio');
});

describe('lazy sound banks (audio.ts LAZY, bankWant)', () => {
  it('leaves the kboss_ banks out when the audio starts, and loads every other bank', () => {
    A.auInit();
    expect(urls.length).toBeGreaterThan(100);
    expect(kboss()).toBe(0);
  });

  it('loads them once asked, and only once however often it is asked', () => {
    A.auInit();
    const n = urls.length;
    A.bankWant('kboss_');
    const k = kboss();
    expect(k).toBeGreaterThanOrEqual(17); // every bank of the audio lane's list, a take or more each
    expect(urls.length - n).toBe(k); //    nothing else fetched again
    A.bankWant('kboss_');
    expect(kboss()).toBe(k);
  });

  it('remembers a bankWant made before the audio runs, and honours it at the later auInit', () => {
    A.bankWant('kboss_');
    expect(urls.length).toBe(0); // no context yet: deferred
    A.auInit();
    expect(kboss()).toBeGreaterThanOrEqual(17);
    expect(new Set(urls).size).toBe(urls.length); // no file fetched twice
  });
});

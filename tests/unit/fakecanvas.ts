// A do-nothing DOM for tests that have to import canvas code for real: every property reads as a callable stand-in, so
// module-level getContext() and per-frame draw calls run and record nothing. Call before a dynamic import of the module.
// Why stubGlobal and not vi.mock: core.ts calls getContext() at import, under every render module. It relies on vitest's
// per-file isolation; unstub in afterAll anyway. Values read from it are 0 or truthy: never assert on geometry, feature
// checks or storage through it.
import { vi } from 'vitest';

const blank = (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });

/** the stand-in: callable, and any property of it is another stand-in */
export function fake(): any {
  return new Proxy(function () {}, {
    apply: () => fake(),
    construct: () => fake(),
    get: (t: any, k) => {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'getImageData') return (_x: number, _y: number, w: number, h: number) => blank(w, h);
      if (k === 'createImageData') return (w: number, h: number) => blank(w, h);
      if (k === 'then') return undefined; // not a thenable, or `await` hangs on it
      if (!(k in t)) t[k] = fake();
      return t[k];
    },
    set: (t: any, k, v) => { t[k] = v; return true; },
  });
}

export function stubDom() {
  for (const k of ['document', 'window', 'localStorage', 'addEventListener', 'Image', 'DOMMatrix', 'Audio', 'AudioContext', 'navigator', 'location', 'matchMedia', 'requestAnimationFrame'])
    vi.stubGlobal(k, fake());
  vi.stubGlobal('innerWidth', 960);
  vi.stubGlobal('innerHeight', 540);
  vi.stubGlobal('devicePixelRatio', 1);
}

// The Maw's death, behaviourally (LS1 row K bug, I+K review): its split corpse redraws it through drawGrossMaw for as long as
// the halves last, and that must not start a new rupture each frame. Read through the __mawFx probe hook.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { stubDom, fake } from './fakecanvas';

let M: typeof import('../../src/render/gross/maw');
let $: any;
const fx = () => (globalThis as any).__mawFx();
const maw = (o = {}) => ({ k: 'maw', x: 300, y: 130, r: 26, t: 50, hp: 100, max: 100, biome: 'acid', dead: false, eyesP: [], ...o });
function frame(e?: any) {
  $.T++;
  if (e) M.drawGrossMaw(fake(), e); // the split corpse (gore.ts 'half') calls exactly this, twice a frame
  if (e) M.drawGrossMaw(fake(), e);
  M.drawMawFx();
}

beforeAll(async () => {
  stubDom();
  ({ $ } = await import('../../src/state'));
  M = await import('../../src/render/gross/maw');
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  $.G = { scroll: 0, t: 0 }; // a new G: drawMawFx drops every rupture, particle and live Maw on its next call
  $.P = { x: 90, y: 130 };
  $.state = 'play';
  $.T = 100;
  M.drawMawFx();
});

describe('a killed Maw', () => {
  it('ruptures once, however many frames its halves keep redrawing it', () => {
    const e = maw();
    frame(e);
    expect(fx().rup).toBe(0);
    expect(fx().live).toBe(1);
    Object.assign(e, { dead: true, hp: 0 });
    frame();
    expect(fx().rup).toBe(1);
    for (let i = 0; i < 30; i++) frame(e);
    expect(fx().rup).toBe(1);
    expect(fx().live).toBe(0);
  });

  it('does not rupture a Maw that leaves alive (dead with hp left)', () => {
    const e = maw();
    frame(e);
    Object.assign(e, { dead: true });
    frame();
    expect(fx().rup).toBe(0);
    expect(fx().live).toBe(0);
  });

  it('does not rupture a Maw killed past the right edge, where nobody sees it', () => {
    const e = maw({ x: 900 });
    frame(e);
    Object.assign(e, { dead: true, hp: 0 });
    frame();
    expect(fx().rup).toBe(0);
  });
});

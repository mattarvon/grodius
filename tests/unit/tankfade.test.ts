import { describe, expect, it } from 'vitest';
import { TANK_FADE, tankFadeNew, tankFadeStep } from '../../src/render/tankfade';

// The acid vats' dead fade while THE DISSOLVING WOMB is up (D46, Matt's call b). The fade is driven by the frame counter $.T,
// one call per rendered frame.
const run = (s, from, to, womb) => { let a = 1; for (let T = from; T <= to; T++) a = tankFadeStep(s, T, womb); return a; };

describe('tankFadeStep', () => {
  it('shows the bodies fully when no Womb has come', () => {
    const s = tankFadeNew();
    expect(run(s, 0, 500, false)).toBe(1);
  });
  it('fades them out completely within TANK_FADE.out frames of the Womb arriving, never popping in one frame', () => {
    const s = tankFadeNew();
    run(s, 0, 10, false);
    const first = tankFadeStep(s, 11, true);
    expect(first).toBeGreaterThan(.9);
    expect(run(s, 12, 10 + TANK_FADE.out, true)).toBe(0);
    expect(run(s, 11 + TANK_FADE.out, 300, true)).toBe(0); // and they stay gone for the whole fight
  });
  it('brings them back after the Womb dies, over TANK_FADE.back frames', () => {
    const s = tankFadeNew();
    run(s, 0, 100, true);
    const mid = run(s, 101, 100 + TANK_FADE.back / 2, false);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(run(s, 101 + TANK_FADE.back / 2, 100 + TANK_FADE.back, false)).toBe(1);
  });
  it('restarts its clock without a jump when $.T resets (a new run) or stalls', () => {
    const s = tankFadeNew();
    run(s, 0, 1000, true);
    expect(tankFadeStep(s, 0, false)).toBe(0); // T went backwards: no step, still hidden
    expect(tankFadeStep(s, 1, false)).toBeLessThan(.01); // then it eases from where it was
    const t = tankFadeNew();
    run(t, 0, 10, false);
    expect(tankFadeStep(t, 5000, true)).toBeGreaterThan(.9); // a 5000-frame stall counts as 4 frames, not a snap
  });
});

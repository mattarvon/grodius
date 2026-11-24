// Decision 23 (W6 round 3, gate E4 WALL <= 140 on the flat-arena rig): SPLIT's flankers read GUN_L4.flank on long4 and
// GUN_TODAY.flank elsewhere. Short parity rests on GUN_TODAY.flank being FAN's own .8 (the same doubles), so this pins
// the source (player.ts imports the DOM through its graph; the fire path is checked as text, as midhooks.test does).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync('src/player.ts', 'utf8');
describe('SPLIT flankers (decision 23)', () => {
  it('keeps short on FAN\'s .8 and trims long4 to .6', () => {
    expect(src).toMatch(/const FAN = \[\[0, 1\], \[-\.2, \.8\], \[\.2, \.8\]\];/);
    expect(src).toMatch(/export const GUN_TODAY = \{[^}]*flank: \.8 \}/);
    expect(src).toMatch(/export const GUN_L4 = \{[^}]*flank: \.6 \}/);
  });
  it('gives the core its FAN share and each flanker gun().flank, read once per shot', () => {
    expect(src).toMatch(/const fl = gun\(\)\.flank;[^\n]*\n\s*for \(let j = 0; j < org\.length; j\+\+\)/);
    expect(src).toMatch(/dmg: dm \* \(a \? fl : f\) \* \(j \? WR : 1\)/);
  });
});

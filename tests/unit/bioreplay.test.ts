// A replay after a rewind must not bank biomass twice (ls2-read report, economy-designer; ls1-audit). meta.bio banks at
// once and survives SURFACE + RE-ENTER, G.bio rewinds with the checkpoint, so the wallet pays only past the run's mark.
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/layout', () => ({ layout: () => ({ id: 'long4' }) }));
import { bankBio } from '../../src/economy';
import { readFileSync, readdirSync } from 'node:fs';

const SEED = 42;
const run = (bio = 0, seed = SEED) => ({ bio, seed } as any);
const wallet = (bio = 0) => ({ bio } as any);
/** RE-ENTER: the run comes back from its checkpoint's G.bio (and G.bioFk); the wallet and its mark stay */
const rewind = (G: any, cp: any) => ({ ...G, ...cp });

describe('bankBio', () => {
  it('pays run and wallet exactly n on an unrewound run', () => {
    const G = run(), m = wallet(500);
    for (const n of [5, 0.75, 30, 12.5]) bankBio(n, G, m);
    expect(G.bio).toBe(5 + 0.75 + 30 + 12.5);
    expect(m.bio).toBe(500 + 5 + 0.75 + 30 + 12.5);
  });

  it('banks a replayed stretch only once, however many times it is replayed', () => {
    const m = wallet();
    let G = run();
    for (let i = 0; i < 5; i++) {
      G = rewind(G, { bio: 0 });
      bankBio(70, G, m); // the midboss
      bankBio(120, G, m); // the stage clear
      expect(G.bio).toBe(190);
    }
    expect(m.bio).toBe(190);
  });

  it('pays only the part past the mark when a replay out-earns the first pass', () => {
    const m = wallet();
    let G = run();
    bankBio(100, G, m);
    G = rewind(G, { bio: 0 });
    bankBio(60, G, m);
    expect(m.bio).toBe(100);
    bankBio(60, G, m);
    expect(m.bio).toBe(120);
    bankBio(10, G, m);
    expect(m.bio).toBe(130);
  });

  it('keeps a spent wallet spent and does not let a purchase reopen the farm', () => {
    const m = wallet();
    let G = run();
    bankBio(100, G, m);
    m.bio -= 100; // the Infirmary between SURFACE and RE-ENTER
    G = rewind(G, { bio: 0 });
    bankBio(100, G, m);
    expect(m.bio).toBe(0);
  });

  it('starts a new mark on a new run seed', () => {
    const m = wallet();
    bankBio(100, run(0, 1), m);
    bankBio(40, run(0, 2), m);
    expect(m.bio).toBe(140);
  });

  it('gives nothing extra on the first pay of a save from before the mark, with G.bio already high', () => {
    const G = run(900), m = wallet(1000);
    bankBio(5, G, m);
    expect(m.bio).toBe(1005);
    expect(G.bio).toBe(905);
  });

  it('does not charge a replay for a first kill it cannot re-earn', () => {
    const m = wallet();
    let G = run();
    bankBio(50, G, m);
    G.bio += 100; G.bioFk = 100; m.bio += 100; // firstKill's own pay
    bankBio(50, G, m);
    expect(m.bio).toBe(200);
    G = rewind(G, { bio: 0, bioFk: 0 }); // the checkpoint was before the first kill; the kind stays recorded
    bankBio(100, G, m); // the same two kills' pay, no first kill this time
    expect(m.bio).toBe(200);
    bankBio(30, G, m);
    expect(m.bio).toBe(230); // the old mark would have held this back by the first kill's 100
  });

  it('leaves a dev jump out of the mark: it pays exactly n and writes nothing, even on a seed already marked', () => {
    const m = wallet();
    bankBio(100, run(), m);
    const J = { ...run(), jump: true };
    bankBio(40, J, m);
    expect(m.bio).toBe(140);
    expect(J.bio).toBe(40);
    expect(m.bioV).toBe(100);
  });
});

describe('the biomass invariants bankBio relies on', () => {
  const root = new URL('../../src/', import.meta.url);
  const files = (readdirSync(root, { recursive: true }) as string[]).filter((f) => f.endsWith('.ts'));
  const hits = (re: RegExp) => files.flatMap((f) => readFileSync(new URL(f, root), 'utf8').split('\n').filter((l) => re.test(l.replace(/\/\/.*$/, ''))).map((l) => `${f}: ${l.trim()}`));

  it('nothing subtracts from or assigns G.bio during a run: a drop would read as a replay and stop the pay', () => {
    expect(hits(/\bG\.bio\s*(-=|=(?!=)|--)/)).toEqual([]);
  });

  it('only bankBio and first-kill pay add to it, so a new pay site cannot skip the mark', () => {
    expect(hits(/\bG\.bio\s*\+=/).map((h) => h.split(':')[0]).sort()).toEqual(['economy.ts', 'economy.ts', 'enemies/update.ts'].sort());
    expect(hits(/\bmeta\.bio\s*\+=/).map((h) => h.split(':')[0])).toEqual(['save.ts']); // the v2 refund, on load
  });
});

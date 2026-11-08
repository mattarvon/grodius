// The set-piece catalogue and draw (spec §3.3, §10; build plan LS2-mv): pure, no DOM.
import { describe, expect, it } from 'vitest';
import { B1_FIRST_VISIT, CATALOG, SETS_PER_STAGE, SETW, SIG_FIRST_W, drawPicks, drawSets, isSetId, moveRoll } from '../../src/setdraw';
import { pickSeedOf, stream } from '../../src/rng';

const BIOMES = Object.keys(CATALOG);
const SEEDS = Array.from({ length: 200 }, (_, i) => i + 1);

describe('the set-piece catalogue', () => {
  it('has five distinct pieces per biome and no piece in two biomes', () => {
    for (const b of BIOMES) expect(new Set(CATALOG[b]).size, b).toBe(5);
    expect(new Set(Object.values(CATALOG).flat()).size).toBe(5 * BIOMES.length);
  });
  it('recognises its own ids and nothing else', () => {
    expect(isSetId('morgue')).toBe(true);
    for (const v of ['nope', '', 3, null, undefined, 'constructor']) expect(isSetId(v)).toBe(false);
  });
});

describe('drawSets', () => {
  it.each(BIOMES)('%s: a stage draws three different pieces, the same three from the same stream', (b) => {
    for (const s of SEEDS) {
      const a = drawSets(b, {}, stream(s));
      expect(a).toHaveLength(SETS_PER_STAGE);
      expect(new Set(a).size).toBe(SETS_PER_STAGE);
      expect(drawSets(b, {}, stream(s))).toEqual(a);
    }
  });
  it.each(BIOMES)('%s: a second visit plays both unused pieces, refilling for its third and repeating nothing within the stage', (b) => {
    for (const s of SEEDS) {
      const used = {}, rs = stream(s), one = drawSets(b, used, rs), two = drawSets(b, used, rs);
      expect(new Set(two).size).toBe(SETS_PER_STAGE);
      for (const id of CATALOG[b].filter((x) => !one.includes(x))) expect(two).toContain(id);
    }
  });
  it.each(BIOMES)('%s: over a long run no piece comes back before the catalogue has been through, bar the refill stage', (b) => {
    const used = {}, rs = stream(9), n = Object.fromEntries(CATALOG[b].map((k) => [k, 0]));
    for (let v = 0; v < 500; v++) for (const id of drawSets(b, used, rs)) n[id]++;
    for (const k of CATALOG[b]) expect(n[k], k).toBeGreaterThan(200); // 1500 draws over five: every piece is reached
  });
  it('keeps each biome\'s used set apart', () => {
    const used: Record<string, string[]> = {};
    drawSets('ice', used, stream(1));
    expect(used.ice).toHaveLength(3);
    expect(used.fire).toBeUndefined();
  });
});

describe('slot order', () => {
  it('weighs every catalogue piece', () => {
    for (const id of Object.values(CATALOG).flat()) expect(SETW[id], id).toBeGreaterThan(0);
  });
  it.each(BIOMES)('%s: puts the lightest of the three in S2, the movement-B slot (spec §3.2: lighter spawns there)', (b) => {
    for (const s of SEEDS) {
      const a = drawSets(b, {}, stream(s));
      expect(SETW[a[1]], a.join()).toBe(Math.min(...a.map((id) => SETW[id])));
    }
  });
});

describe('moveRoll', () => {
  it('flies B0 on a first visit in Descent 1, without drawing', () => {
    let n = 0;
    expect(moveRoll(0, 0, () => { n++; return 0; })).toBe(0);
    expect(n).toBe(0);
  });
  it('flies a remix on the variant the biome has not flown this run, B1 when it has flown both or neither, without drawing', () => {
    let n = 0;
    for (const loop of [0, 1, 3]) {
      expect(moveRoll(1, loop, () => { n++; return .99; }, 1)).toBe(1); // met on B0: B1
      expect(moveRoll(1, loop, () => { n++; return .99; }, 2)).toBe(0); // met on B1 (a Descent 2+ roll): B0, never B1 twice
      expect(moveRoll(2, loop, () => { n++; return .99; }, 3)).toBe(1);
      expect(moveRoll(1, loop, () => { n++; return .99; })).toBe(1);
    }
    expect(n).toBe(0);
  });
  it('records each variant a biome flies, so a run that rolled B1 first still shows B0', () => {
    const seen: Record<string, number> = {}, rs = () => 0; // rs 0: every first-visit roll in Descent 2+ comes up B1
    expect(drawPicks('acid', 0, 1, {}, rs, seen).mv).toBe(1);
    expect(drawPicks('acid', 1, 2, {}, rs, seen).mv).toBe(0);
    expect(seen.acid).toBe(3);
  });
  it('may roll B1 on a first visit from Descent 2', () => {
    expect(moveRoll(0, 1, () => B1_FIRST_VISIT - .01)).toBe(1);
    expect(moveRoll(0, 1, () => B1_FIRST_VISIT)).toBe(0);
  });
});

describe("first-visit signature weight (D36 item 2)", () => {
  /** a counting stream: every value from stream(s), and how many were drawn */
  const counted = (s: number) => { const rs = stream(s), c = { n: 0, rs: () => { c.n++; return rs(); } }; return c; };

  it('weighs the signature x2 on the first draw of a first visit, and evenly on a later visit', () => {
    // first draw .3: x2 over a pool of 5 is 6 shares, the signature's two cover [0, 2/6); evenly it covers [0, 1/5)
    // only. The next two draws (.99) take the pool's last pieces, never the signature at index 0
    const r = () => { const q = [.3, .99, .99]; return () => q.shift()!; };
    expect(SIG_FIRST_W).toBe(2);
    for (const b of BIOMES) {
      expect(drawPicks(b, 0, 0, {}, r()).sp, b).toContain(CATALOG[b][0]);
      expect(drawSets(b, {}, r()), b).not.toContain(CATALOG[b][0]);
      expect(drawPicks(b, 1, 0, {}, r(), { [b]: 1 }).sp, b).not.toContain(CATALOG[b][0]);
    }
  });

  it.each(BIOMES)('%s: plays the signature in ~80% of first visits (x2) against ~60% unweighted', (b) => {
    let hit = 0, flat = 0;
    for (let s = 1; s <= 2000; s++) {
      // the real pick streams (biomes.ts pickStream): stream(s) for small consecutive s opens on correlated values
      if (drawPicks(b, 0, 0, {}, stream(pickSeedOf(s, 0, 1))).sp.includes(CATALOG[b][0])) hit++;
      if (drawSets(b, {}, stream(pickSeedOf(s, 0, 1))).includes(CATALOG[b][0])) flat++;
    }
    // x2: 1 - (4/6)(3/5)(2/4) = .8; evenly 3/5
    expect(hit / 2000).toBeGreaterThan(.76);
    expect(hit / 2000).toBeLessThan(.84);
    expect(flat / 2000).toBeGreaterThan(.56);
    expect(flat / 2000).toBeLessThan(.64);
  });

  it('draws the same number of values with and without the weight', () => {
    for (const s of SEEDS) for (const loop of [0, 1]) {
      const a = counted(s), z = counted(s);
      drawPicks('fire', 0, loop, {}, a.rs);
      drawSets('fire', {}, z.rs);
      expect(a.n, `seed ${s} loop ${loop}`).toBe(z.n + (loop > 0 ? 1 : 0)); // + the Descent 2 first-visit B1 roll
    }
  });

  it('leaves a later visit identical to the unweighted draw', () => {
    for (const s of SEEDS) {
      const u1 = { fire: ['pincer'] }, u2 = { fire: ['pincer'] };
      expect(drawPicks('fire', 1, 0, u1, stream(s), { fire: 1 }).sp).toEqual(drawSets('fire', u2, stream(s)));
    }
  });

  it('draws as many pieces as the caller asks (biomes.ts passes layout beats.sets.length)', () => {
    expect(drawPicks('ice', 0, 0, {}, stream(3), {}, 2).sp).toHaveLength(2);
  });

  it('weighs the signature x2 on a biome first met in Descent 2, after its B1 roll', () => {
    // G4: from Descent 2 the first visit's B1 roll comes first, so the weighted draw is the second value; .3 lands on
    // the signature only when it weighs x2 (see the first test)
    for (const b of BIOMES) {
      const b0 = drawPicks(b, 0, 1, {}, ((q) => () => q.shift()!)([.9, .3, .99, .99]));
      expect(b0.mv, b).toBe(0);
      expect(b0.sp, b).toContain(CATALOG[b][0]);
      const b1 = drawPicks(b, 0, 1, {}, ((q) => () => q.shift()!)([.1, .3, .99, .99]));
      expect(b1.mv, b).toBe(1);
      expect(b1.sp, b).toContain(CATALOG[b][0]);
      // met in Descent 1 (v 1), back in Descent 2: a remix, unweighted, and no B1 roll
      expect(drawPicks(b, 1, 1, {}, ((q) => () => q.shift()!)([.3, .99, .99]), { [b]: 1 }).sp, b).not.toContain(CATALOG[b][0]);
    }
  });

  it('gives every picker layout exactly SETS_PER_STAGE set fractions, the count runsave.ts accepts', async () => {
    // G3: stagePicks draws beats.sets.length pieces, and runsave.ts isStagePick refuses a saved pick of any other length
    const { LAYOUTS } = await import('../../src/layout');
    const pickers = Object.values(LAYOUTS).filter((L) => L!.beats.moveB);
    expect(pickers.length).toBeGreaterThan(0);
    for (const L of pickers) {
      expect(L!.beats.sets, L!.id).toHaveLength(SETS_PER_STAGE);
      expect(L!.beats.remixSets, L!.id).toHaveLength(SETS_PER_STAGE);
    }
  });

  it('has no set draw on short: short flies no movement B, so biomeStage never calls stagePicks', async () => {
    const { LAYOUTS } = await import('../../src/layout');
    expect(LAYOUTS.short!.beats.moveB).toBeUndefined();
    expect(LAYOUTS.long4!.beats.moveB).toBeDefined();
  });
});

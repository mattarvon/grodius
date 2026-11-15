// LS2-read item 3 (audio-director spec): the music intensity layer, the biome kill layer and the drone bed tables.
import { describe, expect, it, vi } from 'vitest';
import { musicIntensity, INTENSITY, DRIVE_CAP, shelfDb, driveFor, driveMakeup, clipGain, BIOME_KILL, KILL_LAYER, DRONE_BED, droneTarget, droneDetune, EQ, MUSIC_TONE, toneDrive, toneMakeup } from '../../src/audiomix';

// music.ts only for BIOME_MIX; its imports touch audio/save/layout, which this test does not need
vi.mock('../../src/audio', () => ({ AU: {} }));
vi.mock('../../src/save', () => ({ SET: {} }));
vi.mock('../../src/layout', () => ({ row: () => null, slotOf: () => 0 }));
const { BIOME_MIX } = await import('../../src/music');

const BIOMES = ['ice', 'acid', 'fire', 'snot'];
const LVLS = [0, 1, 2] as const;
const SFX = Object.keys(import.meta.glob('../../src/sfx/*/*')).map((p) => p.split('/')[4]);

describe('musicIntensity', () => {
  const G = (mini?: object, extra: object = {}) => ({ mini, ...extra });

  it('is calm with no G and outside play/pause', () => {
    expect(musicIntensity(null, 'ice', 'play')).toBe(0);
    for (const s of ['shop', 'title', 'over']) expect(musicIntensity(G({ k: 'crux' }), 'ice', s)).toBe(0);
  });
  it('is calm outside a biome stage (Orbit, the Drive) even with a live mini', () => {
    expect(musicIntensity(G({ k: 'maw', stageBoss: true }), null, 'play')).toBe(0);
  });
  it('is calm at the fork even with a live mini', () => {
    expect(musicIntensity(G({ mid: 1 }, { fork: {} }), 'ice', 'play')).toBe(0);
  });
  it('rises to 1 for a live midboss and falls when it dies or withdraws', () => {
    expect(musicIntensity(G(), 'acid', 'play')).toBe(0);
    expect(musicIntensity(G({ mid: 1 }), 'acid', 'play')).toBe(1);
    expect(musicIntensity(G({ mid: 1, dead: 1 }), 'acid', 'play')).toBe(0);
    expect(musicIntensity(G({ mid: 1, gone: 1 }), 'acid', 'play')).toBe(0);
  });
  it('reads a biome boss as 2 and the non-stage Maw as a midboss', () => {
    expect(musicIntensity(G({ k: 'crux' }), 'ice', 'play')).toBe(2);
    expect(musicIntensity(G({ k: 'butcher' }), 'fire', 'play')).toBe(2);
    expect(musicIntensity(G({ k: 'maw', stageBoss: true }), 'snot', 'play')).toBe(2);
    expect(musicIntensity(G({ k: 'maw' }), 'snot', 'play')).toBe(1);
  });
  it('lets the mid flag win over the boss kind and stageBoss, and reads an unknown non-mid kind as a boss', () => {
    expect(musicIntensity(G({ k: 'maw', stageBoss: true, mid: 1 }), 'snot', 'play')).toBe(1);
    expect(musicIntensity(G({ k: 'some-new-boss' }), 'acid', 'play')).toBe(2);
  });
  it('stays calm in pause when there is nothing to hold (no G, no biome, the fork, a dead mini)', () => {
    expect(musicIntensity(null, 'ice', 'pause')).toBe(0);
    expect(musicIntensity(G({ k: 'crux' }), null, 'pause')).toBe(0);
    expect(musicIntensity(G({ k: 'crux' }, { fork: {} }), 'ice', 'pause')).toBe(0);
    expect(musicIntensity(G({ k: 'crux', dead: 1 }), 'ice', 'pause')).toBe(0);
  });
  it('holds the boss level through pause and ignores the Drive-only bossStarted flag', () => {
    expect(musicIntensity(G({ k: 'crux' }), 'ice', 'pause')).toBe(2);
    expect(musicIntensity(G(undefined, { bossStarted: true }), 'ice', 'play')).toBe(0);
  });
});

describe('intensity tables', () => {
  it('rises monotonically from calm to boss', () => {
    for (const f of ['shelf', 'pres', 'driveAdd', 'gainDb', 'droneMul', 'droneGain'] as const) {
      expect(INTENSITY[0][f]).toBeLessThanOrEqual(INTENSITY[1][f]);
      expect(INTENSITY[1][f]).toBeLessThanOrEqual(INTENSITY[2][f]);
    }
  });
  it('is transparent at calm', () => {
    const c = INTENSITY[0];
    expect([c.shelf, c.pres, c.driveAdd, c.gainDb, c.droneMul]).toEqual([0, 0, 0, 0, 1]);
  });
  it('never drives any mix past the cap', () => {
    for (const [k, m] of Object.entries(BIOME_MIX)) for (const l of LVLS) expect(driveFor((m as any).drive, l), k).toBeLessThanOrEqual(DRIVE_CAP);
  });
  it('halves the shelf boost on a mix that is already a lowshelf (fire)', () => {
    for (const l of [1, 2] as const) expect(shelfDb(BIOME_MIX.fire, l)).toBeCloseTo(INTENSITY[l].shelf - BIOME_MIX.fire.gain / 2);
    expect(shelfDb(BIOME_MIX.acid, 2)).toBe(INTENSITY[2].shelf);
    expect(shelfDb(BIOME_MIX.fire, 0)).toBe(0);
  });
});

describe('biome kill layer', () => {
  it('has a row for every biome with a sane chance and volume', () => {
    for (const b of BIOMES) {
      const k = BIOME_KILL[b];
      expect(k, b).toBeTruthy();
      expect(k.chance).toBeGreaterThan(0);
      expect(k.chance).toBeLessThanOrEqual(1);
      expect(k.vol + KILL_LAYER.volCap).toBeLessThanOrEqual(1);
    }
  });
  it('plays only clip sets in the bank, unless the row has a synth fallback', () => {
    for (const [b, k] of Object.entries(BIOME_KILL)) if (!k.synth) expect(SFX, b).toContain(k.cat);
  });
  it('leaves voice headroom under the 14-voice cap', () => {
    expect(KILL_LAYER.maxVoices).toBeLessThan(14);
  });
});

describe('drone bed', () => {
  it('keeps the filter above the 70 Hz LFO swing for every biome and level', () => {
    for (const b of [null, ...BIOMES]) for (const l of LVLS) expect(droneTarget(b, l).f).toBeGreaterThan(70);
  });
  it('has a bed for every biome and leaves the none bed untouched at calm', () => {
    for (const b of BIOMES) expect(DRONE_BED[b], b).toBeTruthy();
    expect(droneTarget(null, 0)).toEqual({ ...DRONE_BED.none, gain: INTENSITY[0].droneGain });
    expect(droneDetune(null, 0)).toBe(0);
    expect(droneTarget('no-such-biome', 1)).toEqual(droneTarget(null, 1));
    expect(droneDetune('no-such-biome', 0)).toBe(0);
    expect(droneDetune('ice', 2)).toBeGreaterThan(droneDetune('ice', 1));
  });
});

describe('drive makeup', () => {
  it('treats a missing or zero drive as no curve (unit gain, unit makeup at calm)', () => {
    expect(clipGain(0)).toBe(1);
    expect(driveMakeup(undefined as unknown as number, 0)).toBe(1);
    expect(driveFor(undefined as unknown as number, 0)).toBe(0);
  });
  it('keeps the small-signal gain through the clip at the calm level for every mix and level', () => {
    for (const m of [0, .05, .2, .35, .5]) for (const l of LVLS) expect(clipGain(driveFor(m, l) || (l ? 0 : m)) * driveMakeup(m, l)).toBeCloseTo(clipGain(m), 6);
  });
  it('is unity at calm and never boosts (the curve caps peaks at ±1, so makeup <= 1 cannot clip)', () => {
    for (const m of [0, .1, .35]) { expect(driveMakeup(m, 0)).toBe(1); for (const l of LVLS) expect(driveMakeup(m, l)).toBeLessThanOrEqual(1); }
  });
});

describe('tone pass (D39 worklist A6): interim music colour', () => {
  it('puts the intensity presence peak in the 200 Hz-1 kHz menace band', () => {
    expect(EQ.presF).toBeGreaterThanOrEqual(200);
    expect(EQ.presF).toBeLessThanOrEqual(1000);
  });

  it('slows every BIOME_MIX row, none included, to the interim rate', () => {
    for (const [k, m] of Object.entries(BIOME_MIX)) expect((m as any).rate, k).toBe(MUSIC_TONE.rate);
    expect(MUSIC_TONE.rate).toBeLessThan(1);
  });

  it('adds grit to every mix and keeps every level under the drive cap', () => {
    for (const [k, m] of Object.entries(BIOME_MIX)) {
      expect(toneDrive((m as any).drive), k).toBeGreaterThan((m as any).drive || 0);
      for (const l of LVLS) expect(driveFor(toneDrive((m as any).drive), l), k).toBeLessThanOrEqual(DRIVE_CAP);
    }
  });

  it('cancels the added grit\'s small-signal boost at calm, so the pass darkens without getting louder', () => {
    for (const [k, m] of Object.entries(BIOME_MIX)) {
      const b = (m as any).drive || 0;
      expect(clipGain(toneDrive(b)) * toneMakeup(b) * driveMakeup(toneDrive(b), 0), k).toBeCloseTo(clipGain(b));
    }
  });
});

// Pure audio tables and rules (LS2-read item 3, audio-director spec): the music intensity layer (calm / midboss /
// biome boss), the per-biome kill layer and the per-biome drone bed. A leaf: no imports, so the unit tests need no
// mocks, and nothing here reads or writes $; music.ts and audio.ts pass the state in.
// None of this changes what music.ts wanted()/mixWanted()/musicPlan() return (tools/layout-parity.mjs reads those).

export type Lvl = 0 | 1 | 2;

/** 0 calm, 1 midboss up, 2 biome boss up. Biome stages only; Orbit (ufoMix/orbitBoss) and the Drive keep their own states.
 *  Keys on flags, not kinds, so a new midboss kind gets 1 for free. G.bossStarted is the Drive's alone and not read. */
export function musicIntensity(G: any, biome: string | null, state: string): Lvl {
  if (state !== 'play' && state !== 'pause') return 0;
  if (!G || !biome) return 0; // Open Orbit, the Drive, the Infirmary, the title
  if (G.fork) return 0; // the fork drone stays calm
  const m = G.mini;
  if (!m || m.dead || m.gone) return 0; // dead is cleared at step.ts, gone is the withdraw
  return m.mid || (m.k === 'maw' && !m.stageBoss) ? 1 : 2;
}

/** per level: EQ ahead of the soft clip (so a boost drives it harder; the normalised curve keeps the ceiling at +-1),
 *  added drive, post-clip gain, the drone bed's lowpass multiplier and gain, and the attack time constant. Calm is
 *  transparent (0 dB, no added drive), so a biome stage sounds as it did before until a midboss arrives. */
export const INTENSITY = [
  // calm: today's sound. tau is the release used whenever the level falls (~3 s exhale after a kill or withdraw)
  { shelf: 0, pres: 0, driveAdd: 0, gainDb: 0, droneMul: 1, droneGain: .12, tau: 1.0 },
  // midboss: more presence (an 800 Hz peak since the tone pass, carried by a phone speaker), grittier, a touch louder; the bed opens 160 -> ~270 Hz
  // tone pass (Matt 2026-11-07, "more evil, not cartoonish"): less presence (bright = bouncy), more low weight and a
  // louder, darker bed, so a boss arrival reads as pressure rather than excitement. Presence stays > 0 for the phone.
  { shelf: 3, pres: 2, driveAdd: .15, gainDb: .5, droneMul: 1.4, droneGain: .17, tau: .30 },
  // biome boss: a clear step above the midboss; the bed opens only to ~320 Hz and is louder: dread under the fight
  { shelf: 4.5, pres: 3, driveAdd: .30, gainDb: 1.0, droneMul: 2.0, droneGain: .22, tau: .25 },
] as const;
/** release time constant when the level falls */
export const RELEASE_TAU = 1.0;
/** the soft clip's drive ceiling: tanh gain 5 at .8, gritty but not square (fire+ at boss reaches it) */
export const DRIVE_CAP = .8;
/** the intensity shelf's corner and the presence peak (music.ts ensure()). presF 2200 -> 800 (tone pass D39, tone.md
 *  Audio): menace sits in 200 Hz-1 kHz, the band a phone speaker carries, so the boss lift pushes the snarl, not the sheen */
export const EQ = { shelfF: 140, presF: 800, presQ: .9 };

/** interim music colour (tone pass D39, worklist A6) until the music is re-scored: every track a little slower and
 *  lower (rate, BIOME_MIX rows; pitch follows), darker (a fixed lowpass on the whole music bus, after the intensity
 *  layer) and grittier (drive added to every mix's own drive before the intensity drive). makeup keeps calm loudness */
export const MUSIC_TONE = { rate: .94, lpF: 3000, lpQ: .5, drive: .12 };
/** a mix's own drive with the interim grit added */
export const toneDrive = (base: number) => (base || 0) + MUSIC_TONE.drive;
/** gain that undoes the interim grit's small-signal boost, so the tone pass darkens without getting louder */
export const toneMakeup = (base: number) => clipGain(base || 0) / clipGain(toneDrive(base));

/** shelf boost for a BIOME_MIX row at a level: a mix that is already a lowshelf (fire, +4) gets half its own gain
 *  taken off, so the low end does not turn to mud (fire: +0.5 at mid, +2 at boss) */
export function shelfDb(mix: any, lvl: Lvl): number {
  return Math.max(0, INTENSITY[lvl].shelf - (mix && mix.type === 'lowshelf' ? (mix.gain || 0) / 2 : 0));
}

/** small-signal gain of music.ts's normalised soft clip at drive d: tanh(a x)/tanh(a) has slope a/tanh(a) at 0,
 *  a = 1 + 5d. 1 with no curve. A drive with no base (ice) would otherwise jump ~+2.4 dB the moment the curve engages */
export function clipGain(d: number): number {
  if (!d) return 1;
  const a = 1 + d * 5;
  return a / Math.tanh(a);
}

/** makeup gain after the clip so quiet passages keep the calm loudness at any level: the level's own gainDb, EQ
 *  and grit carry the step, not the curve's normalisation (sound-designer review, ls2-read) */
export function driveMakeup(base: number, lvl: Lvl): number {
  return clipGain(base || 0) / clipGain(lvl ? driveFor(base, lvl) : base || 0);
}

/** effective soft-clip drive for a mix's own drive at a level. 0 means no curve (shaper.curve null, as before) */
export function driveFor(base: number, lvl: Lvl): number {
  return Math.min(DRIVE_CAP, (base || 0) + INTENSITY[lvl].driveAdd);
}

/** the kill layer per biome, played in sfx.gore() after the splat/thud/bone/silly/explode layers.
 *  vol = vol + min(KILL_LAYER.volCap, sz * sizeVol). A row with `synth` falls back to synth when its clips are not in the bank. */
export const BIOME_KILL: Record<string, { cat: string; chance: number; vol: number; sizeVol: number; rate: number; minSz: number; at: number; synth?: string }> = {
  // ice: brittle frozen-meat crack (the Bloated Bitch's own clips: the boss and the stage's fodder share one sound)
  // rate 1 (tone pass 2026-11-07): sped-up clips go chirpy; at pitch the crack is colder and heavier
  ice: { cat: 'gicecrack', chance: .5, vol: .45, sizeVol: .05, rate: 1, minSz: 0, at: .015 },
  // acid: a short fizz. The gfizz clips are a follow-up (tools/gen_bossgross_sfx.py); until they ship, the synth fizz plays
  acid: { cat: 'gfizz', chance: .55, vol: .5, sizeVol: .05, rate: 1, minSz: 0, at: .02, synth: 'fizz' },
  // fire: fat crackling on a hot floor (the Butcher's clips), sped up because the clips run to 1 s; big kills only
  // rate 1.5 -> 1.25 (tone pass 2026-11-07): still shortens the 1 s clips, without the cartoon pitch-up
  fire: { cat: 'gsizzle', chance: .4, vol: .35, sizeVol: .04, rate: 1.25, minSz: .9, at: .02 },
  // snot: unchanged from before (the Sinus: everything dies wet)
  snot: { cat: 'snot', chance: .6, vol: .55, sizeVol: .06, rate: 1, minSz: 0, at: .02 },
};
/** the kill layer is lowest priority: it skips above maxVoices (leaving the 15-voice cap 5 voices of headroom for the
 *  splats), is throttled to one per gapMs so long sizzles don't stack in a chain-kill, and its size bonus is capped */
export const KILL_LAYER = { maxVoices: 10, gapMs: 90, volCap: .3 };

/** the drone bed's lowpass per biome (none = the pre-LS2 160 Hz / Q 5). Filter only: the 41 Hz root is not retuned */
export const DRONE_BED: Record<string, { f: number; q: number }> = {
  none: { f: 160, q: 5 },
  ice: { f: 210, q: 9 }, // thin, whistling resonance
  acid: { f: 180, q: 7 }, // sour bite
  fire: { f: 130, q: 3 }, // dark rumble
  snot: { f: 110, q: 4 }, // muffled
};
/** drone bed target for a biome (null/unknown = none) at a level */
export function droneTarget(biome: string | null, lvl: Lvl): { f: number; q: number; gain: number } {
  const bed = (biome && DRONE_BED[biome]) || DRONE_BED.none;
  return { f: bed.f * INTENSITY[lvl].droneMul, q: bed.q, gain: INTENSITY[lvl].droneGain };
}
/** the drone target as a detune (cents) on AU.lp relative to the none bed: fx/update.ts owns AU.lp.frequency (hull,
 *  corruption, core), so the bed scales it through detune instead of fighting it */
export function droneDetune(biome: string | null, lvl: Lvl): number {
  return 1200 * Math.log2(droneTarget(biome, lvl).f / DRONE_BED.none.f);
}

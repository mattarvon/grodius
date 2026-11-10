// The voice slots: the one list of every recorded line the game has a place for (LS2-booth). The booth
// (tools/booth/booth.ts) shows it, the dev plugin (tools/booth/plugin.ts) writes only into these folders, and
// src/vox.ts fires the wired ones in the game. A leaf: no imports, so the plugin, the page and the unit tests all
// read it.
//
// The line text itself is read from the game where the game exports it (`text`): the booth's hidden text frame
// (tools/booth/text.ts) imports HYPE and CARN from src/fx/update.ts and each midboss's kill word from its
// defineMid() row. `copy` is the fallback for a line the game only has as a literal inside a function (TAKEN DOWN,
// the corpse's caption, LESLEY's clip name); tests/unit/booth.test.ts fails if a copy drifts from the source.

/** where the game holds the words for a slot */
export type TextSrc =
  | { hype: number } // src/fx/update.ts HYPE[n]: the two caption lines
  | { carn: number } // src/fx/update.ts CARN: the chain word at that chain
  | { mid: string }; // src/enemies/mid/<k>.ts defineMid(k, { word })

export interface Slot {
  /** the folder under src/sfx/: audio.ts loads src/sfx/<cat>/*.ogg into BANK[cat] */
  cat: string;
  /** file-name stem of a take, before -matty-<n>.ogg. A fixed slug matters where render/hype.ts VOICE maps a caller
   *  face by clip name (stop-killing-me, lesley-yeah-baby); otherwise the booth slugs the line text */
  slug?: string;
  text?: TextSrc;
  /** the words, when the game has no export for them; [source file, literal it must still contain] */
  copy?: { lines: string[]; from: string; lit: string };
  /** when the game plays it */
  when: string;
  /** who speaks it: the tag on the comms window. The booth shows the game's own voiceOf() face and tag beside it, and
   *  tests/unit/booth.test.ts checks the two agree */
  caller: string;
  /** the game plays this folder today. false: recorded, not wired (none since LS2-slab) */
  wired: boolean;
  /** query the booth's "test in game" button opens the game with (src/vox.ts fires the moment) */
  test?: string;
  /** longest the processed take should run, seconds: past it the booth warns (LS2 review: a kill word lands over the
   *  next fight, OPENED over the next chain) */
  maxLen?: number;
  /** a delivery note for this one line, on top of its caller's DIRECTION */
  note?: string;
}

/** how each caller reads (LS2 review: narrative-director, game-designer, audio-director) */
export const DIRECTION: Record<string, string> = {
  'SGT. RAMROD SLAB': 'Flat, low, unhurried: gallows deadpan from a tired controller. Not a hype yell; no exclamation marks.',
  'CREWMAN #5 // DECEASED': 'Not SLAB: a dead crewman, thinner and wetter, pleading and still polite to the end ("sir").',
  'LESLEY, MISSION CONTROL': 'Mission control at the launch: the one line that is not grim. Keep it apart from SLAB.',
};
/** per-kind length targets, seconds: the read to aim for (the booth shows it on the line) */
export const MAX_LEN = { hype: 2, bossreward: 2, kill: 1.2, carn5: .8 } as const;
/** how far past its target a processed take may run before the booth warns (LS2-booth2, audio-director): half a second
 *  over is still a usable line; past that a kill word lands over the next fight. A warning, never a refusal */
export const LEN_SLACK = 0.5;
/** the length (s, after the trim) past which the booth warns about a slot's take; null for a slot with no target */
export const lenLimit = (s: Pick<Slot, 'maxLen'>): number | null => (s.maxLen == null ? null : Math.round((s.maxLen + LEN_SLACK) * 100) / 100);
/** the booth's long-take warning for a processed take's length, or undefined */
export function lenWarn(s: Pick<Slot, 'maxLen'>, dur: number | null): string | undefined {
  const lim = lenLimit(s);
  if (lim == null || dur == null || !(dur > lim)) return undefined;
  return `long take (${dur.toFixed(2)} s, over ${lim} s; the target is ${s.maxLen} s): fewer or shorter pauses, not a faster read`;
}

// Matt, 2026-11-09: every new recorded line (hype, bossreward, the kill words, carn5) is SGT. RAMROD SLAB, his own face
// on the comms window (LS2-slab: render/hype.ts maps these folders to it; the booth shows the game's own mapping)
const SLAB = 'SGT. RAMROD SLAB';
const hype = (n: number): Slot => ({
  cat: 'hype' + n,
  text: { hype: n },
  when: `a ${n}-kill chain (fx/update.ts updateCombo, at most once per HYPE_CD)`,
  caller: SLAB,
  wired: true,
  test: `stage=orbit&vox=hype${n}`,
  maxLen: MAX_LEN.hype,
});
const kill = (k: string): Slot => ({
  cat: 'kill-' + k,
  text: { mid: k },
  when: `the ${k} midboss dies: its kill word, after the roar (enemies/update.ts killEnemy, KILL_WORD_AT)`,
  caller: SLAB,
  wired: true,
  test: `stage=orbit&vox=kill-${k}`,
  maxLen: MAX_LEN.kill,
  // the Saucer's word is Matt's one joke in the kill words (CALAMARI SERVED, LS2-tts)
  ...(k === 'ufo' ? { note: 'The one line read as a joke: a dry punchline, still in his deadpan.' } : {}),
});

export const SLOTS: Slot[] = [
  hype(10), hype(20), hype(35), hype(50), hype(75), hype(100),
  {
    cat: 'bossreward',
    copy: { lines: ['TAKEN DOWN'], from: 'src/enemies/update.ts', lit: "banner('TAKEN DOWN'" },
    when: 'a stage boss dies, after the death roar (stages.ts stage clear)',
    caller: SLAB,
    wired: true,
    test: 'stage=orbit&vox=bossreward',
    maxLen: MAX_LEN.bossreward,
  },
  {
    cat: 'corpsevoice',
    slug: 'stop-killing-me',
    copy: { lines: ['STOP KILLING ME', 'WITH YOUR SPACESHIP, SIR'], from: 'src/render/hype.ts', lit: "['STOP KILLING ME', 'WITH YOUR SPACESHIP, SIR']" },
    when: 'once a stage, on one of its first 5 crew corpse kills (enemies/corpsevoice.ts corpseKilled)',
    caller: 'CREWMAN #5 // DECEASED',
    wired: true,
    test: 'stage=orbit&vox=corpsevoice',
  },
  {
    cat: 'startgame',
    slug: 'lesley-yeah-baby',
    copy: { lines: ['YEAH BABY'], from: 'src/render/hype.ts', lit: "'lesley-yeah-baby'" },
    when: 'DESCEND on the title (menus.ts)',
    caller: 'LESLEY, MISSION CONTROL',
    wired: true,
    test: 'vox=startgame',
  },
  kill('ufo'), kill('brood'), kill('choir'), kill('cyst'), kill('prentice'),
  {
    cat: 'carn5',
    text: { carn: 5 },
    when: 'a 5-kill chain (fx/update.ts opened): skipped while another line talks, at most once per OPENED_GAP',
    caller: SLAB,
    wired: true,
    test: 'stage=orbit&vox=carn5',
    maxLen: MAX_LEN.carn5,
  },
];

/** the slot for a category, or undefined: the plugin's allowlist */
export const slotOf = (cat: string) => SLOTS.find((s) => s.cat === cat);

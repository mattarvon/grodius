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
  /** who speaks it: the face and tag on the comms window (render/hype.ts) */
  caller: string;
  /** the game plays this folder today. false: recorded, not wired (the parent wires it after LS2-tts) */
  wired: boolean;
  /** query the booth's "test in game" button opens the game with (src/vox.ts fires the moment) */
  test?: string;
}

// Matt, 2026-11-09: every new recorded line (hype, bossreward, the kill words, carn5) is SGT. RAMROD SLAB. The kill
// words and OPENED will play through the comms window like a hype line; that wiring is the parent's follow-up
const SLAB = 'SGT. RAMROD SLAB';
const hype = (n: number): Slot => ({
  cat: 'hype' + n,
  text: { hype: n },
  when: `a ${n}-kill chain (fx/update.ts updateCombo, at most once per HYPE_CD)`,
  caller: SLAB,
  wired: true,
  test: `stage=orbit&vox=hype${n}`,
});
const kill = (k: string): Slot => ({
  cat: 'kill-' + k,
  text: { mid: k },
  when: `the ${k} midboss dies (its kill word banner, enemies/update.ts killEnemy)`,
  caller: SLAB,
  wired: false,
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
  },
  {
    cat: 'corpsevoice',
    slug: 'stop-killing-me',
    copy: { lines: ['STOP KILLING ME', 'WITH YOUR SPACESHIP, SIR'], from: 'src/render/hype.ts', lit: "['STOP KILLING ME', 'WITH YOUR SPACESHIP, SIR']" },
    when: 'every 5th crew corpse you shoot (enemies/update.ts killEnemy)',
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
  { cat: 'carn5', text: { carn: 5 }, when: 'a 5-kill chain (the chain word, fx/update.ts CARN)', caller: SLAB, wired: false },
];

/** the slot for a category, or undefined: the plugin's allowlist */
export const slotOf = (cat: string) => SLOTS.find((s) => s.cat === cat);

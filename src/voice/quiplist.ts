// SGT. RAMROD SLAB's quips (LS2-quips): Matt's own cheesy one-liners, recorded in the voice booth and said over the comms
// after a big kill (a midboss after its kill word, a stage boss after TAKEN DOWN). The list is src/voice/quips.json,
// `[{ id, text }]`, which the booth edits (tools/booth/plugin.ts) and Matt may edit by hand.
//
// A pure leaf, no imports: the game (src/voice/quips.ts, audio.ts, render/hype.ts), the booth plugin and page, the
// reprocess CLI (Node type stripping) and the unit tests all read it.
//
// The id is the quip's folder and take name, and it never changes once made: editing the text keeps the id, so takes
// are never orphaned. A take recorded under older words is flagged stale by the booth (the words are saved with the
// take, tools/booth/plugin.ts TakeOpts), and the game captions it with the current text.

export interface Quip {
  /** stable slug: src/sfx/quip-<id>/<id>-matty-<n>.ogg */
  id: string;
  /** the caption, ALL CAPS; ' / ' splits it into the comms window's two lines */
  text: string;
  /** a delivery note the booth shows over SLAB's direction (optional; hand-edited in the JSON) */
  note?: string;
}
/** longest delivery note kept */
export const QUIP_NOTE_MAX = 200;

/** longest id: 'quip-' + 24 stays inside the booth's 32-character folder limit (tools/booth/names.ts okCat) */
export const QUIP_ID_MAX = 24;
/** a quip id: lower-case [a-z0-9] runs joined by single dashes */
export const QUIP_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** the comms window holds two caption lines (render/hype.ts draws them right-aligned, scaled down past 118 px) */
export const QUIP_LINES = 2;
/** characters per caption line: past ~20 the 11 px display font scales down to unreadable on a phone */
export const QUIP_LINE_MAX = 20;
/** what a caption may hold: the display font's glyphs that read on the comms window. No '!' (SLAB never yells) and
 *  nothing that could be markup */
export const QUIP_TEXT_RE = /^[A-Z0-9 .,'?\-/]+$/;
/** folder prefix of a quip under src/sfx/ */
export const QUIP_PRE = 'quip-';

/** the folder (audio category) a quip records into */
export const quipCat = (id: string) => QUIP_PRE + id;
/** the quip id of a category, or null */
export const quipIdOf = (cat: string): string | null => (cat.startsWith(QUIP_PRE) ? cat.slice(QUIP_PRE.length) : null);

/** a caption as typed -> its stored form: upper case, runs of spaces collapsed, ' / ' as the line split */
export function normText(s: unknown): string {
  return String(s ?? '')
    .toUpperCase()
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** the caption lines of a stored text */
export const quipLines = (text: string): string[] => text.split(' / ').map((l) => l.trim()).filter(Boolean);

/** why a (normalised) caption is unusable, or null */
export function textError(text: string): string | null {
  if (!text) return 'empty';
  if (!QUIP_TEXT_RE.test(text)) return "letters, digits, spaces and . , ' ? - only (and / between the two lines)";
  const L = quipLines(text);
  if (!L.length) return 'empty';
  if (L.length > QUIP_LINES || text.split('/').length > QUIP_LINES) return `at most ${QUIP_LINES} lines (one /)`;
  // a '/' splits two lines: one with nothing on a side would be drawn as a stray slash (qa-tester)
  if (text.split('/').some((part) => !part.trim())) return 'a / goes between two lines of words';
  if (L.some((l) => l.length > QUIP_LINE_MAX)) return `at most ${QUIP_LINE_MAX} characters a line: split it with /`;
  return null;
}

/** a new quip's id from its words: slug of the text, cut to QUIP_ID_MAX, made unique against `taken` (ids in the list
 *  and folders left on disk, so a deleted quip's leftover raw takes are never filed under different words) */
export function newId(text: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, QUIP_ID_MAX).replace(/-+$/, '') || 'quip';
  if (!used.has(base)) return base;
  // the base is cut to leave room for the suffix it gets, so even the 100th clash fits QUIP_ID_MAX (security review)
  for (let n = 2; ; n++) {
    const sfx = `-${n}`, id = base.slice(0, QUIP_ID_MAX - sfx.length).replace(/-+$/, '') + sfx;
    if (!used.has(id)) return id;
  }
}

/** the list as read from quips.json: the valid quips (normalised; a duplicate id keeps the first) and what was wrong
 *  with the rest. Never throws: a hand edit gone wrong costs those rows, not the game's boot */
export function parseQuips(raw: unknown): { quips: Quip[]; errors: string[] } {
  const quips: Quip[] = [], errors: string[] = [], seen = new Set<string>();
  if (!Array.isArray(raw)) return { quips, errors: ['quips.json is not a list'] };
  raw.forEach((r, i) => {
    const id = (r as Quip)?.id, text = normText((r as Quip)?.text);
    if (typeof id !== 'string' || id.length > QUIP_ID_MAX || !QUIP_ID_RE.test(id)) return void errors.push(`row ${i + 1}: bad id ${JSON.stringify(id)}`);
    if (seen.has(id)) return void errors.push(`row ${i + 1}: duplicate id ${id}`);
    const bad = textError(text);
    if (bad) return void errors.push(`row ${i + 1} (${id}): ${bad}`);
    const note = (r as Quip).note;
    // a bad note is reported, never cut or dropped in silence: a booth write would lose the hand edit (tools-programmer)
    if (note != null && (typeof note !== 'string' || note.length > QUIP_NOTE_MAX)) return void errors.push(`row ${i + 1} (${id}): note must be text of at most ${QUIP_NOTE_MAX} characters`);
    seen.add(id);
    quips.push(typeof note === 'string' && note.trim() ? { id, text, note: note.trim() } : { id, text });
  });
  return { quips, errors };
}

/** when a quip follows a big kill (LS2-quips; audio-director ruling on the frequency and the queue) */
export const QUIP = {
  /** chance a quip follows a big kill, by moment (game-designer, LS2-quips review). Matt chose "on big moments" only.
   *  A long4 run of four stages meets ~8 midbosses and ~4 stage bosses: 8 x .3 + 4 x .5 = 4.4 quips a run, one every
   *  third big kill, a treat rather than a habit, weighted to the bigger kill. The shuffle bag (pickQuip) plays all
   *  nine before any repeats, about two runs. Raise them once more lines are recorded */
  chance: {
    /** after a midboss's kill word: the common big kill, and the next fight is close */
    mid: 0.3,
    /** after a stage boss's readout: the rarest kill, over the tally card with no fight to talk over */
    boss: 0.5,
  },
  /** latest a quip may start, seconds after the death that earned it (audio-director; game-designer: counted from the
   *  death, not from the call). Later than that it is flavour nobody asked for, and it is skipped */
  maxLate: {
    /** KILL_WORD_AT .45 + a 1.2 s kill word + VOICE_GAP .25 = 1.9 s in the clean case; 2.5 still lets a kill word run
     *  to its booth warning (1.7 s). Past it the quip lands in the next fight */
    mid: 2.5,
    /** the stage-boss call comes BOSS_REWARD_WAIT (50 frames, .83 s) after the death, behind bossreward: .83 + a
     *  bossreward take up to its booth warning (2.5 s) + VOICE_GAP .25 = 3.6 s, so a long TAKEN DOWN take can never
     *  silently skip every stage-boss quip. It plays over the tally card */
    boss: 3.6,
  },
} as const;
/** which big kill a quip follows: QUIP's chance and lateness are per moment */
export type QuipMoment = keyof typeof QUIP.chance;

/** the quip shuffle bag: ids still to play this round, and the one said last. Module state in audio.ts that a new
 *  game keeps, so the nine lines go round across runs */
export type QuipBag = { q: string[]; last: string | null };

/** the quip to play after a big kill, or null. `ready`: the recorded ids; `avoid`: ids that must not follow this kill
 *  (one whose words are the kill word just said: CALAMARI SERVED after the Saucer). Nothing left: null, with no draw
 *  at all. Else one `rnd()` roll against `chance`; on a hit the next id from the shuffle bag `bag`: every recorded
 *  quip plays once before any repeats, a new bag never opens with the last one said, and an avoided id stays in the
 *  bag for the next kill. The bag drops ids no longer recorded and refills (a Fisher-Yates shuffle, `rnd()` draws)
 *  when nothing in it may play. `rnd` is the audio RNG (audio.ts ar()), never the sim's */
export function pickQuip(ready: readonly string[], bag: QuipBag, rnd: () => number, chance: number = QUIP.chance.mid, avoid: readonly string[] = []): string | null {
  const ok = ready.filter((id) => !avoid.includes(id));
  if (!ok.length) return null;
  if (!(rnd() < chance)) return null;
  bag.q = bag.q.filter((id) => ready.includes(id));
  if (!bag.q.some((id) => ok.includes(id))) {
    const q = [...ready];
    for (let k = q.length - 1; k > 0; k--) { const j = Math.min(k, Math.floor(rnd() * (k + 1))); [q[k], q[j]] = [q[j], q[k]]; }
    bag.q = q;
  }
  // the next one out (the bag's end) that may play now, and not the last one said while another may
  const may = (id: string) => ok.includes(id);
  let k = -1;
  for (let i = bag.q.length - 1; i >= 0; i--) if (may(bag.q[i]) && bag.q[i] !== bag.last) { k = i; break; }
  if (k < 0) {
    // only the last one said may play: from the bag if it is there, else it is the one recorded quip left
    k = bag.q.findIndex(may);
    if (k < 0) return (bag.last = ok[0]);
  }
  const id = bag.q.splice(k, 1)[0];
  return (bag.last = id);
}

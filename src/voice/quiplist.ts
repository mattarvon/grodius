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
  if (L.some((l) => l.length > QUIP_LINE_MAX)) return `at most ${QUIP_LINE_MAX} characters a line: split it with /`;
  return null;
}

/** a new quip's id from its words: slug of the text, cut to QUIP_ID_MAX, made unique against `taken` (ids in the list
 *  and folders left on disk, so a deleted quip's leftover raw takes are never filed under different words) */
export function newId(text: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, QUIP_ID_MAX - 3).replace(/-+$/, '') || 'quip';
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
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
    seen.add(id);
    const note = (r as Quip).note;
    quips.push(typeof note === 'string' && note.trim() ? { id, text, note: note.trim().slice(0, QUIP_NOTE_MAX) } : { id, text });
  });
  return { quips, errors };
}

/** when a quip follows a big kill (LS2-quips; audio-director on the frequency) */
export const QUIP = {
  /** chance a quip follows a midboss kill word or TAKEN DOWN. Matt chose "on big moments" only; at ~35% a run of four
   *  stages with two midbosses and a boss each (12 big kills) hears about four, so a line still lands as a treat and
   *  nine lines take a few runs to repeat. Raise it once more lines are recorded */
  chance: 0.35,
} as const;

/** the quip to play after a big kill, or null. `ready`: the recorded ids; `avoid`: ids that must not follow this kill
 *  (one whose words are the kill word just said: CALAMARI SERVED after the Saucer). Nothing left: null, with no draw
 *  at all. Else one `rnd()` roll against `chance` and, on a hit, one `rnd()` pick, never `last` while another is
 *  left. `rnd` is the audio RNG (audio.ts ar()), never the sim's */
export function pickQuip(ready: readonly string[], last: string | null, rnd: () => number, chance: number = QUIP.chance, avoid: readonly string[] = []): string | null {
  const ok = ready.filter((id) => !avoid.includes(id));
  if (!ok.length) return null;
  if (!(rnd() < chance)) return null;
  const pool = ok.length > 1 ? ok.filter((id) => id !== last) : ok;
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
}

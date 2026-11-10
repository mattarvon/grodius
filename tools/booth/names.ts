// Pure name rules for the voice booth (LS2-booth): the slug a take is filed under, the folder check, and the next
// free take number. The dev plugin (tools/booth/plugin.ts) builds every path it writes from these, so the unit tests
// (tests/unit/booth.test.ts) pin the only ways a request can name a file.

/** longest slug kept: hype captions are two short lines; a longer name is noise in a file listing */
export const SLUG_MAX = 48;
/** a category folder name the booth will write into (also checked against the slot list) */
export const CAT_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** highest take number: the plugin refuses a keep past it, so every name it hands out matches TAKE_RE */
export const TAKE_MAX = 9999;
/** a processed take's file name: <slug>-matty-<n>.ogg */
export const TAKE_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*)-matty-([1-9]\d{0,3})\.ogg$/;

/** words to a file-name slug: lower case, [a-z0-9] runs joined by single dashes, at most SLUG_MAX characters, no
 *  leading or trailing dash. Anything else (dots, slashes, quotes, accents) is dropped, so no slug can name a path */
export function slugify(s: unknown): string {
  const out = String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
  return out;
}

/** a category is writable only if it is a plain folder name (no dots, slashes or case tricks) */
export const okCat = (cat: unknown): cat is string => typeof cat === 'string' && cat.length <= 32 && CAT_RE.test(cat);

/** the next free take number for a slug, over every file name already used (processed takes in src/sfx/<cat>/ and
 *  raw takes in assets-raw/voice/<cat>/, so a deleted take's number is never reused for a different raw file).
 *  Matches <slug>-matty-<n>.<any ext>; other files are ignored */
export function nextTake(names: string[], slug: string): number {
  let max = 0;
  const pre = slug + '-matty-';
  for (const f of names) {
    if (!f.startsWith(pre)) continue;
    const m = /^([1-9]\d{0,3})\.[a-z0-9]+$/.exec(f.slice(pre.length));
    if (m) max = Math.max(max, +m[1]);
  }
  return max + 1;
}

/** the processed file name for take n */
export const takeName = (slug: string, n: number) => `${slug}-matty-${n}.ogg`;

/** the raw take's extension from the browser's MediaRecorder type; null for anything that isn't recorded audio */
export function rawExt(type: unknown): string | null {
  const t = String(type ?? '').toLowerCase().split(';')[0].trim();
  return ({ 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a' } as Record<string, string>)[t] ?? null;
}

/** the gain (dB) that takes a measured integrated loudness to the target; null when the take is silent or too short
 *  for ebur128 to gate (it reports -70 LUFS or nothing) */
export function gainTo(target: number, measured: number | null): number | null {
  if (measured == null || !Number.isFinite(measured) || measured <= -60) return null;
  return Math.round((target - measured) * 100) / 100;
}

/** the stretches (s) to cut from a take so each pause longer than `over` keeps `keep` s: `after` of it after the last
 *  word (its tail), the rest before the next. Pauses come as silencedetect's starts and ends, in order. A pause that
 *  runs into the end of the file (no end, or an end within 10 ms of `len`; ffmpeg 9 reports one at EOF) is the tail
 *  trim's business and is left alone, as is anything unpaired or not a number */
export function squeezeCuts(starts: number[], ends: number[], o: { over: number; keep: number; after: number }, len = Infinity): [number, number][] {
  const cuts: [number, number][] = [];
  for (let i = 0; i < Math.min(starts.length, ends.length); i++) {
    const a = Math.max(0, starts[i]), b = ends[i];
    if (!(b - a > o.over) || !(b < len - 0.01)) continue;
    const from = a + o.after, to = b - (o.keep - o.after);
    if (to > from) cuts.push([from, to]);
  }
  return cuts;
}

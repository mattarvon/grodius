// The game's quip list (LS2-quips): src/voice/quips.json, read through parseQuips (src/voice/quiplist.ts), so a bad
// hand edit drops its rows instead of the boot. The booth rewrites the JSON on the dev server; Vite then reloads the
// game tab with the new words. A leaf besides the JSON: render/hype.ts and audio.ts both import it.
import RAW from './quips.json';
import { parseQuips, quipIdOf, quipLines, type Quip } from './quiplist';

export const QUIPS: readonly Quip[] = parseQuips(RAW).quips;
const BY_ID = new Map(QUIPS.map((q) => [q.id, q]));

/** the caption lines for a quip's audio category (quip-<id>), or null when the list has no such quip */
export function quipCaption(cat: string): string[] | null {
  const id = quipIdOf(cat), q = id == null ? null : BY_ID.get(id);
  return q ? quipLines(q.text) : null;
}

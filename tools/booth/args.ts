// The reprocess CLI's argument rules (LS2-booth2), pure so tests/unit/booth.test.ts pins every refusal:
// tools/booth/reprocess.mjs only prints what this returns. A leaf beside slots.ts.
import { SLOTS, voiceSlot } from './slots.ts';
import { quipCat, type Quip } from '../../src/voice/quiplist.ts';

export const USAGE = 'usage: node tools/booth/reprocess.mjs <folder>... | --all [--no-squeeze] [--root <repo>]';
export type Args = { root: string; cats: string[]; squeeze: boolean } | { error: string };

/** argv (after the script) -> what to reprocess, or why not. `def` is the repo the script sits in; `isRepo` says
 *  whether a root has src/sfx. A bare --root (or one followed by a flag) is an error, never "the current folder":
 *  it would rewrite that folder's takes. Every folder must be a voice slot, or a quip in that root's list (`quipsAt`,
 *  src/voice/quips.json; --all takes them too) */
export function parseArgs(argv: string[], def: string, isRepo: (root: string) => boolean, quipsAt: (root: string) => readonly Quip[] = () => []): Args {
  const a = [...argv];
  const flag = (f: string) => { const i = a.indexOf(f); if (i < 0) return false; a.splice(i, 1); return true; };
  const ri = a.indexOf('--root');
  const rootArg = ri >= 0 ? a.splice(ri, 2)[1] : undefined;
  if (ri >= 0 && (!rootArg || rootArg.startsWith('-'))) return { error: USAGE };
  const root = rootArg ?? def;
  const squeeze = !flag('--no-squeeze');
  const all = flag('--all');
  if (!all && (!a.length || a.some((c) => c.startsWith('-')))) return { error: USAGE };
  if (all && a.length) return { error: USAGE };
  if (!isRepo(root)) return { error: `not a Grodius repo (no src/sfx): ${root}` };
  const quips = quipsAt(root);
  const cats = all ? [...SLOTS.map((s) => s.cat), ...quips.map((q) => quipCat(q.id))] : a;
  const bad = cats.find((c) => !voiceSlot(c, quips));
  if (bad != null) return { error: `${JSON.stringify(bad)} is not a voice slot (tools/booth/slots.ts) or a quip (src/voice/quips.json)` };
  return { root, cats: [...new Set(cats)], squeeze };
}

// The --layout flag every probe and rig takes (D19 build plan LS1 row J). Importing this module takes
// `--layout <id>` (default `short`) out of process.argv, so a tool's positional arguments parse as before, and checks
// the id against src/layout.ts LAYOUTS in Node (type stripping) before any browser starts: an unknown id exits 2
// with "unknown layout <id>", never a silent run on `short`. `LY` is that module in Node with the layout active,
// for world x a tool computes outside the page.
//
// In the page, useLayout(p, tool) calls setLayout(id) through the live /src/layout.ts module (a Vite DEV server) and
// leaves the module on window.__LY for a tool's synchronous in-page code. It must run on the title screen, after
// window.__started and BEFORE the tool's first newGame() or Enter (setLayout's contract), and it refuses otherwise.
// It prints the layout the tool runs on, and the tool's own "not measured" note when that layout isn't `short`.
// ranOn(tool) prints the closing "ran on <id>" line.
//
// Usage (in a tool):  import { useLayout, ranOn } from './layout-arg.mjs';
//                     await p.goto(url); await p.waitForFunction(() => window.__started);
//                     await useLayout(p, 'boss-probe', { limits: 'what this tool does not measure on a long layout' });
import * as NODE_LY from '../src/layout.ts';

const { LAYOUTS } = NODE_LY;

const i = process.argv.indexOf('--layout');
/** the layout id the tool was asked to run on */
export const LAYOUT = i >= 0 ? process.argv[i + 1] : 'short';
if (i >= 0) {
  if (!LAYOUT || LAYOUT.startsWith('--')) { console.error('--layout needs an id, e.g. --layout short'); process.exit(2); }
  process.argv.splice(i, 2);
}
if (!LAYOUTS[LAYOUT]) {
  console.error(`unknown layout ${LAYOUT} (src/layout.ts has: ${Object.keys(LAYOUTS).join(', ')})`);
  process.exit(2);
}
NODE_LY.setLayout(LAYOUT);
/** src/layout.ts in Node with LAYOUT active: its accessors for a tool's own (Node-side) world x */
export const LY = NODE_LY;

const told = new Set();
/** activate LAYOUT in page p (title screen, before newGame) and print it (once per tool); exits 2 if the page can't take it */
export async function useLayout(p, tool, { limits, quiet } = {}) {
  const r = await p.evaluate(async (id) => {
    try {
      const L = await import('/src/layout.ts');
      const g = window.__G && window.__G();
      if (g && g.state !== 'title') return { err: `setLayout must run before newGame() (state is ${g.state})` };
      L.setLayout(id);
      window.__LY = L; // for a tool's synchronous in-page code (slotOf, row, lastStage ...)
      return { id: L.layout().id, kinds: L.layout().stages.map((r) => r.kind) };
    } catch (e) { return { err: String((e && e.message) || e) }; }
  }, LAYOUT);
  if (r.err) { console.error(`${tool}: ${r.err} (--layout ${LAYOUT})`); process.exit(2); }
  if (quiet || told.has(tool)) return r; // printed once per tool (some open a page per case); quiet: stdout is data
  told.add(tool);
  console.log(`${tool}: layout ${r.id} (${r.kinds.join(', ')})`);
  if (limits && r.id !== 'short') console.log(`${tool}: NOT MEASURED on ${r.id}: ${limits}`);
  return r;
}

/** the closing line: which layout the tool ran on */
export const ranOn = (tool) => console.log(`${tool}: ran on ${LAYOUT}`);

// The --layout flag every probe and rig takes (D19 build plan LS1 row J). Importing this module takes
// `--layout <id>` (default `long4`, the shipping layout: D33 matching D24; `--layout short` still runs the short one)
// out of process.argv, so a tool's positional arguments parse as before, and checks the id against src/layout.ts
// LAYOUTS in Node (type stripping) before any browser starts: an unknown id exits 2 with "unknown layout <id>", never
// a silent run on the default. `LY` is that module in Node with the layout active,
// for world x a tool computes outside the page.
//
// In the page, useLayout(p, tool) calls setLayout(id) through the live /src/layout.ts module (a Vite DEV server) and
// leaves the module on window.__LY for a tool's synchronous in-page code. It must run on the title screen, after
// window.__started and BEFORE the tool's first newGame() or Enter (setLayout's contract), and it refuses otherwise.
// It prints the layout the tool runs on, and the tool's own "not measured" note when that layout isn't `short`.
// ranOn(tool) prints the closing "ran on <id>" line.
// It also refuses (exit 2) a page whose game modules carry Vite HMR timestamps (/src/x.ts?t=...): a dev server that has
// seen an edit since it started serves the game a stamped copy while the probe's own import('/src/x.ts') gets a
// second, empty instance, and every number would read nothing. Use tools/with-vite.mjs (a fresh server per run), or
// restart the server. PROBE_ALLOW_HMR=1 skips the check.
//
// Usage (in a tool):  import { useLayout, ranOn } from './layout-arg.mjs';
//                     await p.goto(url); await p.waitForFunction(() => window.__started);
//                     await useLayout(p, 'boss-probe', { limits: 'what this tool does not measure on a long layout' });
import * as NODE_LY from '../src/layout.ts';

const { LAYOUTS } = NODE_LY;

/** the layout a bare run measures: src/lab.ts DEFAULT_LAYOUT (D24), restated because lab.ts's extensionless import
 *  does not load in Node; D33 (Matt) moved the probes off `short` to match it */
export const DEFAULT = 'long4';
const i = process.argv.indexOf('--layout');
/** the layout id the tool was asked to run on */
export const LAYOUT = i >= 0 ? process.argv[i + 1] : DEFAULT;
if (i >= 0) {
  if (!LAYOUT || LAYOUT.startsWith('--')) { console.error('--layout needs an id, e.g. --layout short or --layout long4'); process.exit(2); }
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
      // HMR split: the probe's own import of world.ts must be the game's instance (__G() hands out the game's arrays);
      // the ?t= resource scan backs it up (the resource buffer can drop entries, so it is the second signal, not the first)
      const Wp = await import('/src/world.ts'), split = !!(g && g.enemies && g.enemies !== Wp.enemies);
      const stamped = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /\/src\/[^?]*\.ts\?(.*&)?t=\d/.test(n));
      const hmr = split || stamped.length ? `the dev server has hot-reloaded since it started (${split ? "the probe's world.ts is not the game's instance" : ''}${split && stamped.length ? '; ' : ''}${stamped.length ? `${stamped.length} game modules carry ?t=, e.g. ${stamped[0].replace(/^.*\/src\//, 'src/')}` : ''}): a probe would read a second, empty copy. Run it through tools/with-vite.mjs or restart the server` : '';
      L.setLayout(id);
      window.__LY = L; // for a tool's synchronous in-page code (slotOf, row, lastStage ...)
      return { id: L.layout().id, kinds: L.layout().stages.map((r) => r.kind), hmr };
    } catch (e) { return { err: String((e && e.message) || e) }; }
  }, LAYOUT);
  if (r.err) { console.error(`${tool}: ${r.err} (--layout ${LAYOUT})`); process.exit(2); }
  if (r.hmr) { if (process.env.PROBE_ALLOW_HMR !== '1') { console.error(`${tool}: ${r.hmr} (--layout ${LAYOUT})`); process.exit(2); } console.error(`${tool}: WARNING (PROBE_ALLOW_HMR=1): ${r.hmr}`); }
  if (quiet || told.has(tool)) return r; // printed once per tool (some open a page per case); quiet: stdout is data
  told.add(tool);
  console.log(`${tool}: layout ${r.id} (${r.kinds.join(', ')})`);
  if (limits && r.id !== 'short') console.log(`${tool}: NOT MEASURED on ${r.id}: ${limits}`);
  return r;
}

/** the closing line: which layout the tool ran on */
export const ranOn = (tool) => console.log(`${tool}: ran on ${LAYOUT}`);

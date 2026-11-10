// Re-runs the voice booth's current processing chain (tools/booth/plugin.ts VOX) on the kept raw takes in
// assets-raw/voice/<folder>/ and rewrites the matching src/sfx/<folder>/<slug>-matty-<n>.ogg in place (LS2-booth2), so a
// take recorded under an older chain is redone without re-recording. A raw take that clipped is skipped (its processed
// take stays as it was), and so is one whose processed take was deleted (never brought back).
//
// Usage: node tools/booth/reprocess.mjs <folder>... | --all [--no-squeeze] [--root <repo>]
//   <folder>      a voice slot folder (hype10, bossreward, kill-ufo, ...): tools/booth/slots.ts
//   --all         every slot
//   --no-squeeze  for a take kept before LS2-booth2 (no .json record beside its raw): keep the mid-take pauses as
//                 recorded (default: pauses over 0.4 s shortened to 0.25 s). A newer take repeats its own setting
//   --root        the repo to work in (default: the one this file is in)
// Output: one line per take on stdout; writes only src/sfx/<folder>/ (and a temp file beside each raw take).
// Needs ffmpeg and ffprobe on PATH, and a Node that strips TypeScript (22.18+ or 23.6+). Don't run it while a
// harness, parity or probe run is using the dev server: a rewritten take re-stamps the sfx modules.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reprocess } from './plugin.ts';
import { SLOTS } from './slots.ts';

const args = process.argv.slice(2);
const flag = (f) => { const i = args.indexOf(f); if (i < 0) return false; args.splice(i, 1); return true; };
const usage = () => { console.error('usage: node tools/booth/reprocess.mjs <folder>... | --all [--no-squeeze] [--root <repo>]'); process.exit(2); };
const ri = args.indexOf('--root');
// a bare --root (or one followed by a flag) is a mistake, never "the current folder": it would rewrite that repo's takes
const rootArg = ri >= 0 ? args.splice(ri, 2)[1] : null;
if (ri >= 0 && (!rootArg || rootArg.startsWith('-'))) usage();
const root = path.resolve(rootArg ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
if (!fs.existsSync(path.join(root, 'src', 'sfx'))) { console.error(`not a Grodius repo (no src/sfx): ${root}`); process.exit(2); }
const squeeze = !flag('--no-squeeze');
const cats = flag('--all') ? SLOTS.map((s) => s.cat) : args;
if (!cats.length || cats.some((c) => c.startsWith('-'))) usage();
let done = 0, skipped = 0;
try {
  await reprocess(root, cats, {
    squeeze,
    log: (r) => {
      if (r.done) done++; else skipped++;
      console.log(r.done
        ? `redone  ${r.cat}/${r.name}: ${r.lufs} LUFS, ${r.dur} s${r.long ? ' (' + r.long + ')' : ''}${r.warn ? ' (' + r.warn + ')' : ''}`
        : `skipped ${r.cat}/${r.name}: ${r.why}`);
    },
  });
} catch (e) {
  console.error(String(e?.message ?? e));
  process.exit(1);
}
console.log(`${done} redone, ${skipped} skipped${squeeze ? '' : ' (pauses kept as recorded)'}; root ${root}`);

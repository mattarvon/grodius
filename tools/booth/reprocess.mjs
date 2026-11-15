// Re-runs the voice booth's current processing chain (tools/booth/plugin.ts VOX) on the kept raw takes in
// assets-raw/voice/<folder>/ and rewrites the matching src/sfx/<folder>/<slug>-matty-<n>.ogg in place (LS2-booth2), so a
// take recorded under an older chain is redone without re-recording. A raw take that clipped is skipped (its processed
// take stays as it was), and so is one whose processed take was deleted (never brought back).
//
// Usage: node tools/booth/reprocess.mjs <folder>... | --all [--no-squeeze] [--yes] [--root <repo>]
//   <folder>      a voice slot folder (hype10, bossreward, kill-ufo, ...): tools/booth/slots.ts, or a quip's
//                 (quip-<id>, src/voice/quips.json)
//   --all         every slot and every quip
//   --no-squeeze  for a take kept before LS2-booth2 (no .json record beside its raw): keep the mid-take pauses as
//                 recorded (default: pauses over 0.4 s shortened to 0.25 s). A newer take repeats its own setting
//   --yes         also rewrite takes kept before fx-dsp that would change (a racked take with no chain stamp in its
//                 .json: its rack now renders close to, not the same as, what ships). Without it such a run prints
//                 each one and stops before touching any take (exit 3). With it, listen to each before a commit
//   --root        the repo to work in (default: the one this file is in)
// Output: one line per take on stdout; writes only src/sfx/<folder>/ (and a temp file beside each raw take).
// Needs ffmpeg and ffprobe on PATH, and a Node that strips TypeScript (22.18+ or 23.6+). Don't run it while a
// harness, parity or probe run is using the dev server: a rewritten take re-stamps the sfx modules.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LegacyTakes, readQuips, reprocess } from './plugin.ts';
import { parseArgs } from './args.ts';

const here = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const parsed = parseArgs(process.argv.slice(2), here, (r) => fs.existsSync(path.join(path.resolve(r), 'src', 'sfx')), (r) => readQuips(path.resolve(r)).quips);
if ('error' in parsed) { console.error(parsed.error); process.exit(2); }
const { cats, squeeze, yes } = parsed, root = path.resolve(parsed.root);
let done = 0, skipped = 0;
const listen = [];
try {
  await reprocess(root, cats, {
    squeeze,
    confirm: yes,
    log: (r) => {
      if (r.done) done++; else skipped++;
      if (r.legacy) listen.push(`${r.cat}/${r.name}`);
      console.log(r.done
        ? `redone  ${r.cat}/${r.name}: ${r.lufs} LUFS, ${r.dur} s${r.long ? ' (' + r.long + ')' : ''}${r.warn ? ' (' + r.warn + ')' : ''}${r.legacy ? ' (WARNING: ' + r.legacy + ': listen first)' : ''}`
        : `skipped ${r.cat}/${r.name}: ${r.why}`);
    },
  });
} catch (e) {
  if (e instanceof LegacyTakes) {
    console.error(`WARNING: this will change ${e.takes.length === 1 ? 'a shipped take' : e.takes.length + ' shipped takes'}: listen first. Nothing was touched.`);
    for (const t of e.takes) console.error(`  ${t.cat}/${t.name}: ${t.why}`);
    console.error('Re-run with --yes to rewrite them anyway (then listen to each before a commit; git checkout restores a shipped take).');
    process.exit(3);
  }
  console.error(String(e?.message ?? e));
  process.exit(1);
}
console.log(`${done} redone, ${skipped} skipped${squeeze ? '' : ' (pauses kept as recorded)'}; root ${root}`);
if (listen.length) console.log(`WARNING: ${listen.length} shipped take${listen.length === 1 ? '' : 's'} changed (kept before fx-dsp): listen first: ${listen.join(', ')}`);

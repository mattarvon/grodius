// Biomass replay check (ls1-audit, from ls2-read's report): the real SURFACE + RE-ENTER path must not bank the same pay
// twice. Each cycle, from the same checkpoint: collect one kill pod through updateFX, clear the stage through
// clearStage (the largest pay), SURFACE, RE-ENTER. The first cycle banks; later ones must add 0 to meta.bio while G.bio
// still reaches the same total. Cycle 3 follows a page reload, so the mark must survive the save. Exits 1 otherwise.
// Not measured: SURPLUS and the boost (same bankBio call, unit-tested); a whole boss fight (the pay is the same call).
// Usage: node tools/bio-replay-check.mjs <url>   (a running Vite dev server of the tree to test)
import { chromium } from 'playwright';

const url = process.argv[2];
const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.addInitScript(() => { window.requestAnimationFrame = () => 1; window.speechSynthesis = undefined; try { if (!sessionStorage.getItem('bioRig')) { localStorage.clear(); sessionStorage.setItem('bioRig', '1'); } } catch (e) {} });
const boot = async () => { await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 30000 }); };
const mods = `const [{ $ }, W, ST, F, FX, SG, M] = await Promise.all(['/src/state.ts', '/src/world.ts', '/src/step.ts', '/src/flow.ts', '/src/fx/update.ts', '/src/stages.ts', '/src/menus.ts'].map((m) => import(m)));`;
await boot();
const start = await p.evaluate(`(async () => { ${mods}
  $.gate = false; F.newGame(0); $.state = 'play'; for (let i = 0; i < 60; i++) ST.step();
  return { cpN: $.G.cpN, seed: $.G.seed, bio: $.G.bio }; })()`);
if (start.cpN !== 0) { console.log('FAIL: no CP0 written', start); await b.close(); process.exit(1); }
const cycle = () => p.evaluate(`(async () => { ${mods}
  const w0 = $.meta.bio, g0 = $.G.bio;
  W.orbs.push({ x: $.P.x, y: $.P.y, vx: 0, vy: 0, v: 10, l: 600, t: 20 }); FX.updateFX();
  SG.clearStage(); $.G.tally = null;
  const out = { wallet: $.meta.bio - w0, run: $.G.bio - g0 };
  M.pauseItems().find((x) => x.l === 'SURFACE').a();
  return out; })()`);
const reenter = () => p.evaluate(`(async () => { ${mods} return { ok: F.resumeLast() !== false, state: $.state, bio: $.G.bio }; })()`);
const rows = [];
rows.push(await cycle());
console.log('re-enter', await reenter());
rows.push(await cycle());
await boot(); // the app kill's half: everything must come back from storage
console.log('re-enter after reload', await reenter());
rows.push(await cycle());
await b.close();
rows.forEach((r, i) => console.log(`cycle ${i + 1}: wallet +${r.wallet}, run +${r.run}`));
const ok = rows[0].wallet > 0 && rows[0].run === rows[0].wallet && rows.slice(1).every((r) => r.wallet === 0 && r.run === rows[0].run) && !errs.length;
if (errs.length) console.log('page errors', errs);
console.log(ok ? 'BIO REPLAY PASS: the replays banked nothing' : `BIO REPLAY FAIL: banked ${rows.reduce((s, r) => s + r.wallet, 0)} for ${rows[0].run} earned`);
process.exit(ok ? 0 : 1);

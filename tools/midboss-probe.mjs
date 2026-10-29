// Midboss probe: time-to-kill for each biome midboss (docs/pacing.md 3.2) across boss-probe's loadout tiers, with the
// Maw midboss (maw(false)) as the yardstick. Each fight runs inside its real biome (fork gate taken, terrain rewritten,
// palette on); THE ANAL PROBE (ufo) runs in Open Orbit at its real scroll x, with the scroll moving (it doesn't hold it)
// and its forced exit before the Maw's run-up. Invincible bot parks at x=90 and tracks the midboss's y, holding fire.
// Usage: node tools/midboss-probe.mjs <url> [shotsDir] [zoomDir]   (also saves a rendered mid-fight midboss-<biome>.png, and a close-up)
//  TTK = seconds from the midboss being on screen to dead; "esc" = it left (escape timer) first
import { chromium } from 'playwright';
const [url, SHOTS, ZOOM] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: ZOOM ? 2 : 1 });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
const L = [
  ['NAKED (died)', {}, {}, {}],
  ['STAGE 1 kit', { speed: 2, missile: 1, double: 1, options: 1, wardLv: 1 }, { cal: 1 }, { dmg: 1 }],
  ['END DESCENT 1', { speed: 3, missile: 2, double: 1, options: 2, wardLv: 2 }, { cal: 1, rapid: 1 }, { dmg: 2, rof: 1, crit: 2 }],
  ['STRONG D1', { speed: 4, missile: 2, laser: 1, options: 2, wardLv: 2 }, { cal: 2, serr: 1, rapid: 1 }, { dmg: 3, rof: 2, crit: 3, volatile: 2, teeth: 2 }],
];
const MIDS = [['maw', 'acid'], ['choir', 'ice'], ['cyst', 'acid'], ['prentice', 'fire'], ['brood', 'snot'], ['ufo', null]];
// one loadout + biome, midboss spawned; returns a frame stepper with the bot attached
const prep = async (pw, gm, pkk, k, biome) => p.evaluate(async ([pw, gm, pkk, k, biome]) => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), BI = await import('/src/biomes.ts'), C = await import('/src/core.ts'), IN = await import('/src/input.ts');
  const UF = await import('/src/enemies/ufo.ts');
  const $ = S.$; $.gate = false; IN.K.KeyZ = true;
  F.newGame(0); $.state = 'play';
  for (let i = 0; i < 30; i++) ST.step();
  if (!biome) $.G.scroll = UF.UFO_AT + 150; // Open Orbit: where it lands after its WARNING
  else {
  $.G.scroll = 2300; $.G.si = $.G.script.length; W.enemies.length = 0;
  BI.openFork(0); $.G.fork.opts = [biome, biome]; $.G.fork.t = 50; $.G.tally = null;
  const gy = $.G.fork.gy[0]; Object.assign($.P, { x: C.W * .74, y: gy, alive: true, inv: 30 });
  ST.step();
  $.G.scroll = 3300; // past the rewrite blend, inside the biome; skip its script
  for (let i = 0; i < 60; i++) { $.P.inv = 30; ST.step(); }
  }
  $.G.si = $.G.script.length; $.G.pick = null; $.G.pickQ = 0; $.G.tally = null;
  Object.assign($.P, { speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0 }, pw);
  if ($.P.wardLv) $.P.shield = 3;
  $.G.gm = { ...gm }; $.G.pk = { ...pkk }; $.G.lvl = 10;
  W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.shots.length = 0;
  const sv = $.G.scroll; ST.step(); $.G.scroll = sv;
  W.enemies.length = 0; W.eshots.length = 0; W.shots.length = 0;
  if (k === 'maw') SP.maw(false); else if (k === 'ufo') { $.G.eat = UF.UFO_GAP_END; UF.spawnUfo(); } else SP.midboss(k, BI.BIOMES[biome].midName);
  window.__mb = { $, ST, C, W, f: 0, t0: -1 };
  window.__mbStep = (n) => {
    const m = window.__mb;
    for (let i = 0; i < n; i++) {
      const g = m.$.G.mini;
      if (!g || g.dead) return g && (g.gone || g.x > m.C.W + 50) ? 'esc' : ((m.f - Math.max(0, m.t0)) / 60).toFixed(1);
      if (m.t0 < 0 && g.x < m.C.W - 20) m.t0 = m.f;
      const y = m.C.clamp(g.y, 8, m.C.PH - 8), P = m.$.P;
      P.hist.unshift({ x: 90, y }); if (P.hist.length > 80) P.hist.pop();
      Object.assign(P, { x: 90, y, alive: true, inv: 30 }); m.$.G.pick = null; m.$.G.pickQ = 0;
      m.ST.step(); m.f++;
    }
    return null;
  };
  return +$.G.rank.toFixed(2);
}, [pw, gm, pkk, k, biome]);
const out = {}, rank = {};
for (const [name, pw, gm, pkk] of L) {
  out[name] = {};
  for (const [k, biome] of MIDS) {
    rank[name] = await prep(pw, gm, pkk, k, biome);
    let r = null;
    for (let i = 0; i < 80 && r == null; i++) r = await p.evaluate(() => window.__mbStep(60));
    out[name][k] = r ?? '--';
  }
}
console.log('rank per loadout:', JSON.stringify(rank));
console.log('loadout'.padEnd(16), ...['MAW(mid)', 'NAIL CHOIR', 'DISS. WOMB', 'APPRENTICE', 'BROOD MOM', 'ANAL PROBE'].map((s) => s.padStart(11)));
for (const [n, r] of Object.entries(out)) console.log(n.padEnd(16), ...MIDS.map(([k]) => String(r[k]).padStart(11)));
if (SHOTS) for (const [k, biome] of MIDS.slice(1)) {
  await prep(...L[1].slice(1), k, biome);
  // fight ~6 s in, then wait for a telegraph so the shot shows the attack being read
  await p.evaluate(() => window.__mbStep(360));
  for (let i = 0; i < 120; i++) { const st = await p.evaluate(() => { window.__mbStep(1); const g = window.__mb.$.G.mini; return g && g.st !== 'idle' && g.wt > 15 ? g.st : ''; }); if (st) break; }
  await p.evaluate(async () => { const { render } = await import('/src/render/screens.ts'); render(); });
  await p.screenshot({ path: `${SHOTS}/midboss-${biome || 'orbit'}.png` });
  if (ZOOM) {
    const r = await p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(), g = window.__mb.$.G.mini; return { x: c.x, y: c.y, s: c.width / 480, gx: g.x, gy: g.y }; });
    await p.screenshot({ path: `${ZOOM}/midboss-${biome || 'orbit'}-zoom.png`, clip: { x: r.x + (r.gx - 70) * r.s, y: Math.max(0, r.y + (r.gy - 60) * r.s), width: 140 * r.s, height: 120 * r.s } });
  }
  console.log('shot', `midboss-${biome || 'orbit'}.png`, await p.evaluate(() => { const g = window.__mb.$.G.mini; return g ? `${g.k} st=${g.st} hp=${g.hp | 0}/${g.max | 0}` : 'gone'; }));
}
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); await b.close();

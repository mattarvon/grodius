// Midboss probe: time-to-kill for each biome midboss (docs/pacing.md 3.2) across boss-probe's loadout tiers, with the
// Maw midboss (maw(false)) as the yardstick. Each fight runs inside its real biome (fork gate taken, terrain rewritten,
// palette on); THE SQUIDFUCKED SAUCER (ufo) runs in Open Orbit at its real scroll x, with the scroll moving (it doesn't hold it)
// and its forced exit before the Maw's run-up. Invincible bot parks at x=90 and tracks the midboss's y, holding fire.
// Usage: node tools/midboss-probe.mjs <url> [shotsDir] [zoomDir]   (also saves a rendered mid-fight midboss-<biome>.png, and a close-up)
//        node tools/midboss-probe.mjs <url> matrix [shotsDir]   (LS1 P0 crossovers: each of the 4 biome midbosses in each of
//        the 4 biomes, STAGE 1 kit; TTK, y range, terrain clipping, render errors, and a mid-fight xmb-<kind>-<biome>.png)
//  TTK = seconds from the midboss being on screen to dead; "esc" = it left (escape timer) first
import { chromium } from 'playwright';
const argv = process.argv.slice(2), MATRIX = argv[1] === 'matrix';
const [url, SHOTS, ZOOM] = MATRIX ? [argv[0], argv[2]] : argv;
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
const prep = async (pw, gm, pkk, k, biome, host, at = 3300) => p.evaluate(async ([pw, gm, pkk, k, biome, host, at]) => {
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
  $.G.scroll = at; // past the rewrite blend, inside the biome; skip its script (matrix: several stage positions)
  for (let i = 0; i < 60; i++) { $.P.inv = 30; ST.step(); }
  }
  $.G.si = $.G.script.length; $.G.pick = null; $.G.pickQ = 0; $.G.tally = null;
  if ($.G.pend) $.G.pend.length = 0; // a WARNING the script queued on the way in would replace the midboss under test
  Object.assign($.P, { speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0 }, pw);
  if ($.P.wardLv) $.P.shield = 3;
  $.G.gm = { ...gm }; $.G.pk = { ...pkk }; $.G.lvl = 10;
  W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.shots.length = 0;
  const sv = $.G.scroll; ST.step(); $.G.scroll = sv;
  W.enemies.length = 0; W.eshots.length = 0; W.shots.length = 0;
  if (k === 'maw') SP.maw(false); else if (k === 'ufo') { $.G.eat = UF.UFO_GAP_END; UF.spawnUfo(); } else SP.midboss(k, Object.values(BI.BIOMES).find((B) => B.mid === k).midName, host); // its own name, wherever it fights
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
}, [pw, gm, pkk, k, biome, host, at]);
if (MATRIX) await matrix();
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
console.log('loadout'.padEnd(16), ...['MAW(mid)', 'NAIL CHOIR', 'DISS. WOMB', 'APPRENTICE', 'BROOD MOM', 'SQUID SAUCER'].map((s) => s.padStart(11)));
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

// ---- LS1 P0: the 4x4 crossover matrix (home fights on the diagonal) ----
async function matrix() {
  const KS = [['choir', 'ice'], ['cyst', 'acid'], ['prentice', 'fire'], ['brood', 'snot']], BS = ['ice', 'acid', 'fire', 'snot'];
  const res = {};
  const AT = [3300, 3700, 4100, 4500]; // stage positions (world x): different terrain under the fight
  for (const [k, home] of KS) for (const biome of BS) for (const at of AT) {
    // the midboss is spawned with its host = the biome it is in, as biomes.ts does
    await prep(...L[1].slice(1), k, biome, biome, at);
    const r = await p.evaluate(async ([k, shotsAt]) => {
      const MH = await import('/src/enemies/midhost.ts'), W = await import('/src/world.ts'), SCR = await import('/src/render/screens.ts');
      const m = window.__mb, b = MH.MID_BODY[k], bars = [];
      let clip = 0, n = 0, y0 = 1e9, y1 = -1e9, ttk = null, rendered = 0, shot = false;
      for (let f = 0; f < 80 * 60 && ttk == null; f++) {
        ttk = window.__mbStep(1);
        const g = m.$.G.mini;
        if (ttk != null || !g) break;
        if (g.x < m.C.W - 20 && !g.gone) { // on screen and fighting: is any hittable part inside the terrain?
          n++;
          y0 = Math.min(y0, g.y); y1 = Math.max(y1, g.y);
          const wx = g.x + m.$.G.scroll;
          let ce = -1e9, fl = 1e9;
          for (let d = -b.hw; d <= b.hw; d += b.hw / 2) { ce = Math.max(ce, W.ceilAt(wx + d)); fl = Math.min(fl, W.floorAt(wx + d)); }
          if (g.y - b.up < ce - .5 || g.y + b.dn > fl + .5) clip++;
        }
        if (f % 30 === 0) { SCR.render(); rendered++; }
        if (!shot && f >= shotsAt && g.st !== 'idle' && g.wt > 15) { shot = true; window.__mbShot = 1; return { pause: true, clip, n, y0, y1, rendered, cross: MH.isCross(g), host: g.host, cap: null }; }
      }
      return { ttk: ttk ?? '--', clip, n, y0, y1, rendered };
    }, [k, at === AT[0] ? 360 : 1e9]);
    let out = r;
    if (r.pause) { // mid-fight screenshot during a telegraph, then fight on to the end
      // no hit flash in the evidence frame: the flash filter would hide the tint being checked
      await p.evaluate(async () => { const { render } = await import('/src/render/screens.ts'); const g = window.__mb.$.G.mini; if (g) g.flash = 0; render(); });
      if (SHOTS) {
        await p.screenshot({ path: `${SHOTS}/xmb-${k}-${biome}.png` });
        const z = await p.evaluate(() => { const c = document.getElementById('c').getBoundingClientRect(), g = window.__mb.$.G.mini; return { x: c.x, y: c.y, s: c.width / 480, gx: g.x, gy: g.y }; });
        await p.screenshot({ path: `${SHOTS}/xmb-${k}-${biome}-zoom.png`, clip: { x: z.x + (z.gx - 60) * z.s, y: Math.max(0, z.y + (z.gy - 60) * z.s), width: 120 * z.s, height: 120 * z.s } });
      }
      const rest = await p.evaluate(async ([k]) => {
        const MH = await import('/src/enemies/midhost.ts'), W = await import('/src/world.ts'), SCR = await import('/src/render/screens.ts');
        const m = window.__mb, b = MH.MID_BODY[k];
        let clip = 0, n = 0, y0 = 1e9, y1 = -1e9, ttk = null, rendered = 0, maxKids = 0;
        for (let f = 0; f < 80 * 60 && ttk == null; f++) {
          ttk = window.__mbStep(1);
          const g = m.$.G.mini;
          if (ttk != null || !g) break;
          let kids = 0; for (const q of W.enemies) if (q.kid && !q.dead) kids++;
          maxKids = Math.max(maxKids, kids);
          if (g.x < m.C.W - 20 && !g.gone) {
            n++; y0 = Math.min(y0, g.y); y1 = Math.max(y1, g.y);
            const wx = g.x + m.$.G.scroll;
            let ce = -1e9, fl = 1e9;
            for (let d = -b.hw; d <= b.hw; d += b.hw / 2) { ce = Math.max(ce, W.ceilAt(wx + d)); fl = Math.min(fl, W.floorAt(wx + d)); }
            if (g.y - b.up < ce - .5 || g.y + b.dn > fl + .5) clip++;
          }
          if (f % 30 === 0) { SCR.render(); rendered++; }
        }
        // the death and its aftermath (the Womb and the Brood fall in two halves, drawn through render/gore.ts)
        for (let i = 0; i < 90; i++) { m.ST.step(); if (i % 6 === 0) { SCR.render(); rendered++; } }
        return { ttk: ttk ?? '--', clip, n, y0, y1, rendered, maxKids };
      }, [k]);
      out = { ttk: rest.ttk, clip: r.clip + rest.clip, n: r.n + rest.n, y0: Math.min(r.y0, rest.y0), y1: Math.max(r.y1, rest.y1), rendered: r.rendered + rest.rendered + 1, cross: r.cross, maxKids: rest.maxKids };
    }
    const key = k + '@' + biome, o = res[key];
    if (!o) res[key] = { ...out, ttks: [out.ttk], home: biome === home };
    else Object.assign(o, { clip: o.clip + out.clip, n: o.n + out.n, y0: Math.min(o.y0, out.y0), y1: Math.max(o.y1, out.y1), rendered: o.rendered + out.rendered, ttks: [...o.ttks, out.ttk], maxKids: Math.max(o.maxKids ?? 0, out.maxKids ?? 0) });
  }
  console.log('LS1 P0 crossover matrix, STAGE 1 kit, 4 stage positions each (mean TTK s, +e = some escaped | clip = % of on-screen frames with a hittable part inside the terrain | y range)');
  console.log('midboss'.padEnd(10), ...BS.map((b) => b.padStart(29)));
  for (const [k] of KS) console.log(k.padEnd(10), ...BS.map((b) => {
    const r = res[k + '@' + b], pc = r.n ? (100 * r.clip / r.n).toFixed(0) : '-';
    const t = r.ttks.filter((v) => v !== 'esc' && v !== '--').map(Number), tt = t.length ? (t.reduce((a, v) => a + v, 0) / t.length).toFixed(1) : 'esc';
    return `${r.home ? '*' : ' '}${tt.padStart(5)}${t.length < r.ttks.length ? '+e' : '  '} clip${pc.padStart(3)}% y${Math.round(r.y0)}-${Math.round(r.y1)}`.padStart(29);
  }));
  console.log('(* = home biome; only the Brood is fitted at home)   brood max hatchlings alive:', BS.map((b) => `${b} ${res['brood@' + b].maxKids ?? '?'}`).join(', '));
  // the CROWD cap: hold fire so the litters pile up, push rank to 1 and phase 2 (the largest litters), count the alive
  await prep(...L[3].slice(1), 'brood', 'snot', 'snot'); // STRONG D1 kit: high power, so rank and the litters are at their largest
  const cap = await p.evaluate(async () => {
    const IN = await import('/src/input.ts'), W = await import('/src/world.ts'), m = window.__mb;
    IN.K.KeyZ = false; m.$.G.loop = 4; // Descent 5: cdm() cooldowns are short enough that litters overlap
    let mx = 0, births = 0, st0 = '';
    for (let f = 0; f < 1300; f++) {
      const g = m.$.G.mini; if (!g) break;
      g.hp = Math.min(g.hp, g.max * .45);
      if (g.st === 'birth' && st0 !== 'birth') births++;
      st0 = g.st;
      Object.assign(m.$.P, { x: 24, y: 12, alive: true, inv: 30 }); m.ST.step(); // parked in the corner so the litters live
      if (m.$.G.mini && m.$.G.mini.t > m.$.G.mini.leave - 2) m.$.G.mini.t = 200; // keep her from withdrawing
      let kids = 0; for (const q of W.enemies) if (q.kid && !q.dead) kids++;
      mx = Math.max(mx, kids);
    }
    IN.K.KeyZ = true;
    return { mx, births, rank: +m.$.G.rank.toFixed(2) };
  });
  console.log(`brood CROWD cap (STRONG kit holding fire, Descent 5, phase 2): max hatchlings alive ${cap.mx} over ${cap.births} litters, rank ${cap.rank} (cap 8)`);
  console.log('render frames sampled:', Object.values(res).reduce((a, r) => a + r.rendered, 0));
  console.log('errors:', errs.slice(0, 5).join(' | ') || 'none');
  await b.close();
  process.exit(errs.length ? 1 : 0);
}

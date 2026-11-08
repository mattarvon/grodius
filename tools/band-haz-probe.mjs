// Band hazard probe (LS2-d31): biome hazard rate and hits per region of a biome stage, movement A before the
// movement-B band, the band itself (and its blend-in/out ramps), movement A after. Movement B multiplies the hazard
// interval inside a fully blended band (src/terrainb.ts MOVE_HAZ via hazInterval, called from src/biomes.ts stepBiome);
// this measures what that does to a dodging pilot (tools/pilot.mjs), per biome x slot x variant x descent.
// Usage: node tools/band-haz-probe.mjs <url> [--layout long4] [--seeds 1,3,5,7,11] [--loops 0,1] [--biomes ice,acid,fire,snot]
//          [--slots 0,1] [--modes mortal,ghost] [--pilot on|blind|off] [--fire on|off] [--out file.json]
//   --pilot blind: the same pilot, with biome hazards hidden from it (it still dodges enemies, shots and walls): the
//   "player who does not read the hazard" bound. The default pilot reads every hazard and, on main, is never touched.
//   Per run: hazHitSets / slowUps (raw, every frame, measuring or not), meanPx (the ship's mean x on exposure frames:
//   hazards expire before x ~90, so a ship that hugs the left edge is never reached), hooked (the hazHit accessor held).
//   --pilot off / --fire off: the ship parks at x 170 / never fires (shots break icicles and strands); together they are
//   the check that hits and SNOTTED register, not a measurement.
//   url: a Vite DEV server (the probe imports /src modules in-page and uses the ?stage= jump switch, src/jump.ts).
//   Output: JSON (per run and pooled) to --out or stdout; the summary table to stderr.
//   Modes: mortal = the pilot takes real hazard hits (shield, death; G.lives is topped up so the stage is flown to its
//   end and deaths are counted). ghost = hazard hits are swallowed (G.hazHit is cleared as it is set) and counted as
//   would-be hits; P.inv is never used to keep the ship alive, because stepBiome stops the hazard clock while
//   P.inv >= 60. Enemy hits are real in both modes.
// Definitions (one rule for both modes):
//   exposure frame: the frame stepBiome's hazard clock runs (biome k > .9, play, no fork/forkHold/tally/pick/clearT,
//     P alive, P.inv < 60) AND no midboss is up (G.mini: its x1.6 interval is excluded from every region)
//   region: by the screen centre world x (the x hazInterval reads) against MOVES[slot] (the band the build drew):
//     pre (A, before the band) | blendIn | band (fully blended: where MOVE_HAZ applies) | blendOut | post (A, after)
//   spawn: a hazard object that appeared in __biome().haz on an exposure frame (spawnHazard's no-ops are not spawns)
//   hit: the first contact of one hazard with the ship (G.hazHit set) while P.inv is 0, on an exposure frame; a jet or
//     geyser sets hazHit every overlapping frame and counts once. Contacts the probe could not attribute to a hazard
//     are `unattr` (one per run of consecutive frames). snot strands never set hazHit: `snot` counts SNOTTED (P.slow
//     raised) separately.
//   ρ (rho) = band hits/min ÷ movement-A (pre + post pooled) hits/min, same biome/slot/variant/descent, pooled seeds.
// Setup writes (before measuring, as tools/hazard-probe.mjs does): slot 1 is reached by jumping to slot 0's run-up with
// another biome, keeping the ship alive (P.inv) and the boss at .5 hp until it dies, and forcing the fork's first gate to
// the target biome. Nothing is written once measuring starts except G.lives (mortal) and the pilot's P.x/P.y.
// Variant: the jump starts a first visit (visitNo 0), so B0 on Descent 1 always and B0/B1 by the first-visit roll on
// Descent 2+ (setdraw.ts moveRoll); the probe predicts the roll in Node from the seed and takes, for each variant, the
// first seeds whose roll gives it (the list, then 101, 102, ...), then checks MOVES[slot].mv in-page.
// Not measured: the boss fight (each run stops when the screen reaches the boss arena, bossX - W); B1 on Descent 1 (it
// does not exist on a first visit); a real revisit's script remix (v > 0 changes enemies, not the hazard clock);
// hazards spawned during a midboss; enemy-caused hits.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
if (!process.argv.includes('--layout')) process.argv.push('--layout', 'long4'); // this probe's default (layout-arg's is short)
const { LAYOUT } = await import('./layout-arg.mjs');
const { PILOT } = await import('./pilot.mjs');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const list = (k, d) => opt(k, d).split(',').filter(Boolean);
const SEEDS = list('--seeds', '1,3,5,7,11').map(Number), LOOPS = list('--loops', '0,1').map(Number);
const BIOMES = list('--biomes', 'ice,acid,fire,snot'), SLOTS = list('--slots', '0,1').map(Number), MODES = list('--modes', 'mortal,ghost');
const OUT = opt('--out', null), PILOT_ARG = opt('--pilot', 'on'), PILOT_ON = PILOT_ARG !== 'off', BLIND = PILOT_ARG === 'blind', FIRE = opt('--fire', 'on') !== 'off';
const url = argv.find((a) => !a.startsWith('--'));
if (!url) { console.error('usage: node tools/band-haz-probe.mjs <dev-server-url> [--layout long4] [--seeds ..] [--loops ..] [--biomes ..] [--slots ..] [--modes ..] [--out f]'); process.exit(2); }
const b = await chromium.launch();
// the plan is read from the page's own modules (the build under test), never from this checkout's src/: slot rows, the
// biome list and the first-visit variant roll for every candidate seed
const CAND = [...new Set([...SEEDS, ...Array.from({ length: 400 }, (_, i) => 101 + i)])];
const PLAN = await (async () => { const p = await b.newPage(); await p.goto(`${url}${url.includes('?') ? '&' : '?'}layout=${LAYOUT}`); await p.waitForFunction(() => window.__started, null, { timeout: 30000 });
  const r = await p.evaluate(async ([layout, cand]) => { const L = await import('/src/layout.ts'), R = await import('/src/rng.ts'), SD = await import('/src/setdraw.ts'), MP = await import('/src/midpick.ts');
    if (L.layout().id !== layout) L.setLayout(layout);
    const rows = [0, 1].map((s) => { const r = L.slotRow(s); return { x0: r.x0, bossX: r.bossX, stage: L.stageOfSlot(s) }; });
    const mv = {}; for (const loop of [0, 1, 2, 3]) for (const s of [0, 1]) mv[`${loop}|${s}`] = cand.map((seed) => SD.moveRoll(0, loop, R.stream(R.pickSeedOf(seed, loop, rows[s].stage)), 0));
    return { id: L.layout().id, moveB: !!L.layout().beats.moveB, home: Object.keys(MP.HOME), rows, mv }; }, [LAYOUT, CAND]);
  await p.close(); return r; })();
if (!PLAN.moveB) { console.error(`layout ${LAYOUT} has no movement B on this build: nothing to measure`); process.exit(2); }
const HOME = PLAN.home;
const mvOf = (seed, loop, slot) => PLAN.mv[`${loop}|${slot}`][CAND.indexOf(seed)];
function seedsFor(loop, slot, mv) {
  if (loop === 0) return mv === 0 ? SEEDS.slice() : [];
  const out = [];
  for (const s of CAND) { if (out.length >= SEEDS.length) break; if (!out.includes(s) && mvOf(s, loop, slot) === mv) out.push(s); }
  return out;
}

const INIT = ([seed]) => {
  let now = 0; const q = [];
  performance.now = () => now; Date.now = () => 1.7e12 + now;
  window.requestAnimationFrame = (f) => (q.push(f), 1); window.setTimeout = () => 0; window.speechSynthesis = undefined;
  window.AudioContext = undefined; window.webkitAudioContext = undefined;
  let s = (0x9e3779b9 ^ Math.imul(seed, 0x85ebca6b)) >>> 0 || 1; Math.random = () => ((s ^= s << 13), (s ^= s >>> 17), (s ^= s << 5), (s >>> 0) / 4294967296);
  try { localStorage.clear(); localStorage.setItem('grodius.v1', JSON.stringify({ meta: { v: 2 }, asked: true })); } catch (e) {}
  // drawing is stubbed for speed: render/fx draw srnd(), never the sim R(), so the sim is unchanged (rng-probe proves it)
  { const C = CanvasRenderingContext2D.prototype; for (const m of ['fillRect', 'strokeRect', 'drawImage', 'fill', 'stroke', 'fillText', 'strokeText', 'putImageData', 'clearRect', 'getImageData']) C[m] = function (...a) { return m === 'getImageData' ? { data: new Uint8ClampedArray(a[2] * a[3] * 4), width: a[2], height: a[3] } : undefined; }; }
  const REG = ['pre', 'blendIn', 'band', 'blendOut', 'post'];
  const H = (window.__H = { on: false, mode: 'mortal', slot: 0, rec: null, f: 0, cur: null, lastG: null, seen: new WeakSet(), hitSet: new WeakSet(), lastUn: -9, prevSlow: 0, wasAlive: true, deaths: 0, hazDeaths: 0, contactF: -9 });
  H.reset = () => { H.raw = { set: 0, slowUp: 0, px: 0, okF: 0 }; H.rec = Object.fromEntries(REG.map((r) => [r, { fr: 0, exp: 0, spawns: 0, hits: 0, snot: 0, unattr: 0, kinds: {} }])); H.f = 0; H.deaths = 0; H.hazDeaths = 0; };
  const overlaps = (h, P) => {
    if (h.k === 'icicle') return Math.abs(P.x - h.x) < 5 && P.y > h.y && P.y < h.y + h.len + 4;
    if ((h.k === 'geyser' || h.k === 'jet') && h.reach != null) {
      const r = h.reach, y0 = h.k === 'geyser' ? h.y - r : h.dir > 0 ? h.y : h.y - r, y1 = h.k === 'geyser' ? h.y : h.dir > 0 ? h.y + r : h.y;
      return Math.abs(P.x - h.x) < 7 && P.y > y0 && P.y < y1;
    }
    return false;
  };
  const contact = () => {
    const g = window.__G(), P = g.P, c = H.cur;
    if (!c || !c.ok || !P || P.inv > 0 || !P.alive) return;
    const h = globalThis.__biome().haz.find((h) => overlaps(h, P) && !H.hitSet.has(h)) || globalThis.__biome().haz.find((h) => overlaps(h, P));
    H.contactF = H.f;
    if (h) { if (H.hitSet.has(h)) return; H.hitSet.add(h); H.rec[c.reg].hits++; }
    else { if (H.lastUn !== H.f - 1) H.rec[c.reg].unattr++; H.lastUn = H.f; }
  };
  const hook = (G) => {
    let v = G.hazHit || 0;
    Object.defineProperty(G, 'hazHit', { configurable: true, enumerable: true, get: () => v,
      set: (x) => { if (x) H.raw.set++; if (x && H.on) contact(); v = x && H.on && H.mode === 'ghost' ? 0 : x; } });
  };
  const region = (wx) => {
    const m = window.__T.MOVES[H.slot];
    if (!m) return 'pre';
    if (wx <= m.a) return 'pre';
    if (wx >= m.z) return 'post';
    const k = window.__T.moveK(m, wx);
    return k >= 1 ? 'band' : wx < (m.a + m.z) / 2 ? 'blendIn' : 'blendOut';
  };
  // one measured frame: pilot, step, then attribute spawns and snot to the region the frame started in
  window.__run = (n, stopX) => {
    for (let i = 0; i < n; i++) {
      const g = window.__G(), G = g.G, P = g.P;
      if (!G || g.state !== 'play') return 'state:' + g.state;
      if (G.scroll >= stopX) return 'stop';
      if (G !== H.lastG) { hook(G); H.lastG = G; }
      if (H.mode === 'mortal' || H.mode === 'ghost') G.lives = Math.max(G.lives, 3); // fly the whole stage; deaths are counted
      const [b, k] = (globalThis.__biome().k || []), wx = G.scroll + window.__C.W / 2;
      const ok = !!(b && k > .9 && !G.fork && !G.forkHold && !G.tally && !G.pick && !G.clearT && P && P.alive && P.inv < 60 && !G.mini);
      H.cur = { reg: region(wx), ok };
      const e = g.enemies.filter((e) => !e.dead && e.x > P.x + 20 && e.x < 480 && (e.hp || 1) > 0).sort((a, c) => Math.abs(a.y - P.y) - Math.abs(c.y - P.y))[0];
      if (P.alive && H.pilot) { const real = globalThis.__biome; if (H.blind) globalThis.__biome = () => ({ ...real(), haz: [] });
        try { window.__pilotStep(g, e ? Math.min(140, e.x - 60) : 90, e ? e.y : P.y); } finally { globalThis.__biome = real; } }
      else if (P.alive) P.x = 170; // --pilot off: parked where hazards reach (they spawn at .45-.9 W and expire before x ~90)
      if (ok) { H.raw.px += P.x; H.raw.okF++; }
      now += 1000 / 60; q.splice(0).forEach((f) => f(now)); H.f++;
      const r = H.rec[H.cur.reg]; r.fr++; if (ok) r.exp++;
      const P2 = window.__G().P;
      for (const h of globalThis.__biome().haz) if (!H.seen.has(h)) { H.seen.add(h); if (ok) { r.spawns++; r.kinds[h.k] = (r.kinds[h.k] || 0) + 1; } }
      if (P2 && (P2.slow || 0) > H.prevSlow + 1) { H.raw.slowUp++; if (ok) r.snot++; }
      H.prevSlow = (P2 && P2.slow) || 0;
      const alive = !!(P2 && P2.alive);
      if (H.wasAlive && !alive) { H.deaths++; if (H.contactF === H.f - 1 || H.contactF === H.f) H.hazDeaths++; }
      H.wasAlive = alive;
    }
    return 'more';
  };
  // plain ticks for the setup phase (no measuring), with the pick screen answered by the caller
  window.__tick = (n, fn) => { for (let i = 0; i < n; i++) { if (fn) fn(); now += 1000 / 60; q.splice(0).forEach((f) => f(now)); } };
};

async function runOne(biome, slot, loop, mv, seed, mode) {
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.route(/fonts\.(googleapis|gstatic)/, (r) => r.abort());
  await p.addInitScript(PILOT);
  await p.addInitScript(INIT, [seed]);
  const s0 = slot === 0 ? biome : HOME.find((x) => x !== biome), r0 = PLAN.rows[0], row = PLAN.rows[slot];
  const x = slot === 0 ? 0 : Math.round(r0.bossX - r0.x0 - 30);
  const kit = loop === 0 ? 'mid' : 'full';
  await p.goto(`${url}${url.includes('?') ? '&' : '?'}layout=${LAYOUT}&stage=${s0}&x=${x}&loop=${loop}&kit=${kit}&seed=${seed}`);
  await p.waitForFunction(() => window.__started && window.__G && window.__G().G && window.__G().state === 'play', null, { timeout: 30000 });
  await p.evaluate(async () => { window.__W = await import('/src/world.ts'); window.__BU = await import('/src/boss/update.ts'); window.__T = await import('/src/terrainb.ts'); window.__C = await import('/src/core.ts'); });
  if (FIRE) await p.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', key: 'KeyZ' })));
  const enter = async () => { await p.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter' }))); await p.evaluate('__tick(2)'); await p.evaluate(() => dispatchEvent(new KeyboardEvent('keyup', { code: 'Enter', key: 'Enter' }))); };
  let setup = 'ok';
  if (slot === 1) { // setup: kill slot 0's boss, force the fork into the target (hazard-probe's pattern)
    setup = 'no fork';
    for (let k = 0; k < 600; k++) {
      const st = await p.evaluate((biome) => { __tick(10, () => { const g = __G(), G = g.G; if (!G || !g.P) return; g.P.inv = 30; g.P.alive = true; G.lives = Math.max(G.lives, 3);
          if (G.mini && !G.mini.dead && G.mini.hp > 1) G.mini.hp = .5;
          if (G.fork) { G.fork.opts[0] = biome; if (G.fork.t > 45) { g.P.x = 355; g.P.y = 71; } } });
        const G = __G().G; return { r: G && G.route[1], pick: G && G.pick ? G.pick.t : -1, st: __G().state }; }, biome);
      if (st.r) { setup = st.r === biome ? 'ok' : `fork took ${st.r}`; break; }
      if (st.pick > 36) await enter();
      if (st.st !== 'play') { setup = 'state ' + st.st; break; }
    }
    await p.evaluate('__tick(60)'); // let the forced-inv frames lapse before measuring
  }
  const info = await p.evaluate(([slot, mode, pil, blind]) => { const H = window.__H, G = __G().G; H.slot = slot; H.mode = mode; H.pilot = pil; H.blind = blind; H.reset(); H.on = true; H.seen = new WeakSet(); for (const h of globalThis.__biome().haz) H.seen.add(h);
    const m = window.__T.MOVES[slot]; return { W: window.__C.W, route: G.route.slice(), loop: G.loop, mv: m ? m.mv : null, band: m ? [Math.round(m.a), Math.round(m.z), m.blend] : null, scroll0: Math.round(G.scroll) }; }, [slot, mode, PILOT_ON, BLIND]);
  const stopX = row.bossX - info.W;
  let end = 'cap';
  for (let k = 0; k < 120 && setup === 'ok'; k++) { // cap: 120 x 300 frames = 10 game minutes
    const r = await p.evaluate(([sx]) => { const r = __run(300, sx); return { r, pick: __G().G && __G().G.pick ? __G().G.pick.t : -1 }; }, [stopX]);
    if (r.pick > 36) await enter();
    if (r.r !== 'more') { end = r.r; break; }
  }
  const out = await p.evaluate(() => ({ hazHitSets: window.__H.raw.set, slowUps: window.__H.raw.slowUp, meanPx: window.__H.raw.okF ? Math.round(window.__H.raw.px / window.__H.raw.okF) : null, hooked: !!(Object.getOwnPropertyDescriptor(__G().G, 'hazHit') || {}).set, rec: window.__H.rec, f: window.__H.f, deaths: window.__H.deaths, hazDeaths: window.__H.hazDeaths, pilot: window.__pilotLog && { trapped: window.__pilotLog.trapped } }));
  await p.close();
  return { biome, slot, loop, mvWant: mv, mv: info.mv, seed, mode, kit, setup, end, band: info.band, scroll0: info.scroll0, ...out, errs: errs.slice(0, 3) };
}

const runs = [], t0 = Date.now();
for (const loop of LOOPS) for (const slot of SLOTS) for (const mv of [0, 1]) {
  const seeds = seedsFor(loop, slot, mv);
  for (const biome of BIOMES) for (const seed of seeds) for (const mode of MODES) {
    const r = await runOne(biome, slot, loop, mv, seed, mode);
    runs.push(r);
    console.error(`D${loop + 1} s${slot} ${biome} B${mv} seed ${seed} ${mode}: ${r.setup}/${r.end} mv=${r.mv} ${(r.f / 60).toFixed(0)}s band hits ${r.rec.band.hits} A hits ${r.rec.pre.hits + r.rec.post.hits} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
}
const REG = ['pre', 'blendIn', 'band', 'blendOut', 'post'];
const rate = (n, fr) => (fr ? +(n / (fr / 3600)).toFixed(2) : null);
const pooled = [];
for (const key of [...new Set(runs.map((r) => `${r.loop}|${r.slot}|${r.biome}|${r.mv}|${r.mode}`))]) {
  const rs = runs.filter((r) => `${r.loop}|${r.slot}|${r.biome}|${r.mv}|${r.mode}` === key && r.setup === 'ok' && r.mv === r.mvWant);
  if (!rs.length) continue;
  const [loop, slot, biome, mv, mode] = key.split('|');
  const reg = Object.fromEntries(REG.map((g) => { const s = (f) => rs.reduce((a, r) => a + r.rec[g][f], 0), exp = s('exp');
    return [g, { secs: +(s('fr') / 60).toFixed(1), expSecs: +(exp / 60).toFixed(1), spawns: s('spawns'), spawnsPerMin: rate(s('spawns'), exp), hits: s('hits'), hitsPerMin: rate(s('hits'), exp), hitsPerSpawn: s('spawns') ? +(s('hits') / s('spawns')).toFixed(3) : null, snot: s('snot'), snotPerMin: rate(s('snot'), exp), unattr: s('unattr') }]; }));
  const aHits = reg.pre.hits + reg.post.hits, aExp = (reg.pre.expSecs + reg.post.expSecs) * 60, aRate = rate(aHits, aExp), aSp = rate(reg.pre.spawns + reg.post.spawns, aExp);
  pooled.push({ descent: +loop + 1, slot: +slot, biome, variant: `B${mv}`, mode, seeds: rs.map((r) => r.seed), deaths: rs.reduce((a, r) => a + r.deaths, 0), hazDeaths: rs.reduce((a, r) => a + r.hazDeaths, 0), regions: reg,
    A: { hitsPerMin: aRate, spawnsPerMin: aSp, snotPerMin: rate(reg.pre.snot + reg.post.snot, aExp), hitsPerSpawn: reg.pre.spawns + reg.post.spawns ? +(aHits / (reg.pre.spawns + reg.post.spawns)).toFixed(3) : null }, rho: aRate ? +(reg.band.hitsPerMin / aRate).toFixed(2) : null, sigmaRatio: aSp ? +(reg.band.spawnsPerMin / aSp).toFixed(2) : null });
}
const bad = runs.filter((r) => r.setup !== 'ok' || r.mv !== r.mvWant || r.errs.length).map((r) => ({ biome: r.biome, slot: r.slot, loop: r.loop, seed: r.seed, mode: r.mode, setup: r.setup, mv: r.mv, mvWant: r.mvWant, errs: r.errs }));
const notMeasured = ['the boss fight (runs stop at bossX - W)', 'B1 on Descent 1 (no first-visit B1)', "a real revisit's script remix (jump = first visit)", 'midboss-up frames (excluded from every region)', 'enemy-caused hits',
  ...[0, 1, 2].filter((l) => !LOOPS.includes(l)).map((l) => `Descent ${l + 1} (--loops)`), ...HOME.filter((x) => !BIOMES.includes(x)).map((x) => `biome ${x}`), ...[0, 1].filter((s) => !SLOTS.includes(s)).map((s) => `slot ${s}`)];
const res = { tool: 'band-haz-probe', layout: LAYOUT, pilot: PILOT_ARG, fire: FIRE, url, seeds: SEEDS, loops: LOOPS, modes: MODES, notMeasured, excludedRuns: bad, pooled, runs, wall_s: Math.round((Date.now() - t0) / 1000) };
if (OUT) writeFileSync(OUT, JSON.stringify(res, null, 1) + '\n'); else console.log(JSON.stringify(res));
const f = (v) => (v == null ? '-' : String(v));
console.error('\nD slot biome var  mode   | secs pre/band/post | spawns/min pre band post | hits/min pre band post | hits/spawn band | snot/min A band | rho  sigma | deaths(haz)');
for (const q of pooled) { const R_ = q.regions;
  console.error(`D${q.descent} s${q.slot} ${q.biome.padEnd(4)} ${q.variant} ${q.mode.padEnd(6)} | ${R_.pre.expSecs}/${R_.band.expSecs}/${R_.post.expSecs} | ${f(R_.pre.spawnsPerMin)} ${f(R_.band.spawnsPerMin)} ${f(R_.post.spawnsPerMin)} | ${f(R_.pre.hitsPerMin)} ${f(R_.band.hitsPerMin)} ${f(R_.post.hitsPerMin)} | ${f(R_.band.hitsPerSpawn)} | ${f(q.A.snotPerMin)} ${f(R_.band.snotPerMin)} | ${f(q.rho)} ${f(q.sigmaRatio)} | ${q.deaths}(${q.hazDeaths})`); }
if (bad.length) console.error(`excluded ${bad.length} run(s): ${JSON.stringify(bad).slice(0, 400)}`);
console.error(`not measured: ${notMeasured.join('; ')}\nband-haz-probe: ran on ${LAYOUT}, ${runs.length} runs in ${res.wall_s}s`);
await b.close();

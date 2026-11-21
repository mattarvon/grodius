// Boss probe: time-to-kill for every boss across loadout tiers, plus Gravity Drive laser lethality.
// Invincible bot parks at x=90 and tracks the boss's current weak point, holding fire. Needs the VITE DEV server
// (imports live modules). Usage: node tools/boss-probe.mjs http://localhost:4202/ [capSeconds=150] [--layout long4|short] [--ord <stage>]
//  --ord <stage> sets G.stage to that stage ordinal just before a biome boss spawns (not the Drive or THE KEEPSAKE),
//  so its depth and any stage-order HP read that stage: --ord 2 = biome slot B's boss on slot A's x. Off: as before
//  World x comes from src/layout.ts: biome bosses fight at slot 0's x0 + 700 (3000 on short), the Drive at bossAt().
//  THE KEEPSAKE (D55) fights where bossFor places it: slot 1 built for real (biomeStage, so its arena terrain is there),
//  the scroll held 200 px past the slot's boss x, Descent 1; the bot aims at its wound (e.y + e.wy, turned with the tilt).
//  It is skipped on short (never placed there). HPX=1.4 env: scale its HP after the spawn (a stage-order HP multiplier
//  landing later, so the band can be checked with it applied); the FLOOR line checks STRONG D1 >= 15 s (D55)
//  TTK  = seconds from the boss becoming hittable to dead (or "esc" if it escaped / "--" if it outlived the cap)
//  LASER = per Gravity Drive beam: hits that land on a ship sitting in the beam with a full WARD, and whether it dies
// W5 (DIFFICULTY-SPEC §3.1, measure-only):
//  Every TTK fight also reports the enemy bullets on screen (counted shots), max and p90 over every loadout's fight,
//  against the stage-boss cap (24 on Normal; B3: max <= cap, p90 <= .6 cap).
//  --kind <k>[,<k>...] flies only those bosses (maw, crux, butcher, gravity or drive, keepsake).
//  --spots: the 8-spot park grid (probe-lib SPOTS), the ship parked (clamped into the open band), fire held with
//    --spot-kit (default END DESCENT 1); would-be hits by phase (the Drive's b.phase, THE KEEPSAKE's m.ph, else the
//    half rule), each shot once and every other contact once per touch. K1: >= 2 in every reached phase on every spot.
//  --timeout: K4. Per boss, a NAKED ship parks level with it at x 90 and never fires, up to capSeconds: reports how the
//    fight ended (esc = it left; a kill with HP left = a self-destruct; none = no time-out) and whether the run plays on.
import { chromium } from 'playwright';
import { useLayout, ranOn } from './layout-arg.mjs';
import { pageLib, SPOTS, spotSummary, hq, hmax, CAPS } from './probe-lib.mjs';
const flag = (n) => { const i = process.argv.indexOf(n); if (i < 0) return false; process.argv.splice(i, 1); return true; };
const optv = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv.splice(i, 2)[1] : null; };
const SPOTM = flag('--spots'), TIMEOUT = flag('--timeout'), SPOTKIT = optv('--spot-kit') || 'END DESCENT 1';
const KINDS = (optv('--kind') || '').split(',').filter(Boolean).map((k) => (k === 'drive' ? 'gravity' : k));
const oi = process.argv.indexOf('--ord'), ORD = oi >= 0 ? +process.argv.splice(oi, 2)[1] : null;
if (ORD != null && !(ORD >= 0)) { console.error('--ord needs a stage ordinal, e.g. --ord 2'); process.exit(2); }
const [url, CAP = '150'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { let now = 0; performance.now = () => now; window.requestAnimationFrame = () => 1; window.setTimeout = () => 0; window.speechSynthesis = undefined; try { localStorage.clear(); } catch (e) {} });
await p.addInitScript(pageLib);
await p.goto(url); await p.waitForFunction(() => window.__started, null, { timeout: 20000 });
await p.evaluate(() => window.__PL.load());
await useLayout(p, 'boss-probe', { limits: 'fights are staged in Open Orbit, biome slot 0 and the Drive only; later biome slots and interior stages are not' });
// loadouts: what a player plausibly carries into each fight (seals cap you; see stages.ts SEAL_TXT)
const L = [
  ['NAKED (died)', {}, {}, {}],
  ['STAGE 1 kit', { speed: 2, missile: 1, double: 1, options: 1, wardLv: 1 }, { cal: 1 }, { dmg: 1 }],
  // D58: what a run carries into biome slot B (pod-probe warns[].kit.pow .55-.84 at slot B's WARNINGs on the D31 build)
  ['BIOME B kit', { speed: 3, missile: 2, double: 1, options: 2, wardLv: 1 }, { cal: 1, rapid: 1 }, { dmg: 1, rof: 1, crit: 2 }],
  ['END DESCENT 1', { speed: 3, missile: 2, double: 1, options: 2, wardLv: 2 }, { cal: 1, rapid: 1 }, { dmg: 2, rof: 1, crit: 2 }],
  ['STRONG D1', { speed: 4, missile: 2, laser: 1, options: 2, wardLv: 2 }, { cal: 2, serr: 1, rapid: 1 }, { dmg: 3, rof: 2, crit: 3, volatile: 2, teeth: 2 }],
];
const BOSSES = ['maw', 'crux', 'butcher', 'gravity', 'keepsake'].filter((k) => !KINDS.length || KINDS.includes(k));
if (!BOSSES.length) { console.error(`--kind: none of ${KINDS} is a boss`); process.exit(2); }
if (SPOTM && !L.find((r) => r[0] === SPOTKIT)) { console.error(`--spot-kit: no loadout ${SPOTKIT}`); process.exit(2); }
const HPX = +(process.env.HPX || 1);
const res = await p.evaluate(async ([L, BOSSES, CAP, HPX, ORD, SPOTM, TIMEOUT, SPOTS, SPOTKIT]) => {
  const S = await import('/src/state.ts'), W = await import('/src/world.ts'), ST = await import('/src/step.ts'), F = await import('/src/flow.ts');
  const SP = await import('/src/enemies/spawn.ts'), BU = await import('/src/boss/update.ts'), C = await import('/src/core.ts'), LY = await import('/src/layout.ts');
  const IN = await import('/src/input.ts'); const $ = S.$; $.gate = false; IN.K.KeyZ = true;
  const BI = await import('/src/biomes.ts'), REG = await import('/src/enemies/boss/registry.ts');
  const PL = window.__PL;
  /** THE KEEPSAKE's stage: slot 1 built as a run would build it (its arena terrain), the scroll where its fight holds */
  const keepStage = () => {
    const G = $.G, r1 = LY.slotRow(1), r0 = LY.slotRow(0);
    G.route = ['ice', 'fire']; G.bx = [r0.gateLate ?? r0.x0, r1.gateLate ?? r1.x0, null]; G.visitNo = [0, 0];
    BI.biomeStage(1, G.bx[1]);
    G.stage = LY.stageOfSlot(1); // its real stage ordinal, so stage-order HP (D58 #2) and depth read slot B, not Orbit
    return r1.bossX + 200;
  };
  const hasKeep = !!LY.layout().picker;
  const out = {};
  const setup = (pw, gm, pkk, scroll) => {
    F.newGame(0); $.state = 'play';
    for (let i = 0; i < 30; i++) ST.step();
    Object.assign($.P, { speed: 0, missile: 0, double: 0, laser: 0, pyre: 0, options: 0, wardLv: 0, shield: 0 }, pw);
    if ($.P.wardLv) $.P.shield = 3;
    $.G.gm = { ...gm }; $.G.pk = { ...pkk }; $.G.lvl = 10;
    $.G.scroll = scroll; $.G.si = $.G.script.length; // no scripted spawns: just the boss
    W.enemies.length = 0; W.eshots.length = 0; W.caps.length = 0; W.shots.length = 0;
    const sv = $.G.scroll; ST.step(); $.G.scroll = sv; // one world step so G.rank reflects this loadout before the boss spawns
    W.enemies.length = 0; W.eshots.length = 0; W.shots.length = 0;
  };
  const park = (y, x = 90) => { $.P.hist.unshift({ x, y }); if ($.P.hist.length > 80) $.P.hist.pop(); Object.assign($.P, { x, y, alive: true, inv: 30 }); $.G.pick = null; $.G.pickQ = 0; };
  /** the rank this loadout flies at: src/rank.ts once W0 lands, else the old G.rank, else n/a */
  const rankNow = () => { const r = PL.rank(); return r != null ? r : typeof $.G.rank === 'number' ? +$.G.rank.toFixed(2) : 'n/a'; };
  /** one fight: spot = [x, y] parks the ship there and counts would-be hits; noFire holds fire off (the time-out) */
  const fight = (k, pw, gm, pkk, name, spot, noFire) => {
    setup(pw, gm, pkk, k === 'gravity' ? LY.bossAt() : LY.slotRow(0).x0 + 700);
    if (k === 'keepsake') { const sx = keepStage(); $.G.scroll = sx; $.G.si = $.G.script.length; W.enemies.length = 0; REG.BOSS_SIM.keepsake.spawn('fire'); const m = $.G.mini; m.hp *= HPX; m.max = m.hp; }
    else if (k === 'gravity') BU.startBoss();
    else { if (ORD != null) $.G.stage = ORD; if (k === 'maw') SP.maw(true); else SP[k](); }
    IN.K.KeyZ = !noFire;
    const bh = {}, acc = PL.spotNew();
    let f = 0, t0 = -1, r = '--', hpLeft = null;
    for (; f < CAP * 60 + 600; f++) {
      let ty = $.P.y;
      if (k === 'gravity') {
        const B = $.G.boss; if (!B) { r = 'esc'; break; } // gone without dying: it left
        if (B.dying) { r = ((f - t0) / 60).toFixed(1); hpLeft = B.plates ? null : null; break; }
        if (!B.enter && t0 < 0) t0 = f;
        const pl = B.plates.filter((q) => q.hp > 0).sort((a, b) => Math.abs(Math.sin(a.a)) - Math.abs(Math.sin(b.a)))[0];
        ty = pl ? B.y + Math.sin(pl.a) * 42 : B.y;
        if (B.hp != null && B.max) hpLeft = +(B.hp / B.max).toFixed(2);
      } else {
        const m = $.G.mini;
        if (!m || m.dead) { r = m && m.x > C.W + 50 ? 'esc' : ((f - Math.max(0, t0)) / 60).toFixed(1); break; }
        if (t0 < 0 && m.x < C.W - 20) t0 = f;
        ty = m.y + (k === 'keepsake' ? m.wy || 0 : 0);
        hpLeft = +(m.hp / m.max).toFixed(2);
        if (k === 'keepsake' && name) { (out.kp ||= {})[name] = { ph: m.ph, rage: m.rage, hp: +(m.hp / m.max).toFixed(3) }; }
      }
      const x = spot ? spot[0] : 90, y = spot ? PL.spotY(spot[0], spot[1], $.G.scroll) : C.clamp(ty, 8, C.PH - 8);
      park(y, x); if (spot) { $.P.shield = 0; $.P.aegis = 0; } // a spot ship has no WARD: it eats shots inside 16 px and would hide them
      ST.step();
      if (t0 >= 0) { PL.fightBul(bh); if (spot) { const m = k === 'gravity' ? $.G.boss : $.G.mini; if (m && !m.dead && !m.dying) PL.spotFrame(acc, window.__G(), x, y, PL.phase(m, k === 'gravity')); } }
    }
    if (t0 >= 0 && f - t0 > CAP * 60) r = '--';
    IN.K.KeyZ = true;
    return { r, bh, ph: acc.ph, s: +((f - Math.max(0, t0)) / 60).toFixed(1), hpLeft, state: $.state };
  };
  const bul = {};
  for (const [name, pw, gm, pkk] of L) {
    const row = {};
    for (const k of BOSSES) {
      if (k === 'keepsake' && !hasKeep) { row[k] = 'n/a'; continue; }
      const o = fight(k, pw, gm, pkk, name);
      row[k] = o.r; bul[k] ||= {}; for (const [n, c] of Object.entries(o.bh)) bul[k][n] = (bul[k][n] || 0) + c;
      (out.rank ||= {})[name] = rankNow();
    }
    out[name] = row;
  }
  const spots = {};
  if (SPOTM) { const kit = L.find((r) => r[0] === SPOTKIT);
    for (const k of BOSSES) { if (k === 'keepsake' && !hasKeep) continue; spots[k] = SPOTS.map((sp) => { const o = fight(k, kit[1], kit[2], kit[3], null, sp); return { spot: sp, end: o.r, ph: o.ph }; }); } }
  const tmo = {};
  if (TIMEOUT) for (const k of BOSSES) { if (k === 'keepsake' && !hasKeep) continue; const o = fight(k, {}, {}, {}, null, null, true); tmo[k] = { end: o.r, s: o.s, hpLeft: o.hpLeft, state: o.state }; }
  // THE KEEPSAKE's crier (D55 studio review): real STAGE 1 kit bolts at it, the bot parked level with it, from the frame
  // it appears (HP set to CRACKED's cut). Twice: as the game runs (shots.ts gives a boss's parts the hit first) and with
  // e.parts removed (the old order: the head's body circle took every shot). Want: broken in under ~3 s
  const crier = [];
  if (hasKeep) for (const prio of [true, false]) {
    setup(...L[1].slice(1), 0);
    const sx = keepStage(); $.G.scroll = sx; $.G.si = $.G.script.length; W.enemies.length = 0; REG.BOSS_SIM.keepsake.spawn('fire');
    const m = $.G.mini; m.hp = m.max * .299; m.wins = 9; m.d0 = 9; // past both staged floors (D59: DOZING's attack floor)
    let f = 0, t0 = -1, r = '--';
    for (; f < 60 * 30; f++) {
      if (m.crier && t0 < 0) { t0 = f; if (!prio) m.parts = null; }
      if (m.crier && m.crier.dead) { r = ((f - t0) / 60).toFixed(1); break; }
      park(C.clamp(m.crier ? m.crier.y : m.y, 8, C.PH - 8)); $.G.lives = 9; W.eshots.length = 0;
      if (m.hp < m.max * .05) m.hp = m.max * .2; // keep the head alive while the crier is under fire
      ST.step();
    }
    crier.push(r);
  }
  // laser lethality: full WARD (3), parked dead in the beam's path for the whole sweep
  const lz = [];
  setup({ wardLv: 2 }, {}, {}, LY.bossAt()); BU.startBoss();
  const B = $.G.boss; for (const q of B.plates) q.hp = 0; // skip to phase 1 (eye open)
  let sweeps = 0, hits0 = 0, inBeam = false, died = false;
  for (let f = 0; f < 60 * 40 && sweeps < 4; f++) {
    $.G.st.hits = $.G.st.hits || 0;
    const Lz = $.G.boss && $.G.boss.laser;
    if (Lz && Lz.beam > 0 && !inBeam) { inBeam = true; hits0 = $.G.st.hits; $.P.shield = 3; $.P.alive = true; died = false; }
    // sit on the beam's line, 190px (outside tentacle reach) from the eye
    if ($.G.boss) { const a = Lz ? Lz.ang : Math.PI; $.P.x = C.clamp($.G.boss.x + Math.cos(a) * 190, 12, C.W - 20); $.P.y = C.clamp($.G.boss.y + Math.sin(a) * 190, 8, C.PH - 8); }
    if (!$.P.alive) died = true;
    if (!Lz || Lz.beam <= 0) { if (inBeam) { lz.push({ hits: $.G.st.hits - hits0, died }); sweeps++; } inBeam = false; if ($.P.inv > 0 && !Lz) $.P.inv = 0; }
    $.P.alive = true; $.G.lives = 9; W.eshots.length = 0; W.enemies.length = 0; // beam only
    ST.step();
  }
  const rank = out.rank; delete out.rank; delete out.kp;
  return { out, lz, rank, crier, bul, spots, tmo };
}, [L, BOSSES, +CAP, HPX, ORD, SPOTM, TIMEOUT, SPOTS, SPOTKIT]);
const NAME = { maw: 'MAW', crux: 'CRUCIFER', butcher: 'BUTCHER', gravity: 'GRAV DRIVE', keepsake: 'KEEPSAKE' };
if (ORD != null) console.log(`biome bosses at stage ordinal ${ORD} (THE KEEPSAKE fights in its own placed stage)`);
console.log('rank per loadout:', JSON.stringify(res.rank));
console.log('loadout'.padEnd(16), ...BOSSES.map((k) => NAME[k].padStart(11)));
for (const [n, r] of Object.entries(res.out)) console.log(n.padEnd(16), ...BOSSES.map((k) => String(r[k]).padStart(11)));
if (res.out['STRONG D1'] && res.out['STRONG D1'].keepsake != null && res.out['STRONG D1'].keepsake !== 'n/a') { const v = parseFloat(res.out['STRONG D1'].keepsake); console.log(`KEEPSAKE FLOOR (STRONG D1 >= 15 s): ${isNaN(v) ? res.out['STRONG D1'].keepsake : v >= 15 ? 'PASS ' + v : 'FAIL ' + v}${HPX !== 1 ? ` (HP x${HPX})` : ''}`); }
if (res.crier.length) console.log(`KEEPSAKE CRIER (STAGE 1 kit, bot level with it): broken in ${res.crier[0]} s with part priority (want < 3: ${parseFloat(res.crier[0]) < 3 ? 'PASS' : 'FAIL'}); ${res.crier[1]} s without it (the old hit order)`);
console.log('LASER sweeps vs full WARD (3):', res.lz.map((s) => `${s.hits} hits${s.died ? ' DEAD' : ''}`).join(', ') || 'none observed');
{ const cap = CAPS.boss[1];
  console.log(`bullets on screen per fight (all loadouts' fights pooled; cap ${cap} = Normal stage boss; B3: max <= ${cap}, p90 <= ${(.6 * cap).toFixed(1)}):`);
  for (const k of BOSSES) { const h = res.bul[k]; if (!h) continue; const mx = hmax(h), p9 = hq(h, .9); console.log(`  ${NAME[k].padEnd(11)} max ${String(mx).padStart(3)}  p90 ${String(p9).padStart(3)}  ${mx != null && mx <= cap && p9 <= .6 * cap ? 'PASS' : 'FAIL'}`); }
  console.log('BULLETS ' + JSON.stringify(Object.fromEntries(BOSSES.filter((k) => res.bul[k]).map((k) => [k, { max: hmax(res.bul[k]), p90: hq(res.bul[k], .9), cap }])))); }
if (SPOTM) {
  console.log(`SPOT GRID (${SPOTKIT}, ship parked, fire held; hits per phase p0/p1/p2; K1 wants >= 2 in every reached phase):`);
  for (const [k, rows] of Object.entries(res.spots)) { const s = spotSummary(rows);
    console.log(`  ${NAME[k].padEnd(11)} ${rows.map((r) => `${r.spot.join(',')}:${['0', '1', '2'].map((q) => (r.ph[q] ? r.ph[q].hits : '-')).join('/')}${r.end === 'esc' ? 'e' : r.end === '--' ? '+' : ''}`).join('  ')}  min ${s.min} phases [${s.phases}] ${s.pass ? 'PASS' : 'FAIL'}`);
    console.log(`  ${''.padEnd(11)} hit sources: ${JSON.stringify(s.share)}`); }
  console.log('SPOTS ' + JSON.stringify(Object.fromEntries(Object.entries(res.spots).map(([k, rows]) => [k, { ...spotSummary(rows), spots: rows.map((r) => ({ spot: r.spot, end: r.end, ph: Object.fromEntries(Object.entries(r.ph).map(([q, v]) => [q, v.hits])) })) }]))));
}
if (TIMEOUT) {
  console.log('TIME-OUT (NAKED, no fire, cap ' + CAP + ' s): ' + Object.entries(res.tmo).map(([k, o]) => `${NAME[k]} ${o.end === 'esc' ? `left at ${o.s}s` : o.end === '--' ? `NO TIME-OUT by ${o.s}s` : o.hpLeft > .05 ? `self-destruct at ${o.end}s (hp ${o.hpLeft})` : `killed ${o.end}s`} (${o.state})`).join(' | '));
  console.log('TIMEOUT ' + JSON.stringify(res.tmo));
}
console.log('errors:', errs.slice(0, 5).join(' | ') || 'none'); ranOn('boss-probe'); await b.close();

// @ts-nocheck
// The hand-made stage scripts: Open Orbit (stage 0) and the Gravity Drive approach (stage 3). The biome stages in
// between are scripted per gate in biomes.ts. See docs/pacing.md ("Open Orbit and the Drive approach, remixed").
//
// Each script is cut into sections, and each section has several hand-made variants. Descent 1 always plays variant 0
// (the tuned script new players learn; it never comes back later). From Descent 2 on, every section picks a remix with
// the gameplay RNG at build time (so a seed replays the same run), preferring ones this run hasn't played yet and never
// repeating last descent's; some set pieces only unlock in Descent 3+ (`min`). The fixed beats stay put whatever is
// picked: the Saucer's WARNING at UFO_AT and its filler-skip window (ufo.ts), the "SOMETHING IS COMING" breath and the
// Maw, the corridor's wall eyes, WARNING: GRAVITY WELL CRITICAL and the breath of drifting crew before the Drive.
//
// Drone budget: formation() adds round(3 * rank) drones to every wave, so from late Descent 1 on a "wave of 3" is 6.
// Each script keeps to about three drone formations and fills the rest with corpses, sentries, flayers and hatchlings
// (and in the corridor, which has a floor and a ceiling at its start, a mutant, crawlers or a womb) to hold drones near
// 35-40% of a stage's spawns.
import { $ } from '../state';
import { PH, W, ri } from '../core';
import { row, ufoDrift, ufoRow } from '../layout';
import { sfx } from '../audio';
import { startBoss } from '../boss/update';
import { ufoWarn } from './ufo';
import { banner, behindWave, corpse, crawler, eyeT, flayer, formation, hatch, logLine, maw, mutant, sentry, womb } from './spawn';

const crew = (...ys) => ys.forEach(y => corpse(y));

/** pick a section's variant: 0 (the classic) in Descent 1, else an unlocked remix this run hasn't played yet, and
 *  never last descent's */
function pickV(key, vs, L) {
  const m = ($.G.remixV ||= {}), h = (m[key] ||= { used: [], last: -1 }); // per-section variant memory, kept across descents
  let i = 0;
  if (L > 0) {
    const ok = vs.map((v, j) => j).filter(j => j > 0 && vs[j].min <= L && j !== h.last);
    const fresh = ok.filter(j => !h.used.includes(j)), pool = fresh.length ? fresh : ok;
    i = pool[ri(0, pool.length - 1)];
  }
  h.last = i;
  if (!h.used.includes(i)) h.used.push(i);
  return vs[i];
}
const V = (min, f) => Object.assign(f, { min });

// ---------------- OPEN ORBIT ----------------
// Open Orbit x is relative to the orbit row's x0 (0 in every layout so far)
// A: intro + build, 200..760 (always plays: the Saucer's WARNING is at 800)
const ORBIT_A = [
  // 0, the classic: one idea per wave. drones, crew, the lone sentry, a hatchling swarm, divers
  V(0, (at) => {
    at(200, () => formation('sine', 80));
    at(400, () => formation('sine', 175, 4));
    at(500, () => crew(60, 200));
    at(580, () => sentry(PH * .32));
    at(660, () => hatch(5, false));
    at(730, () => formation('dive', 50, 4));
  }),
  // 1, debris field: the crew drifts in first and the drones weave through it; a sentry pair keeps watch
  V(1, (at) => {
    at(200, () => corpse(55)); at(225, () => corpse(205)); at(250, () => corpse(130));
    at(300, () => formation('sine', PH / 2, 3));
    at(420, () => { sentry(PH * .24, W * .8); sentry(PH * .74, W * .64); });
    at(560, () => flayer(PH * .6));
    at(650, () => hatch(6, false));
    at(720, () => crew(70, 190));
  }),
  // 2, ambush: the first wave comes from BEHIND, then crew, a hatchling swarm head-on, sentries high and low
  V(1, (at) => {
    at(200, () => behindWave(PH / 2, 3));
    at(330, () => crew(60, 200));
    at(420, () => hatch(5, false));
    at(520, () => sentry(PH * .66));
    at(600, () => flayer(PH * .35));
    at(700, () => { sentry(PH * .25, W * .8); corpse(PH * .8); });
  }),
  // 3, the sentry picket (Descent 3+): two pods park high and low and a zig wave runs the gap between them; crew, a
  // flayer, a swarm from behind
  V(2, (at) => {
    at(200, () => sentry(PH * .22, W * .78));
    at(250, () => sentry(PH * .78, W * .7));
    at(330, () => formation('zig', PH / 2, 3));
    at(470, () => crew(50, 135, 220));
    at(570, () => flayer(PH * .5));
    at(660, () => hatch(6, true));
  })
];
// C: the peak, 900..1840. Eaten while the Saucer is up (runScript / $.G.eat), so how much of it you see depends on how
// fast you kill the Saucer; the early entries only play for very fast kills
const ORBIT_C = [
  // 0, the classic
  V(0, (at) => {
    at(980, () => formation('wall', PH / 2));
    at(1040, () => { sentry(PH * .22, W * .8); sentry(PH * .74, W * .66); });
    at(1100, () => hatch(6, true));
    at(1220, () => { crew(60); corpse(150); });
    at(1320, () => flayer(PH * .3));
    at(1400, () => sentry(PH * .7));
    at(1500, () => behindWave(PH / 2));
    at(1620, () => crew(40, 120, 210));
    at(1700, () => flayer(PH * .7));
    at(1760, () => hatch(5, false));
  }),
  // 1, brood swarm: hatchling floods from both sides, sentries guarding, one sine and one dive
  V(1, (at) => {
    at(1000, () => hatch(6, false));
    at(1120, () => { sentry(PH * .25, W * .78); sentry(PH * .72, W * .64); });
    at(1200, () => hatch(6, true));
    at(1300, () => { formation('sine', 70, 3); corpse(195); });
    at(1420, () => flayer(PH * .4));
    at(1500, () => { hatch(5, false); corpse(60); });
    at(1600, () => formation('dive', PH - 60, 3));
    at(1700, () => sentry(PH * .5));
    at(1780, () => crew(70, 190));
  }),
  // 2, flayer alley: flayer pairs over a slow drone wall, then a rear wave, a swarm from behind and a late sentry
  V(1, (at) => {
    at(1000, () => crew(80, 180));
    at(1120, () => { flayer(PH * .25); flayer(PH * .75); });
    at(1250, () => formation('wall', PH / 2, 3));
    at(1360, () => crew(45, 135, 225));
    at(1440, () => behindWave(PH * .3, 3));
    at(1540, () => flayer(PH * .5));
    at(1640, () => hatch(6, true));
    at(1760, () => { sentry(PH * .62); corpse(PH * .2); });
  }),
  // 3, hull breach (Descent 3+): the derelict vents its crew, a corpse cascade under sentry cover, then divers from
  // above and below
  V(2, (at) => {
    at(1100, () => logLine('HULL BREACH. THE CREW IS COMING OUT.'));
    [1110, 1140, 1170, 1200, 1230, 1260].forEach((x, i) => at(x, () => corpse(i % 2 ? PH * .7 + i * 4 : PH * .28 - i * 4, { drift: .7 })));
    at(1180, () => sentry(PH * .2, W * .82));
    at(1320, () => { formation('dive', 40, 3); formation('dive', PH - 40, 3); });
    at(1440, () => hatch(7, true));
    at(1560, () => { flayer(PH * .3); flayer(PH * .7); });
    at(1680, () => { sentry(PH * .3, W * .78); sentry(PH * .7, W * .64); });
    at(1780, () => crew(60, 200));
  })
];
// D: the run-up, 1880 + 1900 (always plays: the Saucer is gone by 1840), then the breath and the Maw
const ORBIT_D = [
  V(0, (at) => { at(1880, () => hatch(8, false)); at(1900, () => flayer(PH * .4)); }),
  V(1, (at) => { at(1880, () => { sentry(PH * .5, W * .75); formation('zig', PH * .8, 3); }); at(1900, () => { hatch(5, true); corpse(PH * .2); }); }),
  V(1, (at) => { at(1880, () => behindWave(PH / 2, 3)); at(1900, () => { flayer(PH * .4); corpse(PH * .8); }); })
];

// ---------------- THE GRAVITY DRIVE APPROACH (PHASE 4) ----------------
// x here is relative to the Drive stage row's x0 (src/layout.ts; short: world 8300, where the biome terrain hands back).
// The MERIDIAN corridor's floor gives out at ~680 (the drop into the drive chamber), and a mutant spawns at
// scroll + W + 24, so mutants only fit at ~130..170, right at the start. E: the corridor gauntlet, 130..430, ending on
// the wall eyes
const DRIVE_E = [
  // 0, the classic: the first mutant, alone on the floor, then a high sine, crew and divers
  V(0, (at) => {
    at(140, () => mutant());
    at(220, () => formation('sine', PH * .25, 4));
    at(280, () => crew(70, PH - 70));
    at(350, () => hatch(5, true));
  }),
  // 1, the hulk: a mutant on the floor, crawlers on the ceiling and a sine wave down the middle, then crew, a sentry
  // and a hatchling swarm (the corridor's floor and ceiling only reach this far, so they all come in at once)
  V(1, (at) => {
    at(140, () => { mutant(); crawler(-1); });
    at(165, () => { crawler(-1); formation('sine', PH * .45, 4); });
    at(260, () => crew(80, 150));
    at(330, () => sentry(PH * .3, W * .74));
    at(400, () => hatch(6, false));
  }),
  // 2, crew drift: the dead are being pulled aft over a mutant's head, a womb clings to the ceiling, a zig wave
  // inside the drift, then a flayer
  V(1, (at) => {
    at(140, () => mutant());
    at(160, () => womb());
    [150, 170, 190, 210].forEach((x, i) => at(x, () => corpse([45, 125, 80, 150][i], { drift: .8 })));
    at(250, () => formation('zig', PH * .42, 4));
    at(320, () => flayer(PH * .55));
    at(390, () => hatch(5, false));
  }),
  // 3, lockdown (Descent 3+): no meat this time, the MERIDIAN's machines. A sentry pair seals the corridor, a drone
  // wall, a swarm from behind, crew
  V(2, (at) => {
    at(150, () => { sentry(PH * .25, W * .8); sentry(PH * .65, W * .66); });
    at(240, () => formation('wall', PH * .45, 4));
    at(320, () => hatch(6, true));
    at(390, () => crew(60, 130, 200));
  })
];
// F: rising pressure, 460..700, up to the WARNING at the row's warnX (short: 760)
const DRIVE_F = [
  // 0, the classic
  V(0, (at) => {
    at(460, () => sentry(PH * .45, W * .72));
    at(490, () => behindWave(PH / 2));
    at(550, () => { flayer(PH * .75); corpse(PH * .3); });
    at(620, () => hatch(6, false));
    at(690, () => { flayer(PH * .25); flayer(PH * .7); });
  }),
  // 1, meat in the wind: a rear wave, a swarm through the crew, a sentry pair, a flayer pair
  V(1, (at) => {
    at(470, () => behindWave(PH / 2, 4));
    at(550, () => { hatch(6, false); crew(50, 210); });
    at(620, () => { sentry(PH * .3, W * .78); sentry(PH * .7, W * .64); });
    at(690, () => { flayer(PH * .25); flayer(PH * .7); });
  }),
  // 2, gauntlet: a swarm from behind, a drone wall, a sentry over a flayer, a late sine
  V(1, (at) => {
    at(470, () => hatch(7, true));
    at(550, () => { formation('wall', PH / 2, 4); corpse(PH * .85); });
    at(630, () => { sentry(PH * .25, W * .76); flayer(PH * .7); });
    at(695, () => formation('sine', PH * .72, 4));
  }),
  // 3, the crew wakes (Descent 3+): the drifting dead turn out to be flayers, and the brood pours in behind them
  V(2, (at) => {
    at(460, () => { logLine('THE CREW IS STILL MOVING IN THERE.'); crew(60, 130, 200); });
    at(520, () => { flayer(PH * .3); flayer(PH * .7); });
    at(600, () => { hatch(6, true); sentry(PH * .5, W * .8); });
    at(680, () => { formation('zig', PH * .4, 4); corpse(PH * .8); });
  })
];

// the hand-made sections of each non-biome stage kind, in the order their variants are picked (pickStageVariants)
const SECTIONS = { orbit: [['oA', ORBIT_A], ['oC', ORBIT_C], ['oD', ORBIT_D]], drive: [['dE', DRIVE_E], ['dF', DRIVE_F]] };
/** the build-time variant picks of a descent: every hand-made section's remix, drawn with the sim R() at startLoop in
 *  today's order (oA, oC, oD, dE, dF; nothing is drawn in Descent 1). The pick is kept in G.remixV[key].last, which
 *  stageScript reads, so placing a stage draws nothing. B2 moves these draws onto the per-stage build stream. */
export function pickStageVariants(L) {
  for (const k of ['orbit', 'drive']) for (const [key, vs] of SECTIONS[k]) pickV(key, vs, L);
}
/** the section variant this descent plays (picked by pickStageVariants) */
const played = (key, vs) => vs[$.G.remixV[key].last];

/** the script entries of non-biome stage i (Open Orbit, the Drive approach), in world x, unsorted; [] for a biome
 *  stage (biomes.ts biomeStage scripts those at the gate). Places the variants pickStageVariants picked: no R() draw */
export function stageScript(i) {
  const r = row(i), S = [],
    // script x values are relative to their stage row's x0 (src/layout.ts); `at` places them in world x
    stageAt = (rr) => (x, f) => S.push({ x: rr.x0 + x, f });
  if (r.kind === 'orbit') {
    // PHASE 1: open orbit, the derelict looming
    const oAt = stageAt(r);
    played('oA', ORBIT_A)(oAt);
    if (ufoRow() === r) stageAt(r)(ufoDrift().at, ufoWarn); // THE SQUIDFUCKED SAUCER, the Open Orbit midboss (enemies/ufo.ts): eats the filler while it's up
    played('oC', ORBIT_C)(oAt);
    played('oD', ORBIT_D)(oAt);
    oAt(r.warnX - r.x0, () => {
      banner('SOMETHING IS COMING', 'MASS READING: ORGANIC', undefined, 150);
      sfx.dread();
    });
    oAt(r.bossX - r.x0, () => maw(true));
  } else if (r.kind === 'drive') {
    // PHASE 4: the Gravity Drive approach: corridor gauntlet, rising pressure, WARNING, a breath
    const dAt = stageAt(r), warn = r.warnX - r.x0;
    dAt(130, () => logLine('GRAVITY RISING. THE HULL IS BEING PULLED AFT.'));
    played('dE', DRIVE_E)(dAt);
    dAt(430, () => { eyeT(1); eyeT(-1); });
    played('dF', DRIVE_F)(dAt);
    dAt(warn, () => { banner('WARNING', 'GRAVITY WELL CRITICAL', '#ff2a2a', 200); sfx.siren(); $.G.glitch = 14; });
    dAt(warn + 90, () => { corpse(PH * .3, { drift: .2 }); corpse(PH * .65, { drift: .2 }); }); // the breath: crew dragged toward the drive
    dAt(r.bossX - r.x0, () => startBoss());
  }
  return S;
}

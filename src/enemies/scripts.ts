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
import { BOSS_AT, PH, W, ri } from '../core';
import { sfx } from '../audio';
import { startBoss } from '../boss/update';
import { UFO_AT, ufoWarn } from './ufo';
import { banner, behindWave, corpse, crawler, eyeT, flayer, formation, hatch, logLine, maw, mutant, sentry, womb } from './spawn';

const crew = (...ys) => ys.forEach(y => corpse(y));

/** pick a section's variant: 0 (the classic) in Descent 1, else an unlocked remix this run hasn't played yet, and
 *  never last descent's */
function pickV(key, vs, L) {
  const m = ($.G.remix ||= {}), h = (m[key] ||= { used: [], last: -1 });
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

// ---------------- THE GRAVITY DRIVE APPROACH (PHASE 4, stage 3 starts ~8370) ----------------
// The MERIDIAN corridor's floor gives out at world x ~8980 (the drop into the drive chamber), and a mutant spawns at
// scroll + W + 24, so mutants only fit at scroll ~8430..8470, right at the start. E: the corridor gauntlet,
// 8430..8730, ending on the wall eyes
const DRIVE_E = [
  // 0, the classic: the first mutant, alone on the floor, then a high sine, crew and divers
  V(0, (at) => {
    at(8440, () => mutant());
    at(8520, () => formation('sine', PH * .25, 4));
    at(8580, () => crew(70, PH - 70));
    at(8650, () => hatch(5, true));
  }),
  // 1, the hulk: a mutant on the floor, crawlers on the ceiling and a sine wave down the middle, then crew, a sentry
  // and a hatchling swarm (the corridor's floor and ceiling only reach this far, so they all come in at once)
  V(1, (at) => {
    at(8440, () => { mutant(); crawler(-1); });
    at(8465, () => { crawler(-1); formation('sine', PH * .45, 4); });
    at(8560, () => crew(80, 150));
    at(8630, () => sentry(PH * .3, W * .74));
    at(8700, () => hatch(6, false));
  }),
  // 2, crew drift: the dead are being pulled aft over a mutant's head, a womb clings to the ceiling, a zig wave
  // inside the drift, then a flayer
  V(1, (at) => {
    at(8440, () => mutant());
    at(8460, () => womb());
    [8450, 8470, 8490, 8510].forEach((x, i) => at(x, () => corpse([45, 125, 80, 150][i], { drift: .8 })));
    at(8550, () => formation('zig', PH * .42, 4));
    at(8620, () => flayer(PH * .55));
    at(8690, () => hatch(5, false));
  }),
  // 3, lockdown (Descent 3+): no meat this time, the MERIDIAN's machines. A sentry pair seals the corridor, a drone
  // wall, a swarm from behind, crew
  V(2, (at) => {
    at(8450, () => { sentry(PH * .25, W * .8); sentry(PH * .65, W * .66); });
    at(8540, () => formation('wall', PH * .45, 4));
    at(8620, () => hatch(6, true));
    at(8690, () => crew(60, 130, 200));
  })
];
// F: rising pressure, 8760..9000, up to the WARNING at 9060
const DRIVE_F = [
  // 0, the classic
  V(0, (at) => {
    at(8760, () => sentry(PH * .45, W * .72));
    at(8790, () => behindWave(PH / 2));
    at(8850, () => { flayer(PH * .75); corpse(PH * .3); });
    at(8920, () => hatch(6, false));
    at(8990, () => { flayer(PH * .25); flayer(PH * .7); });
  }),
  // 1, meat in the wind: a rear wave, a swarm through the crew, a sentry pair, a flayer pair
  V(1, (at) => {
    at(8770, () => behindWave(PH / 2, 4));
    at(8850, () => { hatch(6, false); crew(50, 210); });
    at(8920, () => { sentry(PH * .3, W * .78); sentry(PH * .7, W * .64); });
    at(8990, () => { flayer(PH * .25); flayer(PH * .7); });
  }),
  // 2, gauntlet: a swarm from behind, a drone wall, a sentry over a flayer, a late sine
  V(1, (at) => {
    at(8770, () => hatch(7, true));
    at(8850, () => { formation('wall', PH / 2, 4); corpse(PH * .85); });
    at(8930, () => { sentry(PH * .25, W * .76); flayer(PH * .7); });
    at(8995, () => formation('sine', PH * .72, 4));
  }),
  // 3, the crew wakes (Descent 3+): the drifting dead turn out to be flayers, and the brood pours in behind them
  V(2, (at) => {
    at(8760, () => { logLine('THE CREW IS STILL MOVING IN THERE.'); crew(60, 130, 200); });
    at(8820, () => { flayer(PH * .3); flayer(PH * .7); });
    at(8900, () => { hatch(6, true); sentry(PH * .5, W * .8); });
    at(8980, () => { formation('zig', PH * .4, 4); corpse(PH * .8); });
  })
];

export function buildScript(L) {
  const S = [],
    at = (x, f) => S.push({ x, f });
  // PHASE 1: open orbit, the derelict looming
  pickV('oA', ORBIT_A, L)(at);
  at(UFO_AT, ufoWarn); // THE SQUIDFUCKED SAUCER, the Open Orbit midboss (enemies/ufo.ts): eats the filler while it's up
  pickV('oC', ORBIT_C, L)(at);
  pickV('oD', ORBIT_D, L)(at);
  at(2000, () => {
    banner('SOMETHING IS COMING', 'MASS READING: ORGANIC', undefined, 150);
    sfx.dread();
  });
  at(2120, () => maw(true));
  // PHASE 4: the Gravity Drive approach: corridor gauntlet, rising pressure, WARNING, a breath
  at(8430, () => logLine('GRAVITY RISING. THE HULL IS BEING PULLED AFT.'));
  pickV('dE', DRIVE_E, L)(at);
  at(8730, () => { eyeT(1); eyeT(-1); });
  pickV('dF', DRIVE_F, L)(at);
  at(9060, () => { banner('WARNING', 'GRAVITY WELL CRITICAL', '#ff2a2a', 200); sfx.siren(); $.G.glitch = 14; });
  at(9150, () => { corpse(PH * .3, { drift: .2 }); corpse(PH * .65, { drift: .2 }); }); // the breath: crew dragged toward the drive
  at(BOSS_AT, () => startBoss());
  // stages 1 and 2 (world x 2300..8200) are biome slots, scripted when you pick a gate (biomes.ts insertScript)
  S.sort((a, b) => a.x - b.x);
  return S;
}

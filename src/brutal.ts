// @ts-nocheck
// =====================================================================
//  THE BRUTAL DIAL (D63, Matt 2026-11-21: pass2 was "still too easy", beaten deathless; he wants "brutal everywhere",
//  old-school arcade hard from the first stage). One integer 0-3 on G.brutal, chosen at run start (lab.ts brutalPick:
//  ?brutal=N > the LAB's BRUTAL row > 2 on long4; always 0 on short), kept in the run save (runsave.ts) so a resume
//  flies the same dial. 0 is pass2 exactly: every factor below is 1 / 0 there. Matt calibrates by playing; the values
//  are deliberately big steps (x1.5 / x2.2 / x3), not a fit. Pure lookups: no R() draws of their own.
//  Measured with tools/pod-probe.mjs --mortal --pilot --brutal N (pilot clears are a floor: Matt is far better).
// =====================================================================
import { $ } from './state';

export const BRUTAL = {
  hp: [1, 1.5, 2.2, 3], //        regular enemies' HP, on top of HardSet powHP (depth.ts depthHP): fodder survives to shoot
  bossHp: [1, 1.3, 1.6, 2], //    midbosses and stage bosses (THE KEEPSAKE takes half the extra: no escape clock)
  driveHp: [1, .5, .55, .6], //   the Gravity Drive: pass2 ran 54-63 s and .7 still took the dial-1 pilot 104 s, so it is cut and its cadence does the work
  cool: [1, .7, .55, .42], //     every enemy cooldown and pattern interval (depth.ts cdm, spawn.ts every): bosses included
  fire: [1, 2.5, 4, 6], //        random-fire chance (depth.ts firem: drones, flayer globs)
  bs: [1, 1.15, 1.3, 1.45], //    enemy bullet speed (spawn.ts BS)
  fan: [0, 0, 1, 2], //           extra bullets each side of a regular shooter's aimed shot (drone, eye, sentry)
  aimAll: [0, 1, 1, 1], //        1: drones and sentries fire at the ship wherever it is (no "only while it is ahead" gate)
  dens: [0, 1, 2, 3], //          extra drones per scripted formation (spawn.ts formation)
  pod: [1, .7, .5, .35], //       share of carrier and formation pods kept (economy.ts capKept / grpDrops)
  ward: [1, 1, .5, .25], //       WARD's weight in the pod roll (enemies/update.ts podType)
};
/** the dial: 0-3 (0 = pass2, short, the harness) */
export const brutal = () => ($.G && $.G.brutal) || 0;
/** lever k at the current dial */
export const bru = (k) => BRUTAL[k][brutal()];

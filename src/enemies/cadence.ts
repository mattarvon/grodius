// @ts-nocheck
// =====================================================================
//  ENEMY ATTACK CADENCE: frames between telegraphed attacks, per kind. Decision D2 (production/decision-log.md):
//  src/depth.ts is the single home for depth fire scaling, so these hold the Descent 1 values and every depth step
//  goes through cdm() exactly once. Until M2 these cooldowns also shrank by a legacy per-descent term from the
//  original port (3208210 / 31a2eb8, e.g. 120 - 18 * loop) that cb50d04 then wrapped in cdm(): double scaling.
//  Measured with tools/fire-probe.mjs (bullets/s per kind, Descent 1-3).
// =====================================================================
import { cdm, xtra } from '../depth';

/** Descent 1 cooldown in frames, before the ri() jitter the caller adds */
export const COOL = {
  eye: 120, //    aimed 1-3 shot volley from a surface eye (+0-40 jitter)
  cross: 130, //  crucified corpse's 3/5-shot spread (+0-40)
  flayer: 110, // whip strike, after its 34f tell (+0-40)
  slime: 170, //  snot lob, after its 32f rear-up (+0-50)
  mutant: 190, // 3/5 lobbed chunks, after its 44f groan (+0-50)
  sentry: 130, // gap between its two aimed bursts (+0-30)
};
/** cooldown for kind k after an attack; roll = the ri() jitter the caller drew */
export const coolFor = (k, roll) => Math.round((COOL[k] + roll) * cdm());
/** frames between a womb's litters. Half the depth fire step (sqrt of cdm): the old 120 - 15 * loop gave 105 in
 *  Descent 2 and this gives 100, 87 in Descent 3 (was 90); a full cdm() would be 83 and swamp the screen in hatchlings */
export const wombCool = () => Math.max(70, Math.round(120 * Math.sqrt(cdm())));
/** bullets in a dying enemy's revenge fan: a pair in Descent 2, a 3-fan from Descent 3 (the caller gates on Descent 2+) */
export const revengeN = () => 2 + xtra();

// @ts-nocheck
// =====================================================================
//  The G3 gate and W1's reads of rank and tier (DIFFICULTY-SPEC §5.6, workstream W1): thin names over W0's src/rank.ts
//  and src/tier.ts, in their own module (not spawn.ts) so the unit tests that stub spawn.ts still get the real gate.
// =====================================================================
import { $ } from '../state';
import { ECON, econId } from '../economy';
import { bulletCap, cadMul, capCtx, rank, rho } from '../rank';
import { tierG } from '../tier';

/** the G3 rules are on: long4 (ECON hard), never short, so short and layout-parity stay byte-identical (§5.3) */
export const g3 = () => !!ECON[econId()].hard;
/** G.tier 0-3 (Easy, Normal, Hard, Very Hard), Normal when unset (tier.ts tierG) */
export const tierOf = () => tierG($.G);
/** rank 0-31 (rank.ts rank($)) */
export const rankOf = () => rank($);
/** rho = min(rank, 16) / 16 (rank.ts rho($)) */
export const rhoOf = () => rho($);
/** 1.25 - .6 rho (rank.ts cadMul($)) */
export const cadMulOf = () => cadMul($);
/** the cap context (rank.ts capCtx: boss / setp, the Open Orbit and mid-stage Maws as midbosses / scroll) */
export const capCls = () => capCtx($);
/** the cap for context cls (rank.ts bulletCap($, cls)) */
export const capOf = (cls = capCtx($)) => bulletCap($, cls);

// ---------------- W2 survival reads (DIFFICULTY-SPEC §2.1 survival). W2's branch g3-w2-death exports these; until it
// merges, local mirrors with the same values. INTEGRATION (W6): replace each body with the import named in its comment
/** SCAB WEAVE's chance per level that a kill regrows a WARD hit: perks.ts scabChance() (long4 SURV.scab .03, short .06) */
export const scabChanceOf = () => (g3() ? .03 : .06);
/** the most WARD hits a refill or top-up may reach: player.ts wardCap() (long4: min(WARD_MAX, wardLv), short WARD_MAX) */
export const wardCapOf = (WARD_MAX) => (g3() ? Math.min(WARD_MAX, ($.P && $.P.wardLv) || 0) : WARD_MAX);
/** WARD's weight in the pod roll at every tier: death.ts SURV.wardPodW (.45) */
export const WARD_POD_W = .45;
/** a recovery pod's type as its wave launches (spawn.ts recoveryWave). enemies/update.ts sets swap to turn a WRAITH pod
 *  into WARD once WRAITH is capped (W2: R2's swap happens when it flies); identity until then */
export const REC_TY = { swap: (ty) => ty };

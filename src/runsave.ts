// @ts-nocheck
// Run-save serializer (plan item H0, spec design/content-expansion.md §4 "What it stores").
// An ALLOWLISTED slice of $.G / $.P -> JSON -> back. Not a snapshot: closures, entity references and live
// enemies/bullets/pods are never stored, and the restore path (item H) rebuilds terrain and the script from these
// fields. Nothing here is wired to a trigger yet: H adds CP0/CP1, the Android pause re-write and RESUME.
// One slot, under its own key, separate from the meta save (grodius.v1) so a bad run blob can never cost meta.
import { $ } from './state';

export const RUN_KEY = 'grodius.run';
/** bump when the allowlist changes meaning; a blob with any other version is discarded, never migrated */
export const RUN_V = 1;

const isInt = (v) => Number.isInteger(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string';
const isNumOrNull = (v) => v === null || isNum(v);
const isStrOrNull = (v) => v === null || isStr(v);
const isNat = (v) => isInt(v) && v >= 0; // counts, levels, indices: a negative one would index past a table on restore
// {id: number} tables (pk, gm, kk, bvis). An own __proto__ key is refused: a later Object.assign of the restored
// table would swap that copy's prototype
const isNumMap = (v) => isObj(v) && !Object.hasOwn(v, '__proto__') && Object.values(v).every(isNum);
const plain = (v) => isObj(v) || Array.isArray(v); // JSON-able container (deep-cloned on the way in and out)

// $.G fields. A field that is absent on G is simply not written (and not restored), so fields owned by lanes not
// merged yet (layout, seed, remixV, visitNo, the midboss/set-piece sets, picks) cost nothing until they exist.
// Each check is what a well-formed value looks like; one bad field discards the whole blob (decodeRun).
const G_FIELDS = {
  // position in the run
  loop: isNat,
  stage: isNat, // upper bound is the layout's stage count, checked by item H against the restored layout (LS1-A)
  cpX: isNum, // checkpoint world x (item H sets it)
  layout: isStr, // layout id; a blob from another layout is discarded by H (spec §4, D2)
  seed: isNum, // production run seed (item B2)
  // bx: where each biome's terrain/script starts and where the second biome hands back. Player-timed, so it cannot
  // be recomputed: all three entries are kept, null included (spec §4)
  bx: (v) => Array.isArray(v) && v.length === 3 && v.every(isNumOrNull),
  // progression and loadout that lives on G
  pk: isNumMap, xp: isNum, xpTot: isNum, lvl: isNat,
  gm: isNumMap, kk: isNumMap, gmk: isNat,
  cur: (v) => isInt(v) && v >= -1, // classic POWER meter cursor (player.ts:105); -1 = nothing lit
  lives: isNat, score: isNum, bio: isNum, kills: isNat, maxCombo: isNat,
  seal: isNat, cleared: isNat,
  // route and freshness
  route: (v) => Array.isArray(v) && v.length === 2 && v.every(isStrOrNull),
  bvis: isNumMap,
  visited: (v) => Array.isArray(v) && v.every(isStr),
  seenV: isNat,
  remix: plain, // today one object shared by pickV (per-section {used,last}) and choose() (slot -> visit no.)
  remixV: plain, visitNo: plain, // LS1-A splits remix into these two
  mbUsed: plain, mbSeen: plain, spUsed: plain, intRot: plain, // midboss used/seen, set-piece used, interior rotation
  picks: isObj, // this stage's picks: midboss pair, set-piece ids, movement-B variant (items F, D, H)
  st: isObj, // stage stats as they stood at the checkpoint (grade inputs)
};
// $.P loadout. The hull form is not stored: shipform.ts derives it from this loadout, G.gm, G.pk and meta.rig.
// P.rig is live animation/cooldown state and is reset on restore, like every other cooldown (spec §4).
const P_FIELDS = {
  speed: isNat, missile: isNat, double: isNat, laser: isNat, pyre: isNat, options: isNat,
  shield: (v) => isNum(v) && v >= 0, wardLv: isNat, aegis: isNat,
  frag: (v) => Array.isArray(v) && v.every((x) => x === null || isNum(x)),
};
// Always required: without these the rebuild has nowhere to start
const REQUIRED_G = ['loop', 'stage', 'bx', 'route'];

const clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);
// choose() writes remix[seg] with ||= [0, 0], so on a run where it ran first remix is an array that pickV later hangs
// string keys on, and JSON.stringify would drop them. Store an array carrying NON-INDEX keys as a plain object.
// A merely sparse array (P.frag: player.ts:59 writes frag[i] at any pod index) stays an array; JSON writes its
// holes as null, which the frag check accepts and player.ts reads as 0 (`|| 0`).
const flatten = (v) => (Array.isArray(v) && Object.keys(v).some((k) => !/^\d+$/.test(k)) ? Object.assign({}, v) : v);

function pickFields(src, fields) {
  const out = {};
  if (!src) return out;
  for (const k of Object.keys(fields)) if (src[k] !== undefined) out[k] = clone(flatten(src[k]));
  return out;
}

/** the allowlisted run state of G and P as a plain JSON-able object (pure: reads only its arguments) */
export function serializeRun(G = $.G, P = $.P) {
  return { v: RUN_V, g: pickFields(G, G_FIELDS), p: pickFields(P, P_FIELDS) };
}

function valid(fields, o) {
  if (!isObj(o)) return false;
  // Object.hasOwn: an inherited name (toString, constructor, __proto__) is not an allowlisted field
  for (const [k, v] of Object.entries(o)) if (!Object.hasOwn(fields, k) || !fields[k](v)) return false;
  return true;
}

/** a parsed blob if it is a well-formed run save of this version, else null. Never throws. */
export function decodeRun(s) {
  try {
    const d = typeof s === 'string' ? JSON.parse(s) : s;
    if (!isObj(d) || d.v !== RUN_V || !valid(G_FIELDS, d.g) || !valid(P_FIELDS, d.p || {})) return null;
    if (!REQUIRED_G.every((k) => d.g[k] !== undefined)) return null;
    return { v: d.v, g: d.g, p: d.p || {} };
  } catch (e) {
    return null;
  }
}

/** write a decoded blob's fields onto G and P (deep copies; fields not in the blob are left as they are).
 *  P must exist: the restore (item H) calls resetPlayer() first, or the loadout is skipped. */
export function applyRun(d, G = $.G, P = $.P) {
  for (const [k, v] of Object.entries(d.g)) G[k] = clone(v);
  if (P) for (const [k, v] of Object.entries(d.p)) P[k] = clone(v);
}

// ---- the one slot in localStorage. Every access is guarded: a missing or full storage never throws into the game.
/** store the current run state under grodius.run; false if storage refused it or the state would not read back
 *  (JSON turns NaN/Infinity into null), in which case the previous checkpoint is left standing */
export function writeRun(G = $.G, P = $.P) {
  try {
    const s = JSON.stringify(serializeRun(G, P));
    if (!decodeRun(s)) return false;
    localStorage.setItem(RUN_KEY, s);
    return true;
  } catch (e) {
    return false;
  }
}
/** the stored run save, or null. A bad or old-version blob is removed so RESUME never offers it again */
export function readRun() {
  let s = null;
  try { s = localStorage.getItem(RUN_KEY); } catch (e) { return null; }
  if (s == null) return null;
  const d = decodeRun(s);
  if (!d) clearRun();
  return d;
}
/** drop the run save (game over, descent end, new game) */
export function clearRun() {
  try { localStorage.removeItem(RUN_KEY); } catch (e) {}
}

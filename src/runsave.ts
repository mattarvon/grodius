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
const plain = (v) => isObj(v) || Array.isArray(v); // JSON-able container (deep-cloned on the way in and out)

// $.G fields. A field that is absent on G is simply not written (and not restored), so fields owned by lanes not
// merged yet (layout, seed, remixV, visitNo, the midboss/set-piece sets, picks) cost nothing until they exist.
// Each check is what a well-formed value looks like; one bad field discards the whole blob (decodeRun).
const G_FIELDS = {
  // position in the run
  loop: isInt,
  stage: isInt,
  cpX: isNum, // checkpoint world x (item H sets it)
  layout: isStr, // layout id; a blob from another layout is discarded by H (spec §4, D2)
  seed: isNum, // production run seed (item B2)
  // bx: where each biome's terrain/script starts and where the second biome hands back. Player-timed, so it cannot
  // be recomputed: all three entries are kept, null included (spec §4)
  bx: (v) => Array.isArray(v) && v.length === 3 && v.every(isNumOrNull),
  // progression and loadout that lives on G
  pk: isObj, xp: isNum, xpTot: isNum, lvl: isInt,
  gm: isObj, kk: isObj, gmk: isInt, meter: isInt,
  lives: isInt, score: isNum, bio: isNum, kills: isInt, maxCombo: isInt,
  seal: isInt, cleared: isInt,
  // route and freshness
  route: (v) => Array.isArray(v) && v.length === 2 && v.every(isStrOrNull),
  bvis: isObj,
  visited: (v) => Array.isArray(v) && v.every(isStr),
  seenV: isInt,
  remix: plain, // today one object shared by pickV (per-section {used,last}) and choose() (slot -> visit no.)
  remixV: plain, visitNo: plain, // LS1-A splits remix into these two
  mbUsed: plain, mbSeen: plain, spUsed: plain, intRot: plain, // midboss used/seen, set-piece used, interior rotation
  picks: isObj, // this stage's picks: midboss pair, set-piece ids, movement-B variant (items F, D, H)
  st: isObj, // stage stats as they stood at the checkpoint (grade inputs)
};
// $.P loadout. The hull form is not stored: shipform.ts derives it from this loadout, G.gm, G.pk and meta.rig.
// P.rig is live animation/cooldown state and is reset on restore, like every other cooldown (spec §4).
const P_FIELDS = {
  speed: isInt, missile: isInt, double: isInt, laser: isInt, pyre: isInt, options: isInt,
  shield: isNum, wardLv: isInt, aegis: isInt,
  frag: (v) => Array.isArray(v) && v.every((x) => x === null || isNum(x)),
};
// Always required: without these the rebuild has nowhere to start
const REQUIRED_G = ['loop', 'stage', 'bx', 'route'];

const clone = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);
// choose() writes remix[seg] with ||= [0, 0], so on a run where it ran first remix is an array that pickV later hangs
// string keys on, and JSON.stringify would drop them. Store any array-with-keys as a plain object.
const flatten = (v) => (Array.isArray(v) && Object.keys(v).length !== v.length ? Object.assign({}, v) : v);

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
  for (const [k, v] of Object.entries(o)) if (!fields[k] || !fields[k](v)) return false; // unknown key: not ours
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

/** write a decoded blob's fields onto G and P (deep copies; fields not in the blob are left as they are) */
export function applyRun(d, G = $.G, P = $.P) {
  for (const [k, v] of Object.entries(d.g)) G[k] = clone(v);
  if (P) for (const [k, v] of Object.entries(d.p)) P[k] = clone(v);
}

// ---- the one slot in localStorage. Every access is guarded: a missing or full storage never throws into the game.
/** store the current run state under grodius.run; false if storage refused it */
export function writeRun(G = $.G, P = $.P) {
  try { localStorage.setItem(RUN_KEY, JSON.stringify(serializeRun(G, P))); return true; } catch (e) { return false; }
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

// @ts-nocheck
// Run-save serializer (plan item H0, spec design/content-expansion.md §4 "What it stores").
// An ALLOWLISTED slice of $.G / $.P -> JSON -> back. Not a snapshot: closures, entity references and live
// enemies/bullets/pods are never stored, and the restore path (item H) rebuilds terrain and the script from these
// fields. Nothing here is wired to a trigger yet: H adds CP0/CP1, the Android pause re-write and RESUME.
// One slot, under its own key, separate from the meta save (grodius.v1) so a bad run blob can never cost meta.
import { $ } from './state';
import { LAYOUTS, lastStage, layout, nSlots, row, setLayout, slotRow, stageOfSlot } from './layout';
import { HOME, MIDS } from './midpick';
import { SETS_PER_STAGE, isSetId } from './setdraw';

export const RUN_KEY = 'grodius.run';
/** bump when the allowlist changes meaning; a blob with any other version is discarded, never migrated */
export const RUN_V = 2; // 2: item H wired it (pickQ, boostReq, cpN, stT; seal stored as earned)

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
// Kinds the restore indexes by name, checked here so a save that decodes always rebuilds (sprint 3 H review,
// lead-programmer): an unknown biome would throw at BIOMES[b].remix, an unknown midboss at biomes.ts midName. The
// tables are midpick.ts's, from the roster (a leaf, so the boot-time module order is unchanged); tests/unit/midslot.test.ts keeps
// MIDS and HOME in step with biomes.ts BIOMES and its mids, and runsave.test.ts checks HOME covers BIOME_KEYS
const isBiome = (v) => isStr(v) && Object.hasOwn(HOME, v);
const isMid = (v) => isStr(v) && Object.hasOwn(MIDS, v);
const isMidArr = (v) => Array.isArray(v) && v.every(isMid);
// {key: kind[]} tables: the midboss picks by stage (G.mb) and each stage's previous pair (G.mbLast).
// An own __proto__ key is refused (as isNumMap)
const isMidMap = (v, key = (k) => true) => isObj(v) && !Object.hasOwn(v, '__proto__') && Object.entries(v).every(([k, a]) => key(k) && isMidArr(a));

const isSetArr = (v) => Array.isArray(v) && v.every(isSetId);
// the set-piece used set by biome (G.spUsed), and each stage's build picks (G.picks, biomes.ts stagePicks): an unknown
// set id would throw when its script entry fires, so it is checked here like a midboss kind
const isSpUsed = (v) => isObj(v) && !Object.hasOwn(v, '__proto__') && Object.entries(v).every(([k, a]) => isBiome(k) && isSetArr(a));
// a stage's picks name exactly SETS_PER_STAGE distinct pieces: biomeScript indexes them by slot
const isStagePick = (v) => isObj(v) && (v.mv === 0 || v.mv === 1) && isSetArr(v.sp) && v.sp.length === SETS_PER_STAGE && new Set(v.sp).size === v.sp.length;
// each biome's movement-B variants flown this run (G.mvSeen; setdraw.ts moveRoll): bit 0 B0, bit 1 B1
const isMvSeen = (v) => isObj(v) && !Object.hasOwn(v, '__proto__') && Object.entries(v).every(([k, m]) => isBiome(k) && (m === 1 || m === 2 || m === 3));
// LS1 audit (gameplay-programmer, security-engineer): the remix memory the rebuild reads. visitNo: one earlier-visit
// count per biome slot (biomes.ts biomeStage reads visitNo[seg]; a truthy non-number would silently build a remix).
// remixV: per section, pickV's {used: variant indices, last, L} (enemies/scripts.ts); per planned row ('c:<kind>'),
// pickPlanned's cell memory {used: ids, last: ids, L, pick?: {ids, fill}} (cellpick.ts CellMem)
const isVisitNo = (v) => Array.isArray(v) && v.length === nSlots() && v.every(isNat);
const isSecMem = (h) => isObj(h) && Array.isArray(h.used) && h.used.every(isNat) && isInt(h.last) && h.last >= -1 && (h.L === undefined || isNat(h.L));
const isCellPick = (p) => isObj(p) && Array.isArray(p.ids) && p.ids.every(isStrOrNull) && Array.isArray(p.fill) && p.fill.every((b) => isObj(b) && isNum(b.x) && isStr(b.k));
const isCellMem = (h) => isObj(h) && Array.isArray(h.used) && h.used.every(isStr) && Array.isArray(h.last) && h.last.every(isStrOrNull) && (h.L === undefined || isNat(h.L)) && (h.pick === undefined || isCellPick(h.pick));
const isRemixV = (v) => isObj(v) && !Object.hasOwn(v, '__proto__') && Object.entries(v).every(([k, h]) => (k.startsWith('c:') ? isCellMem(h) : isSecMem(h)));
// the pre-LS1-A shared remix object: slot -> visit no. (choose()) beside pickV's section memories
const isRemix = (v) => (isObj(v) || Array.isArray(v)) && !Object.hasOwn(v, '__proto__') && Object.values(v).every((h) => isNat(h) || isSecMem(h));
// Upper bounds (LS1 audit, security-engineer): a hand-edited or future-skewed blob must not decode into a value the
// game loops over (options: 1e7 hangs hud.ts and player.ts). Gun levels are player.ts SMAX (THRUST, MISSILE, SPLIT, ARC,
// PYRE, WRAITH, WARD), restated here because importing player.ts would change the boot-time module order;
// tests/unit/runsave.test.ts keeps the two in step. The rest are the game's own caps
export const LOAD_MAX = {
  speed: 5, missile: 2, double: 1, laser: 1, pyre: 2, options: 3, wardLv: 3, // player.ts SMAX
  shield: 3, // player.ts WARD_MAX: every shield gain is clamped to it
  aegis: 12, // player.ts / contraptions.ts: the aegis refill caps at 12
  frag: 7, // one fragment count per pod type (player.ts SLOTS); each count is reset at its NEED, the largest being 4
  fragN: 4, // player.ts NEED's largest entry
};
/** lives: no table caps them (hull, SPARE MEAT and the loop shop each add a few), so this is a hang guard far above
 *  any real run, not a balance cap */
export const LIVES_MAX = 99;
/** perks.ts xpNeed, restated (importing perks.ts would change the boot-time module order; runsave.test.ts keeps them in
 *  step): gainXP always leaves 0 <= xp < xpNeed(lvl), and an xp far past it would loop gainXP ~ (xp/6)^(1/3) times on
 *  the first kill (xp: 1e30 hangs the tab; LS1 audit, security-engineer) */
export const xpNeedRun = (lvl) => Math.round(48 + lvl * 9.6 + Math.max(0, lvl - 10) ** 2 * 6);
/** descents a save may claim: no run reaches it (each descent is ~10 min), and it keeps `cleared`, which sealFor
 *  walks 1..cleared on every cpView, small (LS1 audit, systems-designer) */
export const LOOP_MAX = 99;
/** core.ts W, the screen width: choose() puts a gate at max(slot x0, scroll + W + 10), so a stored gate x more than W
 *  before its slot's x0 is no gate the game made (restated: core.ts touches the DOM at import; the test keeps it in step) */
export const SCREEN_W = 480;
/** stages.ts SEAL_TXT has 4 entries: seal tiers 0..3 */
export const SEAL_MAX = 3;
const upTo = (n) => (v) => isNat(v) && v <= n;
const isPicks = (v) => isObj(v) && !Object.hasOwn(v, '__proto__') && Object.entries(v).every(([k, p]) => /^\d+$/.test(k) && isStagePick(p));

// $.G fields. A field that is absent on G is simply not written (and not restored), so fields owned by lanes not
// merged yet (layout, seed, remixV, visitNo, the midboss/set-piece sets, picks) cost nothing until they exist.
// Each check is what a well-formed value looks like; one bad field discards the whole blob (decodeRun).
const G_FIELDS = {
  // position in the run
  loop: (v) => isNat(v) && v <= LOOP_MAX,
  stage: isNat, // upper bound: the blob's own layout's last stage (decodeRun, under decodeRunAs's layout switch)
  cpX: isNum, // bounded to the stage in decodeRun (rowFits). checkpoint scroll x: the resume skips script entries up to it (src/checkpoint.ts)
  cpN: (v) => v === 0 || v === 1, // which checkpoint of the stage: CP0 (stage start) or CP1 (after midboss A)
  stT: isNum, // frames into the stage at the checkpoint (G.t - st.t0): the resume rebases st.t0 on its own G.t
  layout: isStr, // layout id; a blob from another layout is discarded by H (spec §4, D2)
  seed: isNum, // production run seed (item B2)
  // bx: where each biome's terrain/script starts and where the second biome hands back. Player-timed, so it cannot
  // be recomputed: all three entries are kept, null included (spec §4)
  bx: (v) => Array.isArray(v) && v.length === nSlots() + 1 && v.every(isNumOrNull), // one per biome slot + the hand-back
  // progression and loadout that lives on G
  pk: isNumMap, xp: isNum, xpTot: isNum, lvl: isNat,
  gm: isNumMap, kk: isNumMap, gmk: isNat,
  cur: (v) => isInt(v) && v >= -1, // classic POWER meter cursor (player.ts:105); -1 = nothing lit
  lives: upTo(LIVES_MAX), score: isNum, bio: isNum, kills: isNat, maxCombo: isNat,
  // seal is written as earned by `cleared` (checkpoint.ts), so a queued seal closure is not lost; cleared is bounded
  // by the stage count in decodeRun
  seal: (v) => isNat(v) && v <= SEAL_MAX, cleared: isNat,
  // rewards still pending at the checkpoint (H entry criterion 1): queued level-up picks, the biome boost offer
  pickQ: isNat, boostReq: isStrOrNull,
  // route and freshness
  route: (v) => Array.isArray(v) && v.length === nSlots() && v.every((b) => b === null || isBiome(b)), // one per biome slot (layout.ts)
  bvis: isNumMap,
  visited: (v) => Array.isArray(v) && v.every(isStr),
  seenV: isNat,
  remix: isRemix, // the pre-LS1-A object shared by pickV (per-section {used,last}) and choose() (slot -> visit no.)
  remixV: isRemixV, visitNo: isVisitNo, // LS1-A split remix into these two
  // the midboss picker (item F, src/biomes.ts stageMids): each stage's pair, picked ONCE from midStream(i) and read
  // back on a rebuild, so a resume places the same pair (re-picking would follow meta.mb, which meeting it changed);
  // what this descent has met (spec §6.3 step 2); each biome's previous pair (step 3, kept across descents)
  mb: (v) => isMidMap(v, (k) => /^\d+$/.test(k)), mbUsed: isMidArr, mbLast: isMidMap, // keyed by biome or by a fixed row's kind (fixedMids): only the kinds are checked
  mbSeen: plain, intRot: plain, // midboss seen, interior rotation (reserved)
  // LS2-mv: the set-piece used set (kept across descents: drawn without replacement per run) and each stage's movement-B
  // variant and set-piece ids, drawn once and read back on a rebuild as G.mb is
  spUsed: isSpUsed, picks: isPicks, mvSeen: isMvSeen,
  st: isObj, // stage stats as they stood at the checkpoint (grade inputs)
};
// $.P loadout. The hull form is not stored: shipform.ts derives it from this loadout, G.gm, G.pk and meta.rig.
// P.rig is live animation/cooldown state and is reset on restore, like every other cooldown (spec §4).
const P_FIELDS = {
  speed: upTo(LOAD_MAX.speed), missile: upTo(LOAD_MAX.missile), double: upTo(LOAD_MAX.double), laser: upTo(LOAD_MAX.laser),
  pyre: upTo(LOAD_MAX.pyre), options: upTo(LOAD_MAX.options), wardLv: upTo(LOAD_MAX.wardLv),
  shield: (v) => isNum(v) && v >= 0 && v <= LOAD_MAX.shield, aegis: upTo(LOAD_MAX.aegis),
  frag: (v) => Array.isArray(v) && v.length <= LOAD_MAX.frag && v.every((x) => x === null || (isNat(x) && x <= LOAD_MAX.fragN)),
};
// Always required: without these the rebuild has nowhere to start
const REQUIRED_G = ['loop', 'stage', 'bx', 'route', 'cpX', 'cpN']; // cpX/cpN: resumeRun sets the scroll from cpX (NaN without it)

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

// the checkpoint x lies before the stage's boss (cpSafe never writes in a fight; jump.ts's x is bounded the same way)
// and no earlier than the previous stage's start (a biome stage's CP0 lands just before its row, at the gate)
const cpFits = (i, x) => { const r = row(i), p = i > 0 ? row(i - 1) : null; return !!r && x >= (p ? p.x0 : 0) && x < r.bossX; };

// every biome slot the run has reached (its stage <= G.stage) has a biome and a gate x, or rebuildAt silently builds an
// empty stage; a stored gate x lies in [slot x0 - W, slot bossX) (choose(): max(x0, scroll + W + 10), before its boss)
const gatesFit = (g) => {
  for (let s = 0; s < nSlots(); s++) {
    const x = g.bx[s], r = slotRow(s);
    if (stageOfSlot(s) <= g.stage && (g.route[s] == null || x == null)) return false;
    if (x != null && !(x >= r.x0 - SCREEN_W && x < r.bossX)) return false;
  }
  return true;
};

/** a parsed blob if it is a well-formed run save of this version, else null. Never throws. */
export function decodeRun(s) {
  try {
    const d = typeof s === 'string' ? JSON.parse(s) : s;
    if (!isObj(d) || d.v !== RUN_V || !valid(G_FIELDS, d.g) || !valid(P_FIELDS, d.p || {})) return null;
    if (!REQUIRED_G.every((k) => d.g[k] !== undefined)) return null;
    if (d.g.stage > lastStage()) return null; // H entry criterion 2: a stage the (blob's) layout doesn't have
    if (!cpFits(d.g.stage, d.g.cpX)) return null;
    if (!gatesFit(d.g)) return null;
    if (d.g.cleared !== undefined && d.g.cleared > (LOOP_MAX + 1) * (lastStage() + 1)) return null;
    // a level-up queues one pick (perks.ts gainXP: lvl++ and pickQ++ together, from lvl 1), so pickQ < lvl
    if (d.g.xp !== undefined && !(d.g.xp >= 0 && d.g.xp < xpNeedRun(d.g.lvl ?? 1))) return null;
    if (d.g.pickQ !== undefined && d.g.pickQ >= (d.g.lvl ?? 1)) return null;
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
// `last` is the slot's in-memory copy (the JSON last stored or read): the title's RESUME row and the Android pause
// re-write read it, never storage, so no draw code touches localStorage
let last = null, info = null;
// the jump switch (src/jump.ts) seals the slot for the page's life: a dev jump never stores, re-writes or clears the
// player's checkpoint, whatever the run does (checkpoints, game over, a new game). Reads still work
let sealed = false;
/** seal (or, after a jump that failed to start, unseal) the slot */
export const sealRun = (on = true) => { sealed = on; };
const remember = (s, d) => { last = s; info = s && d ? { loop: d.g.loop, stage: d.g.stage, layout: d.g.layout } : null; };

/** decodeRun under the blob's OWN layout: route and bx are sized by nSlots() and stage is bounded by lastStage(), so
 *  the active entry is switched to the blob's layout before the check (a long4 save read on a short boot must not be
 *  discarded, nor the reverse). It is switched back afterwards unless `keep` (the resume flies that layout). A layout
 *  id that names no entry discards the blob. Never throws */
export function decodeRunAs(s, keep = false) {
  let raw;
  try { raw = typeof s === 'string' ? JSON.parse(s) : s; } catch (e) { return null; }
  const id = isObj(raw) && isObj(raw.g) ? raw.g.layout : undefined, prev = layout().id;
  if (id !== undefined && !(isStr(id) && Object.hasOwn(LAYOUTS, id))) return null;
  if (id !== undefined) setLayout(id);
  const d = decodeRun(raw);
  if (!keep || !d) setLayout(prev);
  return d;
}

/** the run state as the JSON writeRun would store, or null when it would not read back (JSON turns NaN/Infinity
 *  into null) */
export function encodeRun(G = $.G, P = $.P) {
  try {
    const s = JSON.stringify(serializeRun(G, P)), d = decodeRun(s);
    return d ? s : null;
  } catch (e) {
    return null;
  }
}
/** store an encoded run under grodius.run (and as the in-memory copy); false if storage refused it */
export function storeRun(s) {
  if (sealed) return false;
  remember(s, decodeRun(s));
  try {
    localStorage.setItem(RUN_KEY, s);
    return true;
  } catch (e) {
    return false;
  }
}
/** store the current run state under grodius.run; false if storage refused it or the state would not read back,
 *  in which case the previous checkpoint is left standing */
export function writeRun(G = $.G, P = $.P) {
  const s = encodeRun(G, P);
  return s ? storeRun(s) : false;
}
/** the stored run save, or null. Validated under its own layout (decodeRunAs). A bad or old-version blob is removed
 *  so RESUME never offers it again */
export function readRun() {
  let s = null;
  try { s = localStorage.getItem(RUN_KEY); } catch (e) { return null; }
  if (s == null) { remember(null); return null; }
  const d = decodeRunAs(s);
  if (!d) clearRun();
  else remember(s, d);
  return d;
}
/** the last checkpoint's JSON (stored or read this session), or null */
export const lastRun = () => last;
/** what RESUME would rebuild: { loop, stage, layout } of the last checkpoint, or null (no storage access) */
export const runInfo = () => info;
/** Android pause: write the LAST CHECKPOINT again, never live state (spec §4) */
export function rewriteRun() {
  if (!last || sealed) return false;
  try { localStorage.setItem(RUN_KEY, last); return true; } catch (e) { return false; }
}
/** drop the run save (game over, descent end, new game) */
export function clearRun() {
  if (sealed) return;
  remember(null);
  try { localStorage.removeItem(RUN_KEY); } catch (e) {}
}

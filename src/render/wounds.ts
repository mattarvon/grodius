// @ts-nocheck
// =====================================================================
//  WOUND STATES (LS2-read item 2, art spec scratchpad plan/wounds.md). A remix visit to a biome (G.visitNo[slot] >= 1,
//  set by choose()) draws the same place after something has happened to it: the Cryovault THAWED, the Furnace BURNT
//  DOWN TO ASH, the Digestion Tanks DRAINED, the Sinus INFECTED. Authored, never a per-run tint.
//  Render-only: reads $.G, writes nothing to it, draws no RNG (painters use their own seeded rng, overlays hash).
//  Never lime: nothing here may have hue 65-150 deg with S > 25% and L > 15% (tests/unit/wounds.test.ts scans this file).
//  Each biome's identity colour (B.col) stays visible through a named carrier (spec §3).
// =====================================================================
import { $ } from '../state';
import { FIRE, PH, TAU, W, ctx, hash, sstep } from '../core';
import { LW, cnv, face, figure, ridge, rng, wrap } from './biomeart';

/** broken remains, not an emoji skull (tone note D38+): the back half of a cranium with one orbit, a jaw lying apart
 *  from it, two vertebrae. dir flips it so no two heaps read the same */
function remains(x, cx, cy, s, bone, dir = 1) {
  x.fillStyle = bone; x.strokeStyle = bone; x.lineCap = 'butt';
  x.beginPath(); x.moveTo(cx - 2.6 * s * dir, cy + .6 * s); x.lineTo(cx - 2.4 * s * dir, cy - 1.4 * s); x.lineTo(cx - 1 * s * dir, cy - 2.6 * s); x.lineTo(cx + .8 * s * dir, cy - 2.2 * s); x.lineTo(cx + .3 * s * dir, cy - .8 * s); x.lineTo(cx + 1.2 * s * dir, cy + .4 * s); x.closePath(); x.fill();
  x.fillStyle = '#0a0806'; x.fillRect(cx - 1.2 * s * dir - .4 * s, cy - 1 * s, .8 * s, .7 * s); // the one orbit left
  x.lineWidth = .7 * s; x.beginPath(); x.moveTo(cx + 2 * s * dir, cy + 1.2 * s); x.lineTo(cx + 3.6 * s * dir, cy + 1.6 * s); x.lineTo(cx + 4 * s * dir, cy + .4 * s); x.stroke(); // the jaw, apart
  x.fillStyle = bone; x.fillRect(cx - 4.6 * s * dir - .5 * s, cy + 1 * s, 1 * s, .7 * s); x.fillRect(cx - 6 * s * dir - .5 * s, cy + 1.3 * s, 1 * s, .6 * s);
}

/** the wound look per biome: replacements for the BIOMES[b] fields (bg, edge, mist, dark, gore DC, splat) plus the
 *  per-biome dial values drawBiomeBG reads. `fog` is for symmetry only: BIOMES[b].fog is read nowhere */
export const WOUND = {
  ice: {
    name: 'THAWED',
    bg: ['#030409', '#16141e'], // cold top, a bruised violet-grey bottom: diluted blood in meltwater (darker than spec: tone D38+)
    edge: '#cfe6f4', // wet, less crystalline, still the brightest line on screen
    mist: '110,10,24', dark: .62, // heavier, wetter blood; a darker vault than the normal .55
    dc: ['#7a1020', '#2a050c', '#7a2030', '#0c0809', '#5a7c98', '#8a8a94'], // ice chips become bloody meltwater and gunmetal slush: no pink
    splat: ['#3a0610', '#6a0e1c', '#6a0e1c'],
    fog: '150,170,200',
    wash: '110,110,125', washA: .08, // slush on the floor, gunmetal and dim (normal 160,210,240 at .16)
    aur: .25, // aurora alpha x .25: the cold is going out of the sky (hue unchanged)
  },
  fire: {
    name: 'BURNT DOWN TO ASH',
    bg: ['#040303', '#160d0b'],
    edge: '#e09050', // cooled ember rim
    mist: '62,40,34', dark: .66, // ash with blood in it; darker than the normal .6
    dc: ['#3a2a24', '#120d0b', '#c8501a', '#050303', '#8a8078', '#ff5a14'], // char and ash; two ember entries kept
    splat: ['#1a1210', '#3a2a24', '#3a2a24'],
    fog: '150,110,95',
    floor: .12, row: .06, // floor glow (normal .4) and its row of hot spots (normal .25)
    mouth: .10, light: .18, // far-mouth glow (normal .28) and light (normal .5): coal beds, not fires
    shimmer: .6, // heat shimmer amplitude (normal 1.3)
  },
  acid: {
    name: 'TANKS DRAINED',
    bg: ['#030304', '#100d0a'], // dry stomach lining
    edge: '#a8e0d0', // teal kept, drier and paler
    mist: '48,66,58', dark: .66,
    dc: ['#6a3a26', '#24120a', '#2a9a84', '#0c0809', '#a8946e', '#a8b0ac'], // the sulfur yellow becomes crust tan; no bright white
    splat: ['#2a1a12', '#5a3a28', '#5a3a28'],
    fog: '90,130,120',
    fume: '120,110,95', fumeA: .05, // dust, not sulfur: the old 170,170,60 fume sits too near the lime band
    vat: .05, // vat glow on the residue (normal .18 +- .06)
  },
  snot: {
    name: 'SINUS INFECTED',
    bg: ['#060201', '#1a0805'], // red-ochre, deep (the spec's #3a140a bottom measured 1.41x the normal look's luminance)
    edge: '#f2c890', // inflamed cream-peach
    mist: '120,40,22', dark: .52, // darker than the normal .4: the red ground must not out-shine the bullets
    dc: ['#a87028', '#5a1c0c', '#c8a040', '#2a0c06', '#b89870', '#8a2014'], // pus and infected blood, no bright cream
    splat: ['#4a1208', '#7a2a12', '#7a2a12'],
    fog: '200,120,60',
    glowA: .09, glowB: .04, glowW: .07, // fever pulse: .09 + .04 sin(t * .07), held below the normal glow for darkness (normal .12 + .06 sin(t * .045)); a slow glow, not a flash
    blister: .4, ring: 3, // fewer round blisters than normal (skip hash > .4, normal .7; tone note: no circles as decoration), red ring rr + 3
    blFill: 'rgba(160,110,50,.5)', blHi: 'rgba(190,160,100,.35)', // the blister body dull and septic, not cream
    rope: ['150,90,50', '210,170,130'], // normal 200,190,90 / 255,250,200
  },
};

// ---------------- which slot is on screen ----------------
// twin of biomes.ts fadeIn/biomeK: the same loop and tie-break, so the winning slot's biome is biomeK's biome. biomes.ts
// is the sim file and stays untouched, so the loop is repeated here; tests/unit/wounds.test.ts pins the two together
const fadeIn = (x, wx) => sstep(x - 280, x + 40, wx);
let winK = 0;
/** the biome slot whose look wins at world x (the one biomeK picks), or -1. Reads $.G, allocates nothing */
export function woundAt(wx) {
  const G = $.G;
  winK = 0;
  if (!G || !G.route || !G.bx) return -1;
  let best = -1, bk = 0;
  for (let s = 0; s < G.route.length; s++) {
    const b = G.route[s], x0 = G.bx[s];
    if (!b || x0 == null) continue;
    const x1 = G.bx[s + 1], k = fadeIn(x0, wx) * (x1 == null ? 1 : 1 - fadeIn(x1, wx));
    if (k > bk) { best = s; bk = k; }
  }
  winK = bk;
  return best;
}
/** the wound row for the slot winning at world x, or null on a first visit (and off the route) */
export function woundLook(wx) {
  const s = woundAt(wx), G = $.G;
  return s >= 0 && G.visitNo && G.visitNo[s] >= 1 ? WOUND[G.route[s]] || null : null;
}
/** woundLook, but null until that biome's layers are built: on a missed warm-up the fog, edge and gore colours stay
 *  normal along with the background, instead of flashing wound colours over the normal backdrop */
export function woundLive(wx) {
  const w = woundLook(wx);
  return w && woundBuilt($.G.route[woundAt(wx)]) ? w : null;
}
/** gore drop colours for the screen centre when it is a wound (drawDrops), else null: DC itself stays the sim's */
export function woundDC() {
  if (!$.G) return null;
  const w = woundLive($.G.scroll + W / 2);
  return w && winK > .5 ? w.dc : null;
}

// ---------------- the wound layers: 2 cached LW x PH canvases per biome ----------------
/** FNV-1a over the whole key. lay() in biomeart.ts seeds from length + first + last char only, which would give
 *  iceFarW and iceMidW the same seed (and line their figures up), so wound layers seed from the full string */
export function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}

const P = {
  iceFarW: (x, r) => {
    // the same ridge, slumped: no crystal teeth, half the amplitude
    const g = x.createLinearGradient(0, PH * .3, 0, PH); g.addColorStop(0, '#1a2a3c'); g.addColorStop(1, '#0a0a14');
    const top = (i) => PH * .44 + ridge(i, [[8, 2, 1], [4.5, 5, 2], [2, 11, 0]]);
    x.fillStyle = g; x.beginPath(); x.moveTo(0, PH); for (let i = 0; i <= LW; i += 4) x.lineTo(i, top(i)); x.lineTo(LW, PH); x.fill();
    x.strokeStyle = 'rgba(170,215,250,.25)'; x.lineWidth = 1; x.beginPath(); for (let i = 0; i <= LW; i += 4) i ? x.lineTo(i, top(i)) : x.moveTo(i, top(i)); x.stroke();
    // meltwater running off the ridge
    x.fillStyle = 'rgba(150,190,220,.22)';
    for (let i = 0; i < 20; i++) { const cx = 4 + r() * (LW - 8); x.fillRect(cx | 0, top(cx) + 3, 1, 14 + r() * 50); }
    // the crew that stood frozen on the ridge, fallen down the slope
    for (let i = 0; i < 6; i++) { const cx = 12 + r() * (LW - 24); figure(x, cx, top(cx) + 16 + r() * 34, .55, r() < .5 ? 'slump' : 'curl', 'rgba(6,14,26,.9)'); }
    // the melt pool: diluted blood, its surface still catching the vault's blue (identity)
    x.fillStyle = 'rgba(60,20,34,.45)'; x.fillRect(0, PH * .86 | 0, LW, PH);
    x.fillStyle = 'rgba(159,216,255,.35)'; x.fillRect(0, PH * .86 | 0, LW, 1);
  },
  iceMidW: (x, r, pts) => {
    for (let i = 0; i < 2; i++) {
      // the 2 shards, melted: narrower, 30 px lower, the peaks slumped into sagging broken teeth with melt tips hanging
      // off them (sharp and wrong, not a rounded arch: tone D38+). The crewman stays where he froze, so he now stands out
      const cx = 80 + i * 160 + r() * 30, w = (58 + r() * 26) * .85, top = 100 + r() * 50, pose = ['scream', 'cross', 'reach'][(r() * 3) | 0], s = 1.7 + r() * .4, by = top + 8 + r() * 4;
      const sh = [[cx - w / 2, PH], [cx - w / 2 + 2, top + 40 + r() * 16], [cx - w / 2 + 5, top + 52 + r() * 8], [cx - w * .3, top + 14 + r() * 10], [cx - w * .16, top + 26 + r() * 8], [cx - w * .06, top + r() * 6], [cx + w * .1, top + 22 + r() * 10], [cx + w * .26, top + 8 + r() * 10], [cx + w / 2 - 4, top + 44 + r() * 12], [cx + w / 2 - 1, top + 36 + r() * 10], [cx + w / 2, PH]];
      const tips = [...Array(4)].map(() => { const k = 1 + ((r() * (sh.length - 3)) | 0); return [sh[k][0], sh[k][1], 4 + r() * 10]; });
      const path = () => { x.beginPath(); sh.forEach((q, k) => (k ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1]))); x.closePath(); };
      path(); x.fillStyle = 'rgba(70,120,170,.16)'; x.fill();
      x.save(); path(); x.clip();
      const bg = x.createRadialGradient(cx, by + 14, 0, cx, by + 14, 44); bg.addColorStop(0, 'rgba(96,38,14,.55)'); bg.addColorStop(1, 'rgba(96,38,14,0)'); // iron oxide: red through the blue ice read mauve-pink
      x.fillStyle = bg; x.fillRect(cx - 50, by - 34, 100, 100);
      // runnels of blood down the shard, heavy and dark, each ending in a bead
      for (let k = 0; k < 6; k++) { const rx = (cx - w / 2 + 4 + r() * (w - 8)) | 0, ry = top + 10 + r() * 30, rl = 30 + r() * 70, rw = 1 + (r() < .4); x.fillStyle = 'rgba(110,10,24,.55)'; x.fillRect(rx, ry, rw, rl); x.fillStyle = 'rgba(80,4,14,.8)'; x.fillRect(rx - .5, ry + rl, rw + 1, 2); }
      x.restore();
      // the body, head and shoulders above the melt line
      figure(x, cx, by, s, pose, 'rgba(46,76,112,.95)', '#506a80');
      face(x, cx, by, s, '#141c26', '#200208'); // dark sockets: tone.md has no big or white eyes
      x.fillStyle = '#6a0a18'; x.fillRect(cx - 1.3 * s, by - 9.1 * s, .6, 4 * s); x.fillRect(cx - .3, by - 7 * s, .8, 5 * s);
      // the ice still over his legs: a wet sheen over what is below the line
      x.save(); path(); x.clip(); x.fillStyle = 'rgba(120,170,215,.18)'; x.fillRect(cx - w / 2, by - 4, w, PH); x.restore();
      path(); x.strokeStyle = 'rgba(200,228,248,.3)'; x.lineWidth = 1; x.stroke();
      // melt tips: thin icicles sagging off the broken edges
      x.fillStyle = 'rgba(170,205,235,.3)'; for (const [tx, ty, tl] of tips) { x.beginPath(); x.moveTo(tx - 1.5, ty); x.lineTo(tx + 1.5, ty); x.lineTo(tx, ty + tl); x.fill(); }
      pts.push({ x: cx, y: top + 30, w });
    }
  },
  fireFarW: (x, r, pts) => {
    // the furnace wall partly fallen: the same brick rows, 30% of the bricks gone, grey-brown
    x.fillStyle = '#0b0706'; x.fillRect(0, 60, LW, PH);
    for (let y = 64; y < PH; y += 7) for (let i = ((y / 7) % 2) * 8; i < LW; i += 16) { if (r() < .3) continue; x.fillStyle = `rgba(${28 + r() * 12 | 0},${22 + r() * 6 | 0},20,1)`; x.fillRect(i + 1, y, 14, 6); }
    const sg = x.createLinearGradient(0, 60, 0, 150); sg.addColorStop(0, 'rgba(0,0,0,.9)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = sg; x.fillRect(0, 60, LW, 90);
    for (let i = 0; i < 3; i++) {
      const cx = 52 + i * 106 + r() * 16, w = 40 + r() * 10, h = 58 + r() * 14, by = PH * .66 + r() * 16;
      x.fillStyle = '#060101'; x.beginPath(); x.moveTo(cx - w / 2 - 4, by + 4); x.lineTo(cx - w / 2 - 4, by - h + w / 2); x.arc(cx, by - h + w / 2, w / 2 + 4, Math.PI, 0); x.lineTo(cx + w / 2 + 4, by + 4); x.fill();
      // a dead mouth: the bright stop only in the bottom 20%, a coal bed (identity orange) and not a fire
      const g = x.createLinearGradient(0, by - h, 0, by); g.addColorStop(0, '#140806'); g.addColorStop(.8, '#3a1608'); g.addColorStop(1, '#a83a0e');
      x.fillStyle = g; x.beginPath(); x.moveTo(cx - w / 2, by); x.lineTo(cx - w / 2, by - h + w / 2); x.arc(cx, by - h + w / 2, w / 2, Math.PI, 0); x.lineTo(cx + w / 2, by); x.fill();
      // the dead are ash heaps now, broken remains on each
      for (let k = 0; k < 2; k++) {
        const mx = cx - 9 + k * 18 + r() * 4, mw = 8 + r() * 4, mh = 5 + r() * 3;
        x.fillStyle = 'rgba(52,8,4,.7)'; x.beginPath(); x.ellipse(mx + 2, by + 1, mw + 4, 2.2, 0, 0, TAU); x.fill(); // what ran out of them
        x.fillStyle = '#2a2220'; x.beginPath(); x.ellipse(mx, by, mw, mh, 0, Math.PI, 0); x.fill();
        remains(x, mx + r() * 4 - 2, by - mh - .5, 1.1, 'rgba(150,140,130,.8)', k ? -1 : 1);
      }
      x.fillStyle = '#1a0603'; for (let k = -2; k <= 2; k++) x.fillRect(cx + k * w / 5.2 - 1, by - h + 4, 2, h - 4);
      x.fillRect(cx - w / 2, by - h * .45, w, 2);
      pts.push({ x: cx, y: by - h * .12, w }); // the glow sits on the coals
    }
  },
  fireMidW: (x, r) => {
    // the meat-hooks: 2 charred stumps, 2 hooks hanging empty
    for (let i = 0; i < 4; i++) {
      const cx = 30 + i * 80 + r() * 30, len = 20 + r() * 60, s = 1.6 + r() * .5, sway = r() * .2 - .1;
      x.strokeStyle = '#0a0302'; x.lineWidth = 1; x.setLineDash([2, 1]); x.beginPath(); x.moveTo(cx, 0); x.lineTo(cx, len); x.stroke(); x.setLineDash([]);
      x.save(); x.translate(cx, len); x.rotate(sway);
      if (i % 2) {
        x.strokeStyle = '#2a1a14'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, 7); x.arc(-2.5, 7, 2.5, 0, Math.PI * .9); x.stroke();
      } else {
        x.save(); x.beginPath(); x.rect(-20, -4, 40, 11 * s); x.clip(); figure(x, 0, 11 * s, s, 'hang', '#100403', '#160604'); x.restore();
        x.strokeStyle = 'rgba(255,122,26,.5)'; x.lineWidth = .7;
        for (let k = 0; k < 2; k++) { const yy = (2 + r() * 8) * s / 1.6; x.beginPath(); x.moveTo(-1.5 + r() * 3, yy); x.lineTo(-1.5 + r() * 3, yy + 2 + r() * 2); x.stroke(); }
      }
      x.restore();
    }
  },
  acidFarW: (x, r, pts) => {
    // the 2 vats, drained: a residue at the bottom, a tide line at the old level (identity teal), crust, cracked glass
    for (let i = 0; i < 2; i++) {
      // the tank floor sits at PH * .8, above the terrain floor, so the residue and the dead on it are in view
      const cx = 80 + i * 160 + r() * 16, w = 64 + r() * 14, top = 46 + r() * 30, lvl = top + 26 + r() * 20, fh = 14 + r() * 10, base = PH * .8 | 0, fy = base - fh;
      x.fillStyle = '#070605'; x.fillRect(cx - w / 2, top, w, PH - top);
      x.fillStyle = 'rgba(120,96,70,.35)';
      for (let k = 0; k < 30; k++) x.fillRect((cx - w / 2 + 1 + r() * (w - 2)) | 0, (lvl + 2 + r() * (fy - lvl - 2)) | 0, 1 + (r() < .3), 1);
      x.fillStyle = 'rgba(26,120,104,.24)'; x.fillRect(cx - w / 2, fy, w, fh);
      // half-digested tissue clotted in the residue
      // smeared flat along the floor, not dots (tone note: no ketchup dots)
      for (let k = 0; k < 5; k++) { const tx = cx - w / 2 + 4 + r() * (w - 20), tw = 6 + r() * 12, ty = fy + 2 + r() * (fh - 4); x.fillStyle = 'rgba(70,22,14,.55)'; x.beginPath(); x.moveTo(tx, ty); x.lineTo(tx + tw, ty - .8 - r() * 1.2); x.lineTo(tx + tw * .7, ty + 1 + r()); x.closePath(); x.fill(); }
      x.fillStyle = '#1c120a'; x.fillRect(cx - w / 2 - 3, base, w + 6, 4); x.fillStyle = '#3e2412'; x.fillRect(cx - w / 2 - 3, base, w + 6, 1); // the tank floor plate
      x.fillStyle = 'rgba(63,232,200,.5)'; x.fillRect(cx - w / 2, lvl | 0, w, 1);
      // a grown crewman collapsed on the tank floor: bones lying flat (D46: nothing child-sized in the tanks)
      // its bones live in their own layer (drainedBodies) so they can fade out while the Womb is up (D46, Matt's call b)
      const body = [cx + 4 + r() * 4, fy, 2.2 + r() * .2, r() < .5 ? -1 : 1];
      // cracks in the glass
      const nc = 2 + (r() < .5);
      x.strokeStyle = 'rgba(200,240,230,.35)'; x.lineWidth = .7;
      for (let c = 0; c < nc; c++) { let px = cx - w / 2 + 6 + r() * (w - 12), py = top + 10 + r() * 60; x.beginPath(); x.moveTo(px, py); for (let q = 0; q < 5; q++) { px += r() * 10 - 5; py += 4 + r() * 8; x.lineTo(px, py); } x.stroke(); }
      x.strokeStyle = 'rgba(110,190,170,.3)'; x.lineWidth = 1.2; x.strokeRect(cx - w / 2 + .5, top + .5, w - 1, PH);
      x.fillStyle = 'rgba(210,255,240,.06)'; x.fillRect(cx - w / 2 + 5, top + 4, 3, PH);
      x.fillStyle = '#2c1a0e'; x.fillRect(cx - w / 2 - 4, top - 8, w + 8, 9); x.fillRect(cx - w / 2 - 3, lvl - 12, w + 6, 3);
      x.fillStyle = '#5e3416'; x.fillRect(cx - w / 2 - 4, top - 8, w + 8, 2);
      x.fillStyle = '#1c100a'; x.fillRect(cx - 4, 0, 8, top - 8);
      pts.push({ x: cx, y: fy, w, body });
    }
  },
  acidMidW: (x, r, pts) => {
    // the same gantry; the teal drips have dried to stains with a crust bead; the hung crewman is bone
    const by = 22 + r() * 10;
    wrap(x, () => { x.fillStyle = '#1e130c'; x.fillRect(0, by, LW, 7); x.fillStyle = '#3e2412'; x.fillRect(0, by, LW, 1); });
    for (let i = 0; i < 18; i++) { const hx = r() * LW, hr = 1 + r() * 2.2; wrap(x, () => { x.fillStyle = '#040302'; x.beginPath(); x.arc(hx, by + 3.5, hr, 0, TAU); x.fill(); }); }
    for (let i = 0; i < 26; i++) { const dx = r() * LW | 0, l = 6 + r() * 46; wrap(x, () => { x.fillStyle = 'rgba(120,90,60,.25)'; x.fillRect(dx, by + 7, 1, l); x.fillStyle = 'rgba(220,215,200,.6)'; x.fillRect(dx, by + 7 + l, 1, 1); }); }
    for (let i = 0; i < 4; i++) { const sx = 20 + i * 80 + r() * 30; wrap(x, () => { x.strokeStyle = '#1a100a'; x.lineWidth = 4; x.beginPath(); x.moveTo(sx, by + 6); x.lineTo(sx + 24, by + 46); x.stroke(); }); }
    // the hung crewman's bones: own layer (drainedHung) so they fade while the Womb is up (D46, Matt's call b)
    pts.push({ hang: [60 + r() * 200, by] });
  },
  // two passes (two warm slices): one pass measured 5.8 ms at 4x, over the 4 ms slice limit
  snotFarW: [(x, r) => {
    // the sinus wall infected: the mucosa flips to mostly a dark raw red, more and heavier veins, jagged rather than smooth
    for (let i = 0; i < 16; i++) { const cx = r() * LW, cy = r() * PH, a = 14 + r() * 40, c = r() < .7 ? `rgba(100,20,14,${.09 + r() * .07})` : `rgba(90,70,24,${.08 + r() * .05})`; wrap(x, () => { x.fillStyle = c; x.beginPath(); x.ellipse(cx, cy, a, a * .7, 0, 0, TAU); x.fill(); }); }
    for (let i = 0; i < 11; i++) {
      let a = r() * TAU; const pts = [[r() * LW, r() * PH]]; for (let k = 0; k < 14; k++) { a += r() * 1.2 - .6; pts.push([pts[k][0] + Math.cos(a) * 7, pts[k][1] + Math.sin(a) * 7]); }
      wrap(x, () => { x.strokeStyle = 'rgba(110,12,10,.6)'; x.lineWidth = 1.5; x.lineCap = 'round'; x.lineJoin = 'miter'; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) x.lineTo(pts[k][0], pts[k][1]); x.stroke(); });
    }
  }, (x, r) => {
    // the pores become abscesses: a dark ring, a small pus core (the identity yellow, dimmed), a black centre
    for (let i = 0; i < 12; i++) {
      // torn slits along the tissue, not round pores (tone note: no circles)
      const cx = r() * LW, cy = r() * PH, a = 1.4 + r() * 2.2, rot = r() * Math.PI;
      wrap(x, () => {
        x.fillStyle = 'rgba(90,18,10,.65)'; x.beginPath(); x.ellipse(cx, cy, a + 1.8, (a + 1.8) * .4, rot, 0, TAU); x.fill();
        x.fillStyle = 'rgba(236,210,90,.38)'; x.beginPath(); x.ellipse(cx, cy, a + .3, (a + .3) * .3, rot, 0, TAU); x.fill(); // the pus core (identity)
        x.fillStyle = 'rgba(16,6,2,.8)'; x.beginPath(); x.ellipse(cx, cy, a * .6, a * .12 + .3, rot, 0, TAU); x.fill();
      });
    }
  }],
  snotMidW: (x, r) => {
    for (let i = 0; i < 5; i++) {
      const x0 = r() * LW, w = 30 + r() * 50, sag = 30 + r() * 70, n = 6, bot = [...Array(n + 1)].map((_, k) => sag * Math.sin(Math.PI * k / n) * (.6 + r() * .5));
      const drips = [...Array(3)].map(() => [x0 + r() * w, 6 + r() * 20]);
      const streaks = [...Array(1 + (r() < .5))].map(() => [x0 + 4 + r() * (w - 8), .4 + r() * .5]);
      wrap(x, () => {
        x.fillStyle = 'rgba(140,80,40,.2)'; x.beginPath(); x.moveTo(x0, 0); for (let k = 0; k <= n; k++) x.lineTo(x0 + w * k / n, bot[k]); x.lineTo(x0 + w, 0); x.fill();
        x.strokeStyle = 'rgba(200,160,120,.18)'; x.lineWidth = 1; x.beginPath(); for (let k = 0; k <= n; k++) k ? x.lineTo(x0 + w * k / n, bot[k] - 3) : x.moveTo(x0, bot[0]); x.stroke();
        for (const [sx, f] of streaks) { const sb = bot[Math.round((sx - x0) / w * n)] || 0; x.fillStyle = 'rgba(110,16,10,.45)'; x.fillRect(sx, 0, 1.5, sb * f + 4); }
        for (const [dx, dl] of drips) { const by = bot[Math.round((dx - x0) / w * n)] || 0; x.fillStyle = 'rgba(150,100,40,.3)'; x.fillRect(dx, by - 2, 1.5, dl); x.beginPath(); x.arc(dx + .7, by + dl, 2, 0, TAU); x.fill(); }
      });
    }
    for (let i = 0; i < 4; i++) { const cx = r() * LW, w = 30 + r() * 40, h = 14 + r() * 26; wrap(x, () => { x.fillStyle = 'rgba(150,70,40,.2)'; x.beginPath(); x.ellipse(cx, PH, w, h, 0, Math.PI, 0); x.fill(); }); }
  },
};
/** the wound layer keys, far then mid per biome (warm order) */
export const WOUND_KEYS = Object.keys(P);

const WL = {}, WPT = {}, BUILD = {};
const passes = (key) => (Array.isArray(P[key]) ? P[key] : [P[key]]);
/** paint the next pass of a wound layer (one warm slice); true once the layer is complete. The rng and point list carry
 *  over between passes, so a layer built in slices is the same art as one built at once */
function step(key) {
  let B = BUILD[key];
  if (!B) { const c = cnv(LW, PH, () => {}); B = BUILD[key] = { c, x: c.getContext('2d'), r: rng(fnv(key)), pts: [], i: 0 }; }
  const ps = passes(key);
  ps[B.i++](B.x, B.r, B.pts);
  if (B.i < ps.length) return false;
  WL[key] = B.c; WPT[key] = B.pts; delete BUILD[key];
  return true;
}
/** the drained gantry's hung crewman, from acidMidW's point list onto its own layer (render/biomeart.ts fades it) */
export function drainedHung(x, pts) {
  for (const p of pts) {
    if (!p.hang) continue;
    const [hx, by] = p.hang;
      x.strokeStyle = '#140c08'; x.lineWidth = 1; x.beginPath(); x.moveTo(hx, by + 7); x.lineTo(hx, by + 30); x.stroke();
      x.strokeStyle = 'rgba(180,172,155,.8)'; x.lineWidth = 1.2; x.beginPath();
      x.moveTo(hx, by + 32); x.lineTo(hx, by + 56); // spine
      x.moveTo(hx, by + 34); x.lineTo(hx - 4, by + 44); x.lineTo(hx - 4, by + 52); x.moveTo(hx, by + 34); x.lineTo(hx + 4, by + 44); x.lineTo(hx + 5, by + 51); // arms
      x.moveTo(hx, by + 56); x.lineTo(hx - 3, by + 68); x.lineTo(hx - 3, by + 78); x.moveTo(hx, by + 56); x.lineTo(hx + 3, by + 68); x.lineTo(hx + 4, by + 77); // legs
      x.stroke();
      x.lineWidth = .8; for (let q = 0; q < 4; q++) { x.beginPath(); x.arc(hx, by + 37 + q * 3.4, 3.6, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
      // what is left of the head: the cranium's back half, the jaw hanging on below it
      x.fillStyle = 'rgba(180,172,155,.85)'; x.beginPath(); x.moveTo(hx - 3.5, by + 30); x.lineTo(hx - 3.2, by + 26); x.lineTo(hx - .5, by + 23.5); x.lineTo(hx + 2.5, by + 25); x.lineTo(hx + 1, by + 28); x.lineTo(hx + 2.2, by + 30.5); x.closePath(); x.fill();
      x.fillStyle = '#0a0806'; x.fillRect(hx - 1.8, by + 26.5, 1.2, 1);
      x.strokeStyle = 'rgba(180,172,155,.8)'; x.lineWidth = 1; x.beginPath(); x.moveTo(hx - 2.5, by + 31.5); x.lineTo(hx - .5, by + 34); x.lineTo(hx + 1.8, by + 32.5); x.stroke();
  }
}
/** the drained tanks' dead, painted from acidFarW's point list onto their own layer: render/biomeart.ts fades it while the Womb is up */
export function drainedBodies(x, pts) {
  for (const p of pts) {
    if (!p.body) continue;
    const [bx, fy, s, dir] = p.body;
    x.strokeStyle = 'rgba(170,164,150,.75)'; x.lineWidth = .8;
    x.beginPath(); x.moveTo(bx - 9 * s * dir, fy - 1); x.lineTo(bx + 5 * s * dir, fy - 1.5); x.stroke(); // spine
    for (let q = 0; q < 4; q++) { const rx = bx + (q * 1.8 - 3) * s * dir; x.beginPath(); x.arc(rx, fy - 1.5, 2 * s, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); }
    x.beginPath(); x.moveTo(bx - 9 * s * dir, fy - 1); x.lineTo(bx - 15 * s * dir, fy - .5); x.moveTo(bx - 9 * s * dir, fy - 1); x.lineTo(bx - 14 * s * dir, fy - 3); x.stroke(); // legs
    remains(x, bx + 8 * s * dir, fy - 2 * s, s * .8, 'rgba(170,164,150,.85)', dir);
  }
}
/** a wound layer, built now if it is not yet (the lazy path: the warm-up should have built it, see warmWound) */
export function wlay(key) {
  while (!WL[key]) step(key);
  return WL[key];
}
/** a wound layer only if it is built already: the gate preview never bakes (spec §6) */
export const wBuilt = (key) => WL[key] || null;
/** a wound layer's point list (glints, vat and mouth glows) */
export const wPts = (key) => WPT[key];

/** warm unit wound:<b> (warmup.ts): one pass per slice, far then mid (snot's far layer is two). True while one remains */
export function warmWound(b) {
  const f = b + 'FarW', m = b + 'MidW';
  step(WL[f] ? m : f);
  return !(WL[f] && WL[m]);
}
/** how many warm slices a biome's wound unit takes (tests, probes) */
export const woundSlices = (b) => passes(b + 'FarW').length + passes(b + 'MidW').length;
/** both wound layers are complete (the warm check, and drawBiomeBG's gate) */
export const woundBuilt = (b) => !!(WL[b + 'FarW'] && WL[b + 'MidW']);
/** any part of the wound is held, finished or half-built (the drop check: a half-built wound is freed on a new run) */
export const woundHeld = (b) => !!(WL[b + 'FarW'] || WL[b + 'MidW'] || BUILD[b + 'FarW'] || BUILD[b + 'MidW']);
export function dropWound(b) { for (const k of [b + 'FarW', b + 'MidW']) { delete WL[k]; delete WPT[k]; delete BUILD[k]; } }

// ---------------- per-frame overlays: hash-placed, one path per colour, no gradient per frame ----------------
let WASH = null;
/** the thawed vault's slush wash on the floor (cached once, like bgGrad) */
export function iceWash() {
  if (WASH) return WASH;
  const g = ctx.createLinearGradient(0, PH * .6, 0, PH), c = WOUND.ice.wash;
  g.addColorStop(0, `rgba(${c},0)`); g.addColorStop(1, `rgba(${c},${WOUND.ice.washA})`);
  return (WASH = g);
}
const wrapX = (v) => ((v % W) + W) % W;
/** ice: meltwater dripping from the ceiling, 18 drips */
export function iceDrips(sc, t) {
  ctx.fillStyle = 'rgba(150,180,210,.35)'; ctx.beginPath();
  for (let i = 0; i < 18; i++) { const x = wrapX(hash(i * 5.3) * 1000 - sc * .6), y = (t * (.8 + hash(i * 2.1) * .7) + hash(i * 9.7) * PH) % PH; ctx.rect(x | 0, y | 0, 1, 3); }
  ctx.fill();
}
/** fire: 60 ash motes falling slowly, and 10 embers rising (the identity orange) */
export function fireAsh(sc, t) {
  // 2 x 1 px at .85 so the fall reads in motion (art-director check pass)
  ctx.fillStyle = 'rgba(150,140,135,.85)'; ctx.beginPath();
  for (let i = 0; i < 60; i++) { const x = wrapX(hash(i * 3.1) * 1000 - sc * .5 + Math.sin(t * .02 + i) * 6), y = (t * (.12 + hash(i * 7) * .2) + hash(i * 1.7) * PH) % PH; ctx.rect(x | 0, y | 0, 2, 1); }
  ctx.fill();
  ctx.fillStyle = '#ff7a1a'; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const x = wrapX(hash(i * 4.4 + 1) * 1000 - sc * .5 + Math.sin(t * .03 + i) * 4), y = PH - ((t * (.4 + hash(i * 8.8) * .5) + hash(i * 6.1) * PH) % PH); ctx.rect(x | 0, y | 0, 1, 1); }
  ctx.fill();
}
/** acid: 20 crust flakes drifting down */
export function acidFlakes(sc, t) {
  ctx.fillStyle = 'rgba(130,115,92,.45)'; ctx.beginPath();
  for (let i = 0; i < 20; i++) { const x = wrapX(hash(i * 2.7 + 3) * 1000 - sc * .4 + Math.sin(t * .015 + i * 2) * 8), y = (t * (.15 + hash(i * 3.9) * .25) + hash(i * 5.5) * PH) % PH; ctx.rect(x | 0, y | 0, 1, 1); }
  ctx.fill();
}

// ---------------- the gate portal (spec §6) ----------------
/** the wound layer a remix gate shows through its portal (the twin of biomeart.ts PREV) */
export const PREVW = { ice: 'iceMidW', acid: 'acidFarW', fire: 'fireFarW', snot: 'snotFarW' };
/** the portal particles for a remix gate (twin of biomeart.ts MOTIF): same motion family, damaged colours */
export const MOTIFW = {
  ice: (x, y, r, i, t) => { const ph = ((t * .6 + i * 23) % 80) / 80; ctx.fillStyle = 'rgba(150,60,72,.85)'; ctx.fillRect(x - r + ((i * 37) % (2 * r)) + Math.sin(ph * 6 + i) * 2, y - r + ph * 2 * r, 1, 1 + (i % 2)); },
  acid: (x, y, r, i, t) => { const ph = ((t * .35 + i * 19) % 80) / 80; ctx.fillStyle = 'rgba(170,150,120,.85)'; ctx.fillRect(x - r + ((i * 37) % (2 * r)) + Math.sin(ph * 5 + i) * 2, y - r + ph * 2 * r, 1 + (i % 2), 1); },
  fire: (x, y, r, i, t) => {
    const ph = ((t * .5 + i * 17) % 60) / 60, px = x - r + ((i * 37) % (2 * r)) + Math.sin(ph * 7 + i) * 3;
    if (i % 5 === 0) { ctx.fillStyle = FIRE[i % 5]; ctx.fillRect(px, y + r - ph * 2 * r, 1, 2); } // 2 of the 10 still rise as embers
    else { ctx.fillStyle = '#8a8078'; ctx.fillRect(px, y - r + ph * 2 * r, 1, 1); }
  },
  snot: (x, y, r, i, t) => { const ph = ((t * .4 + i * 29) % 90) / 90, px = x - r + ((i * 37) % (2 * r)); ctx.strokeStyle = 'rgba(160,90,40,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, y - r); ctx.lineTo(px, y - r + ph * r * 1.4); ctx.stroke(); ctx.fillStyle = '#ecd25a'; ctx.beginPath(); ctx.arc(px, y - r + ph * r * 1.4 + 1.5, 1.8, 0, TAU); ctx.fill(); },
};

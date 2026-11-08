// Gate plates: what each fork gate's plate says (name, flavour, the perk at stake, the ALTERED chip) and where the plate sits.
// Pure and import-free on purpose: the caller (biomeart.ts drawGates) passes the run fields, the perk row, pk() and a
// text measurer in, so this module never reaches the DOM, audio or the sim RNG. Reads only; never writes $.G.
// Spec: ls2-read item 1 (ux-designer plate.md). The chip follows G.bvis (what remix() reads), the perk line follows
// G.visited and pk() (what perks.ts avail() reads), so each element stays truthful even if the two fields diverge.

export type PlatePerk = { id: string; name: string; max: number };
export type PlateRun = { visited?: readonly string[] | null; bvis?: Readonly<Record<string, number>> | null };
export type PerkState = 'unlock' | 'known' | 'spent';
export type PlateLines = {
  name: string; tag: string;
  perk: string | null; perkState: PerkState | null; perkCol: string | null;
  // the perk line split by role: perkLead in the tag grey, then perkName in perkCol (perk === perkLead + perkName when
  // the line is the unlock; known/spent lines have perkLead '' and perkName === perk, all in perkCol)
  perkLead: string; perkName: string | null;
  mark: typeof PLATE_COPY.remix | null; // the chip: the biome is a repeat visit, so remix() runs
};
export type PlateBox = { x: number; y: number; w: number; h: number; tipX: number; slid: boolean; leaderTo: number | null };

/** plate geometry and colours at the 480x270 canvas. h: 3 lines; h2: 2 lines (no perk row for the biome) */
export const PLATE = {
  h: 32, h2: 23, padX: 12, chipGap: 4, chipPad: 2, boxHalfW: 44, boxHalfH: 14, margin: 2, arrow: 9, minX: 4,
  gap: 14, // the plate's right edge sits this far left of the gate's radius (as before this change)
  textX: 7, nameY: 3, chipY: 2, chipH: 10, tagY: 13, perkY: 22,
  tagPx: 8, // flavour at 8px, not 7: Silkscreen is an 8px grid and smears at 7 on the Fold cover (a11y review)
  // .85, not .72: keeps the greys >= 4.5:1 with the gate glow or bright fog behind the plate (a11y review, SC 1.4.3)
  fill: 'rgba(0,0,0,.85)',
  // gold = "this feeds a mutation" everywhere in the HUD. known/spent are a11y-raised greys (both >= 4.5:1 on the plate),
  // with a brightness step gold > known > spent. Chip: dark text on the biome col, >= 7.5:1 (FURNACE lowest)
  col: { unlock: '#ffd23a', known: '#b0bccb', spent: '#8a98a8', chipText: '#0a0d12', tag: '#9fb0c2' },
} as const;

/** every player-facing string on the plate; narrative edits these, not the logic. Keep each line <= 27 chars */
export const PLATE_COPY = {
  unlockLead: 'UNLOCKS ', // drawn in the tag grey; only the perk name is gold, so SINUS's yellow name can't blend with it
  unlock: (n: string) => `${PLATE_COPY.unlockLead}${n}`,
  known: (n: string) => `${n}: KNOWN`,
  spent: (n: string) => `${n}: FULLY GROWN`,
  remix: 'ALTERED' as const, // narrative-director, under the colder tone; the code still calls it remix()
};

/** what gate b's plate says; pure. perk: the PERKS row with req === b, or null */
export function plateLines(b: string, B: { name: string; tag: string }, G: PlateRun | null | undefined,
  perk: PlatePerk | null, pk: (id: string) => number): PlateLines {
  const bvis = (G && G.bvis) || null, visited = (G && G.visited) || null;
  const mark = bvis && (bvis[b] || 0) >= 1 ? PLATE_COPY.remix : null;
  let perkState: PerkState | null = null;
  if (perk) perkState = pk(perk.id) >= perk.max ? 'spent' : visited && visited.includes(b) ? 'known' : 'unlock';
  const line = perk && perkState ? PLATE_COPY[perkState](perk.name) : null, lead = perkState === 'unlock' ? PLATE_COPY.unlockLead : '';
  return {
    name: B.name, tag: B.tag,
    perk: line, perkState, perkCol: perkState ? PLATE.col[perkState] : null,
    perkLead: lead, perkName: line === null ? null : line.slice(lead.length),
    mark,
  };
}

/** plate height: 3 lines with a perk line, 2 without */
export const plateH = (L: PlateLines) => (L.perk ? PLATE.h : PLATE.h2);

/** true when a plate centred on gy would cross the FLY INTO A GATE box rows; depends on gy only, so it never flickers */
export const plateSlides = (gy: number, cy: number) => Math.abs(gy - cy) < PLATE.h / 2 + PLATE.boxHalfH + PLATE.margin;

/** the plate's right edge for a gate at (gx, gy), radius r; slid plates keep the arrow tip 2px left of the box. No alloc */
export function plateRight(gx: number, gy: number, r: number, cx: number, cy: number): number {
  const xr = gx - r - PLATE.gap;
  return plateSlides(gy, cy) ? Math.min(xr, cx - PLATE.boxHalfW - PLATE.margin - PLATE.arrow) : xr;
}

/** plate width from the measured lines; measure(text, px) -> width */
export function plateW(L: PlateLines, measure: (s: string, px: number) => number): number {
  const nameW = measure(L.name, 8) + (L.mark ? PLATE.chipGap + measure(L.mark, 8) + 2 * PLATE.chipPad : 0);
  return Math.max(nameW, measure(L.tag, PLATE.tagPx), L.perk ? measure(L.perk, 8) : 0) + PLATE.padX;
}

/** plate rectangle for a gate at (gx, gy) with radius r; measure(text, px) -> width. Countdown box at (cx, cy) */
export function plateBox(L: PlateLines, gx: number, gy: number, r: number,
  measure: (s: string, px: number) => number, cx: number, cy: number, ph: number): PlateBox {
  const h = plateH(L), w = plateW(L, measure), xr = plateRight(gx, gy, r, cx, cy), slid = plateSlides(gy, cy);
  const y = Math.max(PLATE.margin, Math.min(ph - h - PLATE.margin, gy - h / 2));
  return { x: Math.max(PLATE.minX, xr - w), y, w, h, tipX: xr + PLATE.arrow, slid, leaderTo: slid ? gx - r * .86 - 7 : null };
}

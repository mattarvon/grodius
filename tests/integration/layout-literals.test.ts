// LS1 row A acceptance: no literal world x left outside src/layout.ts. Reads the source files (hence an integration
// test). LAYOUT_LITERALS_ROOT points it at another tree, e.g. the pre-table source, to watch it fail.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { LAYOUTS } from '../../src/layout';

const ROOT = process.env.LAYOUT_LITERALS_ROOT || join(__dirname, '../../src');
const files = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : []; });
// comments may cite x values ("the Saucer's WARNING is at 800"); only code counts
const code = (p: string) => readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
const SRC = files(ROOT).filter((p) => !p.endsWith('layout.ts')).map((p) => ({ f: relative(ROOT, p), s: code(p) }));

/** every world x the layout entries carry (the numbers that must live only in the table) */
const ANCHORS = new Set<number>();
for (const L of Object.values(LAYOUTS)) {
  ANCHORS.add(L.level);
  for (const r of L.stages) [r.x0, r.x1, r.end, r.bossX, r.warnX, ...(r.drift || []).flatMap((d) => [d.at, d.gapEnd])].forEach((x) => x && ANCHORS.add(x));
  [...L.tEnd, ...Object.values(L.bands).flat(), ...Object.values(L.hell).flat(), ...L.hudMarks, ...L.terrain.blocks, ...L.terrain.fT, ...L.terrain.cT, ...L.terrain.kT, ...L.terrain.zT].forEach((x) => ANCHORS.add(x));
}
// every file is scanned for anchor numbers: a world x can turn up in any of them (stagebuild, checkpoint, jump and the
// midboss registry came after row A's original 8-file list). NOT_X names, per file, the anchor-valued numbers that are
// something else; a new collision fails here and goes in this table with what the number is, never as a file skip
const NOT_X: Record<string, number[]> = {
  'audio.ts': [800, 2300, 2400, 4200, 5200], // oscillator and filter Hz
  'audiomix.ts': [800], // the presence peak's Hz (EQ.presF)
  'music.ts': [2400], // filter Hz
  'economy.ts': [2100, 2400], // BIO_LONG bio bands
  'enemies/spawn.ts': [800], // kill score
  'enemies/mid/roster.ts': [2000], // part of a name: SQUID SAUCER 2000 (Matt, 2026-11-09)
  'flow.ts': [5000], // the lives bonus score
  'fx/spawn.ts': [4800], // the drop-array cap
  'midpick.ts': [1080], // a midboss leave clock in frames
  'mutations.ts': [800], // mutation costs
  'save.ts': [800], // pre-migration costs
  'stages.ts': [2000, 5000, 10000], // grade and perfect-stage scores
};
// the world-x shape checks below that look at scroll locals stay on the files that held anchors before the table
// (build plan row A's list, plus the HUD depth bar): `s` and `sc` are other things elsewhere
const ANCHOR_FILES = ['core.ts', 'world.ts', 'biomes.ts', 'enemies/scripts.ts', 'enemies/mid/ufo.ts', 'render/terrain.ts', 'render/hud.ts', 'fx/update.ts'];

const hits = (re: RegExp, only?: string[]) => SRC.filter((x) => !only || only.includes(x.f)).flatMap(({ f, s }) => [...s.matchAll(re)].map((m) => `${f}: ${m[0].trim()}`));

describe('no literal world x outside src/layout.ts', () => {
  it('has no layout anchor number in any source file, past the named non-x values', () => {
    const found = hits(/(?<![\w.#])\d{3,5}(?![\w.])/g).filter((h) => { const [f, n] = h.split(': '); return ANCHORS.has(+n) && !NOT_X[f]?.includes(+n); });
    expect(found).toEqual([]);
  });

  it('names only non-x values that are still in their file, so the table cannot hide a stale exemption', () => {
    const stale = Object.entries(NOT_X).flatMap(([f, ns]) => ns.filter((n) => !hits(new RegExp(`(?<![\\w.#])${n}(?![\\w.])`, 'g'), [f]).length).map((n) => `${f}: ${n}`));
    expect(stale).toEqual([]);
  });

  it('declares no world-x constant (LEVEL, BOSS_AT, SEG, T_END, UFO_AT, UFO_GAP_END) as a literal', () => {
    expect(hits(/\b(LEVEL|BOSS_AT|SEG|T_END\d?|UFO_AT|UFO_GAP_END)\s*=\s*[\d[{]/g)).toEqual([]);
  });

  it('has no band (sstep) or scroll comparison on a world-x literal', () => {
    expect(hits(/sstep\(\s*\d{4,}/g)).toEqual([]);
    expect(hits(/scroll\s*[<>]=?\s*\d{4,}/g)).toEqual([]);
    // arithmetic on the scroll with a world-x literal (G.scroll - 2300, 9300 - $.G.scroll)
    expect(hits(/scroll\s*[-+]\s*\d{4,}|\b\d{4,}\s*[-+]\s*(\$\.G\.|G\.)?scroll\b/g)).toEqual([]);
    // a scroll copied into a local and compared there (const s = G.scroll; s > 9300): flag any 4+ digit comparison on
    // the usual scroll locals in the anchor files
    expect(hits(/\b(sc|s)\s*[<>]=?\s*\d{4,}/g, ANCHOR_FILES)).toEqual([]);
  });

  it('has no script entry at an absolute world x past Open Orbit (script x is stage-relative)', () => {
    const orbitLen = Math.min(...Object.values(LAYOUTS).map((L) => L.stages[0].x1));
    expect(hits(/\bat\(\s*(\d+)/g).filter((h) => +h.match(/\d+$/)![0] >= orbitLen)).toEqual([]);
  });

  // technical-director condition C1 (LS1-A review): the boot-time aliases (core LEVEL/BOSS_AT, biomes SEG, ufo
  // UFO_AT/UFO_GAP_END) copied the layout active at import, so they go stale once a second entry can be activated.
  // Item J deleted them before item D added one. The pattern is wider than the alias shape (any declaration or
  // assignment of those names, not only `= layout()`), so they cannot come back under the pre-table names at all.
  const ALIAS = /\b(LEVEL|BOSS_AT|SEG|UFO_AT|UFO_GAP_END)\s*=(?!=)/g;
  it('has none of the deleted layout aliases (LEVEL, BOSS_AT, SEG, UFO_AT, UFO_GAP_END)', () => {
    expect(hits(ALIAS)).toEqual([]);
  });

  it('trips on a layout alias whenever a second layout entry exists', () => {
    const tripped = (keys: string[], found: string[]) => keys.length > 1 && found.length > 0;
    expect(tripped(Object.keys(LAYOUTS), hits(ALIAS))).toBe(false);
    // the tripwire itself: it fires for a second entry while any alias exists, and not without one
    expect(tripped(['short', 'long4'], ['core.ts: LEVEL = layout()'])).toBe(true);
    expect(tripped(['short', 'long4'], [])).toBe(false);
  });
});

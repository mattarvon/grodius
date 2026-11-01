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
// the files that held world-x anchors before the table (build plan row A's list, plus the HUD depth bar); any anchor
// number in their code is a leftover. Other files are only checked for the world-x shapes below: their numbers are
// scores and filter Hz (stages.ts pays 5000 for a B, music.ts filters at 2400 Hz), not x values
const ANCHOR_FILES = ['core.ts', 'world.ts', 'biomes.ts', 'enemies/scripts.ts', 'enemies/ufo.ts', 'render/terrain.ts', 'render/hud.ts', 'fx/update.ts'];

const hits = (re: RegExp, only?: string[]) => SRC.filter((x) => !only || only.includes(x.f)).flatMap(({ f, s }) => [...s.matchAll(re)].map((m) => `${f}: ${m[0].trim()}`));

describe('no literal world x outside src/layout.ts', () => {
  it('has no layout anchor number in the files that used to hold them', () => {
    const found = hits(/(?<![\w.#])\d{3,5}(?![\w.])/g, ANCHOR_FILES).filter((h) => ANCHORS.has(+h.split(': ')[1]));
    expect(found).toEqual([]);
  });

  it('declares no world-x constant (LEVEL, BOSS_AT, SEG, T_END, UFO_AT, UFO_GAP_END) as a literal', () => {
    expect(hits(/\b(LEVEL|BOSS_AT|SEG|T_END\d?|UFO_AT|UFO_GAP_END)\s*=\s*[\d[{]/g)).toEqual([]);
  });

  it('has no band (sstep) or scroll comparison on a world-x literal', () => {
    expect(hits(/sstep\(\s*\d{4,}/g)).toEqual([]);
    expect(hits(/scroll\s*[<>]=?\s*\d{4,}/g)).toEqual([]);
  });

  it('has no script entry at an absolute world x past Open Orbit (script x is stage-relative)', () => {
    const orbitLen = Math.min(...Object.values(LAYOUTS).map((L) => L.stages[0].x1));
    expect(hits(/\bat\(\s*(\d+)/g).filter((h) => +h.match(/\d+$/)![0] >= orbitLen)).toEqual([]);
  });
});

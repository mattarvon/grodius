// Beat probe (build plan sprint 2 item D): density-probe for any layout entry. Builds every biome script (4 biomes x
// both slots x first visit / repeat visit x Descent 1/2, averaged over N rolls) straight from biomeScript on the layout
// the page flies, at each slot's late gate (gateLate), and counts spawn calls per beat band of THAT entry's beat table
// (src/layout.ts beatPlan: the tempo bands, the breaths, the release, the run-up). Prints count and spawns/s per band
// (60 px of scroll = 1 s), the total, the peak rate, and checks:
//   breaths  no spawn call lands inside a breath
//   runup    no spawn call lands in the arena run-up (layouts that have one)
//   peak     peak band <= 1.7 spawns/s (LS1 exit, density)
//   warn     no set piece within 150 px of a WARNING (the midboss WARNING, every breath's WARNING slot, bossX)
// Set pieces count as one call; logs, WARNINGs and the boss don't count.
// Usage: node tools/beat-probe.mjs [url] [--layout long] [--n 200]
//   No url: starts its own Vite dev server. --layout is appended as ?layout= (src/main.ts flag parse).
//   Not measured: spawn-time sides/positions/elite rolls (only the build); the early gate (only gateLate, the shorter
//   and therefore denser span); Descent 3+.
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const LAYOUT = opt('--layout', null), N = +opt('--n', '200');
let url = argv.find((a, i) => !a.startsWith('--') && !['--layout', '--n'].includes(argv[i - 1])), server;
if (!url) {
  const { createServer } = await import('vite');
  server = await createServer({ server: { port: 5599, strictPort: false, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  url = server.resolvedUrls.local[0];
}
if (LAYOUT) url += (url.includes('?') ? '&' : '?') + 'layout=' + LAYOUT;

const b = await chromium.launch(); const p = await b.newPage();
await p.addInitScript(() => { window.requestAnimationFrame = () => 1; window.speechSynthesis = undefined; });
await p.goto(url); await p.waitForFunction(() => window.__started);
const res = await p.evaluate(async (N) => {
  const { biomeScript, BIOMES } = await import('/src/biomes.ts'), { $ } = await import('/src/state.ts'), L = await import('/src/layout.ts');
  const LY = L.layout(), BT = LY.beats, out = { id: LY.id, rows: [] }, G0 = $.G;
  for (const loop of [0, 1]) for (let seg = 0; seg < L.nSlots(); seg++) for (const v of [0, 1]) for (const bk of Object.keys(BIOMES)) {
    const r = L.slotRow(seg), from = r.gateLate ?? r.x0, P = L.beatPlan(r, from, !!v), span = P.z - P.a;
    // the bands: each tempo band's [start, end) in scroll x, with the breaths cut out as their own bands
    const cuts = [], names = [];
    let x0 = P.a;
    BT.tempo.forEach((T, i) => {
      const end = typeof T.until === 'number' ? P.P(T.until) : P.breaths[T.until.breath].z;
      const nm = T.stop ? 'runup' : T.lead === 'sig' ? 'introA' : T.lead === 'second' ? 'introB' : typeof T.until === 'object' ? `build${T.until.breath + 1}` : T.third && T.dbl > 0 ? 'peak' : i === BT.tempo.length - 1 ? 'tail' : `t${i}`;
      if (end > x0) { cuts.push([x0, Math.min(end, P.z)]); names.push(nm); x0 = Math.min(end, P.z); }
    });
    const bands = [];
    cuts.forEach(([a, z], i) => {
      let s = a;
      for (const [k, br] of P.breaths.entries()) if (br.a < z && br.z > a) {
        if (br.a > s) bands.push([names[i], s, br.a]);
        bands.push([`breath${k + 1}`, Math.max(br.a, a), Math.min(br.z, z)]); s = Math.min(br.z, z);
      }
      if (z > s) bands.push([names[i], s, z]);
    });
    const c = bands.map(() => 0), bad = { breath: 0, runup: 0 };
    let tot = 0;
    for (let n = 0; n < N; n++) {
      $.G = { loop, rank: 0, pend: [] };
      for (const e of biomeScript(seg, bk, from, v)) {
        const s = e.f.toString();
        if (/logLine|miniWarn/.test(s)) continue;
        if (P.breaths.some((br) => e.x >= br.a && e.x < br.z)) bad.breath++;
        if (P.runup != null && e.x >= P.runup && e.x < r.bossX) bad.runup++;
        let k = bands.findIndex(([, a, z]) => e.x >= a && e.x < z);
        if (k < 0) k = bands.length - 1;
        c[k]++; tot++;
      }
    }
    const warns = [...P.breaths.map((br) => br.z - BT.warnLead), r.bossX];
    const setGap = Math.min(...P.sets.map((x) => Math.min(...warns.map((w) => Math.abs(w - x)))));
    out.rows.push({ k: `L${loop} s${seg} ${bk}${v ? '+' : ' '}`, tot: tot / N, span, bands: bands.map(([nm, a, z], i) => [nm, c[i] / N, c[i] / N / Math.max(1e-9, (z - a) / 60)]), bad, setGap });
  }
  $.G = G0;
  return out;
}, N);
await b.close();
if (server) await server.close();
console.log(`layout ${res.id}, ${N} rolls per row, late gate`);
const f = (v) => v.toFixed(2).padStart(5);
let peakMax = 0, breathBad = 0, runupBad = 0, setMin = 1e9;
for (const r of res.rows) {
  const pk = Math.max(0, ...r.bands.filter(([nm]) => nm === 'peak').map(([, , ps]) => ps));
  peakMax = Math.max(peakMax, pk); breathBad += r.bad.breath; runupBad += r.bad.runup; setMin = Math.min(setMin, r.setGap);
  console.log(r.k.padEnd(13) + r.bands.map(([nm, c, ps]) => `${nm} ${c.toFixed(1)} @${f(ps)}/s`).join(' | ') + `  total ${r.tot.toFixed(1)}`);
}
console.log(`peak max ${peakMax.toFixed(2)}/s (exit <= 1.7): ${peakMax <= 1.7 ? 'ok' : 'OVER'};  spawns in a breath ${breathBad};  spawns in the run-up ${runupBad};  closest set piece to a WARNING ${setMin.toFixed(0)} px (>= 150: ${setMin >= 150 ? 'ok' : 'FAIL'})`);
console.log('not measured: spawn-time rolls; the early gate; Descent 3+');

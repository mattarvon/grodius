// Kill-layer check (ls1-audit, the ls2-read rebase): a real killEnemy() in every biome with a REAL AudioContext and the
// real sound bank. The harness removes AudioContext, so it can never reach sfx.gore's kill layer; a bad name there
// throws from a sound call inside the update. Each biome: big kills until its layer has played, or 60 tries.
// A biome whose clips are not in the bank falls back to its synth row, which this reports (no clip to see).
// Not measured: how it sounds; a phone's AudioContext. Usage: node tools/biome-kill-check.mjs <url>
import { chromium } from 'playwright';

const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }), p = await b.newPage({ viewport: { width: 960, height: 540 } });
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.addInitScript(() => { window.speechSynthesis = undefined; try { localStorage.clear(); localStorage.setItem('grodius.v1', '{"meta":{"v":3},"asked":true}'); } catch (e) {} });
await p.goto(process.argv[2]);
await p.waitForFunction(() => window.__started, null, { timeout: 30000 });
await p.keyboard.press('KeyX'); // the audio gate
await p.waitForTimeout(3000); // the bank decodes
// what actually starts: AU.lastCat is overwritten by whatever a kill plays after the layer, so record every buffer
await p.evaluate(`(async () => { const { AU } = await import('/src/audio.ts'); const mk = AU.c.createBufferSource.bind(AU.c); window.__buf = new Set(); AU.c.createBufferSource = () => { const s = mk(), st = s.start.bind(s); s.start = (...a) => { window.__buf.add(s.buffer); return st(...a); }; return s; }; })()`);
const mods = `const [{ $ }, AUD, MIX, EU, F, L] = await Promise.all(['/src/state.ts', '/src/audio.ts', '/src/audiomix.ts', '/src/enemies/update.ts', '/src/flow.ts', '/src/layout.ts'].map((m) => import(m)));`;
const head = await p.evaluate(`(async () => { ${mods} return { ctx: AUD.AU.c ? AUD.AU.c.state : null, biomes: Object.keys(MIX.BIOME_KILL), bank: Object.fromEntries(Object.values(MIX.BIOME_KILL).map((k) => [k.cat, (AUD.BANK[k.cat] || []).length])) }; })()`);
console.log('audio context', head.ctx, '; clips per layer', JSON.stringify(head.bank));
let ok = head.ctx === 'running';
for (const bio of head.biomes) {
  await p.evaluate(`(async () => { ${mods} $.gate = false; F.newGame(0); $.state = 'play'; const s = 0, G = $.G; G.route[s] = ${JSON.stringify(bio)}; G.stage = L.stageOfSlot(s); window.__buf.clear(); })()`);
  let heard = false, n = 0, thrown = null;
  for (; n < 60 && !heard && !thrown; n++) {
    thrown = await p.evaluate(`(async () => { ${mods} try { EU.killEnemy({ k: 'mutant', x: 300, y: 135, score: 0, bio: 0, gsz: 3.2, big: 1, hp: 0 }); return null; } catch (e) { return String(e); } })()`);
    heard = await p.evaluate(`(async () => { ${mods} return (AUD.BANK[MIX.BIOME_KILL[${JSON.stringify(bio)}].cat] || []).some((b) => window.__buf.has(b)); })()`);
    await p.waitForTimeout(120); // real clock: past the 45 ms and 90 ms throttles
  }
  const has = head.bank[await p.evaluate(`(async () => { ${mods} return MIX.BIOME_KILL[${JSON.stringify(bio)}].cat; })()`)] > 0;
  const good = !thrown && (heard || !has);
  console.log(`${bio}: ${n} kills, ${thrown ? 'THREW ' + thrown : heard ? 'layer played' : has ? 'LAYER NEVER PLAYED' : 'no clips in the bank: its synth row'}`);
  ok = ok && good;
}
await b.close();
if (errs.length) { console.log('page errors', errs); ok = false; }
console.log(ok ? 'BIOME KILL PASS' : 'BIOME KILL FAIL');
process.exit(ok ? 0 : 1);

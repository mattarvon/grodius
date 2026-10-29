// Upgrade picker: one page listing every game slot that could take new art (enemies, new enemies, bosses, FX, ship,
// world, screens), what it looks like now, and the downloaded sprite picks that could go there. Claude's suggestion is
// pre-selected per slot with its reason; Matt changes any of them, then SAVE CHOICES writes upgrade-choices.json.
// Needs: tools/upgrade-shots.mjs (now/*.png), tools/upgrade_thumbs.py (thumbs/*.png), the gross-pass boss shots.
// Usage: node tools/upgrade-picker.mjs   -> assets-raw/upgrade/picker.html
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', 'assets-raw', 'upgrade');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// the downloaded picks (assets-raw/sprites), one thumbnail each; lic: cc0 = no strings, by = CREDITS.md line
const PICKS = {
  wasp: { t: 'Wasp (20-frame flap)', lic: 'by', by: 'Tiamalt', dir: 'bug/wasp' },
  'eyeball-float': { t: 'Floating Eyeball (4 frames)', lic: 'cc0', by: 'OwlishMedia', dir: 'eye/floating-eyeball-0' },
  'eyeballs-real': { t: 'Eyeballs (20 irises + parts)', lic: 'by', by: 'sunburn', dir: 'eye/eyeballs' },
  earwig: { t: 'Earwig (walk cycle)', lic: 'by', by: 'Scarcz', dir: 'bug/earwig-top-down' },
  'tentacle-eye': { t: 'Tentacle Creature: eye (8 frames)', lic: 'cc0', by: 'Sean Noonan', dir: 'tentacle/top-down-tentacle-creature' },
  'tentacle-teeth': { t: 'Tentacle Creature: teeth (8 frames)', lic: 'cc0', by: 'Sean Noonan', dir: 'tentacle/top-down-tentacle-creature' },
  blob: { t: 'Blob (idle/move/attack/death)', lic: 'cc0', by: 'Woostar', dir: 'blob/blob-sprite' },
  sparks: { t: 'Sparks: fire, ice, blood', lic: 'by', by: 'Clint Bellanger', dir: 'zombie/sparks-fire-ice-blood' },
  'space-sprites': { t: 'Space Sprites (Tyrian explosions, shots)', lic: 'by', by: 'Daniel Cook / titmouse001', dir: 'alien/space-sprites-0' },
  'planet-t': { t: 'Planet T (dark planet, eclipse)', lic: 'cc0', by: 'krislachowski', dir: 'alien/planet-t-0' },
  'scifi-tiles': { t: 'Sci-fi wall tiles', lic: 'cc0', by: 'mieki256', dir: 'shmup/enemy-sprite' },
  'magic-fence': { t: 'Magic Fence (crystal pillars)', lic: 'cc0', by: 'qwedeath', dir: 'tentacle/magic-fence' },
  'creepy-anim': { t: 'Animated Creepy Thing (horned skull)', lic: 'cc0', by: 'Charlie', dir: 'demon/animated-creepy-thing' },
  'creepy-thing': { t: 'Creepy Thing (still, 3 variants)', lic: 'cc0', by: 'StumpyStrust', dir: 'blob/creepy-thing' },
  reticulan: { t: 'Reticulan alien portraits', lic: 'cc0', by: 'surt', dir: 'alien/modular-reticulan-portraits' },
  humanflesh: { t: 'Zombie Take Away (HUMANFLESH poster)', lic: 'by', by: 'CiderCorpse', dir: 'eye/zombie-take-away' },
  'zombie-anim': { t: 'Zombie mutant, fully animated', lic: 'cc0', by: 'Cethiel', dir: 'zombie/zombie-fully-animated' },
  'zombie-pack': { t: 'Zombie Character Pack (cop, civilian)', lic: 'cc0', by: 'Soluna Software', dir: 'zombie/zombie-character-pack' },
  'pixel-zombie': { t: 'Pixel Zombie (walk + hit)', lic: 'by', by: 'bellow / lonegames.net', dir: 'zombie/pixel-zombie' },
  'mech-pod-c': { t: 'Mech pod C (16 frames)', lic: 'cc0', by: 'mieki256', dir: 'shmup/enemy-sprite' },
  'mech-pod-d': { t: 'Mech pod D, red eye (8 frames)', lic: 'cc0', by: 'mieki256', dir: 'shmup/enemy-sprite' },
  'ship-tm3': { t: 'Ship TM-3 (+3 upgrade looks)', lic: 'cc0', by: 'TheSource4Life', dir: 'shmup/space-ships-side-scroller' },
  'ship-tm6': { t: 'Ship TM-6 (+3 upgrade looks)', lic: 'cc0', by: 'TheSource4Life', dir: 'shmup/space-ships-side-scroller' },
  'boss-eyeball': { t: 'Alien Boss: Green Eyeball', lic: 'cc0', by: 'The_Scientist___', dir: 'tentacle/alien-boss-set' },
  'boss-ufo': { t: 'Alien Boss: Infested UFO', lic: 'cc0', by: 'The_Scientist___', dir: 'tentacle/alien-boss-set' },
  'boss-mouth': { t: 'Alien Boss: Red Mouth (opens)', lic: 'cc0', by: 'The_Scientist___', dir: 'tentacle/alien-boss-set' },
  'boss-tentacle': { t: 'Alien Boss: Yellow Tentacles', lic: 'cc0', by: 'The_Scientist___', dir: 'tentacle/alien-boss-set' },
  'boss-final': { t: 'Alien Boss: Final (eye)', lic: 'cc0', by: 'The_Scientist___', dir: 'tentacle/alien-boss-set' },
};

// slot: now = image path relative to the picker (null = nothing there yet); pick = suggestion ('keep' / 'none' or a
// pick id); why = the reason shown; alts = alternatives shown up front (every other pick sits under "show all")
const G = '../gross/'; // boss shots from the gross pass
const SLOTS = [
  ['Regular enemies', [
    { id: 'drone', name: 'Swarm drone', now: 'now/drone.png', what: 'Flies in sine, wall and dive formations of 4-6. About 14 px.',
      pick: 'wasp', why: 'A buzzing swarm reads instantly at 14 px, and the 20-frame wing flap makes formations shimmer. Tinted sick yellow-green.', alts: ['mech-pod-d', 'eyeball-float'] },
    { id: 'hatch', name: 'Hatchling', now: 'now/hatch.png', what: 'Floods out of wombs and from behind in schools of 5-12. About 10 px.',
      pick: 'eyeball-float', why: 'Loose eyeballs swimming on their optic nerves: gross, and the nerve tail shows which way the school is moving.', alts: ['blob', 'wasp'] },
    { id: 'corpse', name: 'Drifting corpse', now: 'now/corpse.png', what: 'Frozen MERIDIAN crew drifting in a line. Dismembers, pops eyes, says the plea line.',
      pick: 'keep', why: 'The code does the dismemberment and eye pops, and the crew wear vac suits. Zombies in cop uniforms would break the story.', alts: ['zombie-pack', 'pixel-zombie'] },
    { id: 'eye', name: 'Wall eye turret', now: 'now/eye.png', what: 'Grows out of the floor or ceiling, blinks, shoots. About 16 px.',
      pick: 'tentacle-eye', why: 'A purple flesh starfish with a blinking eye, rooted to the rock, is far grosser than the current ball, and it already has 8 frames.', alts: ['eyeballs-real', 'eyeball-float'] },
    { id: 'crawler', name: 'Wall crawler', now: 'now/crawler.png', what: 'Walks along the floor or ceiling and spits upward. About 16 px.',
      pick: 'earwig', why: 'Seen side-on, a skittering earwig rotated onto the wall is real bug-horror and has a full walk cycle.', alts: ['blob', 'zombie-anim'] },
    { id: 'womb', name: 'Ceiling womb', now: 'now/womb.png', what: 'Hangs from the ceiling and births hatchlings. About 24 px.',
      pick: 'tentacle-teeth', why: 'A toothed flesh mouth that opens to spit hatchlings. It pairs with the eye turret as the same species.', alts: ['keep'] },
    { id: 'flayer', name: 'Flayer', now: 'now/flayer.png', what: 'Skeletal thing swinging a whip of vertebrae.',
      pick: 'keep', why: 'Its whip and skeleton are drawn and animated by code. A sprite would lose the whip physics.', alts: ['zombie-anim', 'pixel-zombie'] },
    { id: 'cross', name: 'Gambrel carcass', now: 'now/cross.png', what: 'Carcass hung on a gambrel from a side post (the de-crossed turret).',
      pick: 'keep', why: 'Rebuilt on Oct 25 to remove the crosses, and no pick fits a hung carcass.', alts: [] },
    { id: 'hook', name: 'Chain hook', now: 'now/hook.png', what: 'Meat hook on a chain swinging from the ceiling.',
      pick: 'keep', why: 'It is mostly chain physics, and no pick is a hook.', alts: [] },
  ]],
  ['New enemies (optional)', [
    { id: 'new-slime', name: 'Snot slime', now: null, what: 'New floor enemy for the snot/pus biome: oozes along, lunges, bursts into snot.',
      pick: 'blob', why: 'The blob has idle, move, attack and death animations, and it is already snot-green.', alts: ['none'] },
    { id: 'new-mutant', name: 'Hulking mutant', now: null, what: 'New heavy walker for the derelict decks: tanky, slow, lots of gibs.',
      pick: 'zombie-anim', why: 'Painted, fully animated (walk, attack, hurt, death). It would be the biggest regular enemy and very meaty.', alts: ['pixel-zombie', 'none'] },
    { id: 'new-security', name: 'MERIDIAN security drone', now: null, what: 'New mechanical enemy for Open Orbit: the derelict\'s own defences, still running.',
      pick: 'mech-pod-d', why: 'Red-eyed pods with 8 frames fit "the ship is still defending itself", and they contrast with all the meat.', alts: ['mech-pod-c', 'none'] },
    { id: 'new-wasp-nest', name: 'Hive swarm', now: null, what: 'New: a pulsing nest that bursts into a swarm when hit.',
      pick: 'none', why: 'Only worth it if the wasp does not become the swarm drone.', alts: ['wasp'] },
  ]],
  ['Bosses and midbosses', [
    { id: 'maw', name: 'THE MAW (and its biome variants)', now: G + 'maw/maw-orbit-idle-zoom.png', what: 'Open Orbit stage boss.',
      pick: 'keep', why: 'Rebuilt in the Oct 25 gross-out pass, and the code art is wetter than any pick.', alts: ['boss-mouth'] },
    { id: 'crux', name: 'THE BLOATED BITCH', now: G + 'biomebosses/crux-1-shielded-zoom.png', what: 'Ice biome boss.',
      pick: 'keep', why: 'Just rebuilt and renamed.', alts: [] },
    { id: 'butcher', name: 'THE BUTCHER', now: G + 'biomebosses/butcher-1-idle-zoom.png', what: 'Fire/derelict biome boss.',
      pick: 'keep', why: 'Just rebuilt.', alts: [] },
    { id: 'midbosses', name: 'Biome midbosses', now: G + 'midbosses/midboss-snot-zoom.png', what: 'Nail Choir, Dissolving Womb, Butcher\'s Apprentice, Brood Mother.',
      pick: 'keep', why: 'Just rebuilt.', alts: ['tentacle-teeth'] },
    { id: 'drive', name: 'Gravity Drive', now: G + 'drive/drive-1-full.png', what: 'The final boss of every descent: a living organ engine.',
      pick: 'keep', why: 'Just rebuilt. The horned skull could be a mask that cracks off the core: see the alternative.', alts: ['creepy-anim', 'boss-final'] },
    { id: 'new-midboss', name: 'New Open Orbit midboss', now: null, what: 'New: a wrecked ship overgrown with tentacles, halfway through Open Orbit.',
      pick: 'boss-ufo', why: 'An infested UFO is exactly this. It is flat cartoon art, so it gets repainted darker and wetter to match.', alts: ['boss-eyeball', 'boss-tentacle', 'none'] },
  ]],
  ['Effects', [
    { id: 'sparks', name: 'Hit sparks', now: null, what: 'The spray when your shots hit something.',
      pick: 'sparks', why: 'It comes in blood, ice and fire sets: blood by default, ice in the ice biome, fire in the fire biome.', alts: ['keep'] },
    { id: 'explosions', name: 'Explosions', now: null, what: 'The fireball under the gibs when things die.',
      pick: 'space-sprites', why: 'Tyrian\'s classic explosion frames, under the existing gibs and blood mist.', alts: ['keep'] },
  ]],
  ['Player', [
    { id: 'ship', name: 'CHARON-7 (your ship)', now: 'now/ship.png', what: 'The rescue tug, with Infirmary contraptions bolted onto the hull.',
      pick: 'keep', why: 'The contraptions (Bone Saw, Gut Cannon, Meat Winch...) are drawn onto the hull, and a sprite ship would hide them. The TM ships also read too clean.', alts: ['ship-tm3', 'ship-tm6'] },
  ]],
  ['World', [
    { id: 'triton', name: 'Triton in the Open Orbit sky', now: G + 'sky/descent1-1300.png', what: 'A second body in the sky, beside Neptune.',
      pick: 'planet-t', why: 'A dark moon in eclipse glow: Neptune\'s moon Triton, hanging behind the derelict.', alts: ['none'] },
    { id: 'derelict-walls', name: 'Derelict corridor walls', now: G + 'textures/derelict-corridor.png', what: 'The interior corridor stretches of the MERIDIAN.',
      pick: 'scifi-tiles', why: 'Real panel, pipe and hatch tiles under the meat, so it reads as a ship being eaten.', alts: ['keep'] },
    { id: 'ice-crystals', name: 'Ice biome crystal spikes', now: G + 'textures/biome-ice.png', what: 'Crystal formations in the frozen biome.',
      pick: 'magic-fence', why: 'Tall purple crystal pillars with a vein of light, tinted icy and set in the walls.', alts: ['none'] },
  ]],
  ['Screens and HUD', [
    { id: 'hype-portrait', name: 'Hype-voice portrait', now: null, what: 'A face that pops up in the corner when a hype line plays.',
      pick: 'reticulan', why: 'The modular alien heads let each voice get its own face, and they cost almost no screen space.', alts: ['none'] },
    { id: 'gameover-face', name: 'Game-over face', now: null, what: 'Art on the game-over screen.',
      pick: 'creepy-anim', why: 'The animated horned skull, chewing, over the score.', alts: ['creepy-thing', 'none'] },
    { id: 'infirmary-poster', name: 'Infirmary poster', now: null, what: 'Decoration on the Infirmary (shop) screen.',
      pick: 'humanflesh', why: '"HUMANFLESH / EAT HERE" with a zombie sipping a brain shake is perfect shop decor.', alts: ['none'] },
    { id: 'irises', name: 'Eye irises (title eye, wall eyes, corpse eyes)', now: null, what: 'The irises drawn in every eyeball.',
      pick: 'eyeballs-real', why: '20 realistic irises (plus cat, fish and frog pupils) layered into the code eyes, so every eye is different.', alts: ['keep'] },
  ]],
];

function picker() {
  const opt = (slot, v) => {
    const sug = slot.pick === v;
    const img = v === 'keep' ? (slot.now ? `<img src="${esc(slot.now)}" alt="">` : '<div class="ph">as is</div>')
      : v === 'none' ? '<div class="ph">leave out</div>' : `<img loading="lazy" src="thumbs/${v}.png" alt="">`;
    const label = v === 'keep' ? 'Keep current' : v === 'none' ? 'Don\'t add' : PICKS[v].t;
    const lic = PICKS[v] ? `<span class="${PICKS[v].lic}">${PICKS[v].lic === 'cc0' ? 'CC0' : 'credit'} &middot; ${esc(PICKS[v].by)}</span>` : '';
    return `<label class="opt${sug ? ' sug' : ''}"><input type="radio" name="${slot.id}" value="${v}"${sug ? ' data-sug' : ''}>
      <div class="im">${img}</div><b>${esc(label)}</b>${lic}${sug ? '<em>suggested</em>' : ''}</label>`;
  };
  const slot = (s) => {
    const base = s.now ? ['keep'] : ['none'];
    const front = [...new Set([...base, s.pick, ...s.alts])];
    const rest = Object.keys(PICKS).filter((k) => !front.includes(k));
    return `<section class="slot" data-id="${s.id}">
  <div class="cur"><div class="now">${s.now ? `<img src="${esc(s.now)}" alt="">` : '<div class="ph">new</div>'}</div>
    <h3>${esc(s.name)}</h3><p>${esc(s.what)}</p><p class="why"><b>Suggestion:</b> ${esc(s.why)}</p></div>
  <div class="side"><div class="opts">${front.map((v) => opt(s, v)).join('')}</div>
  <details><summary>show all ${rest.length} other sprites</summary><div class="opts">${rest.map((v) => opt(s, v)).join('')}</div></details>
  <input class="note" placeholder="notes for this slot (optional)" data-note="${s.id}"></div>
</section>`;
  };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Grodius upgrade picker</title><style>
:root { color-scheme: dark; } * { box-sizing: border-box; }
body { margin: 0; padding: 16px; background: #0c0809; color: #e6dcdc; font: 14px/1.4 system-ui, sans-serif; max-width: 1400px; }
h1 { font-size: 20px; margin: 0 0 4px; color: #ff4a5a; } h2 { font-size: 13px; margin: 28px 0 8px; color: #8a98a8; text-transform: uppercase; letter-spacing: .08em; }
p { color: #8a98a8; font-size: 13px; margin: 0 0 6px; } code { color: #e6dcdc; }
.bar { position: sticky; top: 0; background: #0c0809; padding: 8px 0; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; z-index: 2; border-bottom: 1px solid #2a1a1d; }
button { background: #ff4a5a; color: #0c0809; border: 0; border-radius: 4px; padding: 8px 14px; font-weight: 700; cursor: pointer; }
button.ghost { background: #2a1a1d; color: #e6dcdc; }
.slot { display: grid; grid-template-columns: 260px 1fr; gap: 6px 14px; background: #120a0c; border: 1px solid #2a1a1d; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
.slot.changed { border-color: #e0b050; }
.cur h3 { margin: 6px 0 2px; font-size: 15px; } .cur .why { color: #c8b8b8; }
.now { height: 150px; border-radius: 4px; overflow: hidden; background: #000; display: flex; align-items: center; justify-content: center; }
.now img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
.opts { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; align-content: start; }
.side { display: flex; flex-direction: column; gap: 6px; min-width: 0; } summary { color: #7ab0ff; cursor: pointer; font-size: 13px; margin: 2px 0 8px; }
.opt { display: flex; flex-direction: column; gap: 2px; background: #1a0f12; border: 2px solid #2a1a1d; border-radius: 6px; padding: 6px; cursor: pointer; min-width: 0; position: relative; }
.opt input { position: absolute; opacity: 0; pointer-events: none; }
.opt:has(input:checked) { border-color: #ff4a5a; background: #2a1016; }
.opt:has(input:focus-visible) { outline: 2px solid #7ab0ff; }
.opt .im { height: 96px; display: flex; align-items: center; justify-content: center; border-radius: 4px;
  background: repeating-conic-gradient(#1b1416 0% 25%, #120c0e 0% 50%) 0 0 / 12px 12px; }
.opt img { max-width: 100%; max-height: 100%; image-rendering: pixelated; }
.ph { color: #5a4a4e; font-size: 12px; text-transform: uppercase; letter-spacing: .1em; }
.opt b { font-size: 12px; font-weight: 600; overflow-wrap: anywhere; } .opt span { font-size: 11px; }
.opt .cc0 { color: #6fcf7f; } .opt .by { color: #e0b050; }
.opt em { position: absolute; top: 4px; right: 4px; font-style: normal; font-size: 10px; font-weight: 700; background: #6fcf7f; color: #0c0809; border-radius: 3px; padding: 1px 4px; }
.note { background: #1a0f12; border: 1px solid #2a1a1d; color: #e6dcdc; border-radius: 4px; padding: 6px 8px; font: inherit; font-size: 13px; width: 100%; }
#pool { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
#pool div { background: #1a0f12; border: 1px solid #2a1a1d; border-radius: 6px; padding: 6px; font-size: 12px; }
#pool div.unused { opacity: .5; } #pool img { height: 48px; image-rendering: pixelated; display: block; margin-bottom: 4px; }
@media (max-width: 720px) { .slot { grid-template-columns: 1fr; } .now { height: 120px; } .opts { grid-template-columns: repeat(2, 1fr); } }
</style></head><body>
<h1>Grodius upgrade picker</h1>
<p>Each slot shows what is in the game now (left) and what could replace it. My suggestion is pre-selected and badged <b>suggested</b>.
Click a different card to change it; slots you change get an amber border. Everything else, the game's blood, hit flash and gibs, stays layered on top of whatever sprite goes in.
Green = CC0, amber = needs a CREDITS.md line. When you're happy, hit <b>SAVE CHOICES</b> and tell Claude where <code>upgrade-choices.json</code> landed.</p>
<div class="bar"><button id="save">SAVE CHOICES</button><button class="ghost" id="reset">reset to suggestions</button><span id="n"></span></div>
${SLOTS.map(([g, ss]) => `<h2>${esc(g)}</h2>\n${ss.map(slot).join('\n')}`).join('\n')}
<h2>Your picks: where each one goes</h2><div id="pool"></div>
<script>
const PICKS = ${JSON.stringify(PICKS).replace(/</g, '\\u003c')};
const KEY = 'grodius.upgrade.choices';
const slots = [...document.querySelectorAll('.slot')];
const get = () => Object.fromEntries(slots.map((s) => [s.dataset.id, { choice: (s.querySelector('input[type=radio]:checked') || {}).value || null,
  suggested: s.querySelector('input[data-sug]').value, note: s.querySelector('.note').value.trim() }]));
function apply(saved) {
  for (const s of slots) {
    const v = saved && saved[s.dataset.id] ? saved[s.dataset.id].choice : null;
    const r = (v && s.querySelector('input[value="' + CSS.escape(v) + '"]')) || s.querySelector('input[data-sug]');
    r.checked = true;
    if (saved && saved[s.dataset.id]) s.querySelector('.note').value = saved[s.dataset.id].note || '';
    if (!r.closest('details') ) continue;
    r.closest('details').open = true;
  }
}
function upd() {
  const c = get(); let changed = 0;
  for (const s of slots) { const x = c[s.dataset.id], ch = x.choice !== x.suggested; s.classList.toggle('changed', ch); changed += ch; }
  document.getElementById('n').textContent = slots.length + ' slots, ' + changed + ' changed from my suggestions';
  const used = {}; for (const [id, x] of Object.entries(c)) if (PICKS[x.choice]) (used[x.choice] ||= []).push(slots.find((s) => s.dataset.id === id).querySelector('h3').textContent);
  document.getElementById('pool').innerHTML = Object.entries(PICKS).map(([k, p]) => '<div class="' + (used[k] ? '' : 'unused') + '"><img src="thumbs/' + k + '.png" alt=""><b>' + p.t + '</b><br>' + (used[k] ? used[k].join(', ') : 'not used') + '</div>').join('');
  try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {}
}
let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
apply(saved); upd();
document.addEventListener('change', upd); document.addEventListener('input', (e) => e.target.classList.contains('note') && upd());
document.getElementById('reset').onclick = () => { slots.forEach((s) => (s.querySelector('.note').value = '')); apply(null); upd(); };
document.getElementById('save').onclick = () => {
  const c = get(), out = { saved: new Date().toISOString(), slots: c,
    picks: Object.fromEntries(Object.entries(PICKS).map(([k, p]) => [k, { ...p, used: Object.keys(c).filter((s) => c[s].choice === k) }])) };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }));
  a.download = 'upgrade-choices.json'; a.click();
};
</script></body></html>`;
}

const missing = [];
for (const [, ss] of SLOTS) for (const s of ss) {
  if (s.now && !fs.existsSync(path.join(OUT, s.now))) missing.push(s.now);
  for (const v of [s.pick, ...s.alts]) if (!['keep', 'none'].includes(v) && !PICKS[v]) missing.push(`${s.id}: unknown pick ${v}`);
}
for (const k of Object.keys(PICKS)) if (!fs.existsSync(path.join(OUT, 'thumbs', k + '.png'))) missing.push(`thumbs/${k}.png`);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'picker.html'), picker());
console.log(`${SLOTS.reduce((n, [, s]) => n + s.length, 0)} slots, ${Object.keys(PICKS).length} picks -> ${path.join(OUT, 'picker.html')}`);
if (missing.length) console.log('missing:\n  ' + missing.join('\n  '));

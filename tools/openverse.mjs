// Openverse scout: search openly licensed sounds, music and images (https://api.openverse.org/v1/), audition them in a
// picker page, then download the picks with their credits. Only CC0, CC BY and public domain are requested, so anything
// picked is fine in this public repo (CC BY needs its CREDITS.md line). Anonymous API: 20 req/min, 200/day.
// Usage:
//   node tools/openverse.mjs search [queries.json]   -> assets-raw/openverse/picker.html (open it, tick picks, SAVE PICKS)
//   node tools/openverse.mjs fetch <picks.json>      -> assets-raw/openverse/<kind>/..., prints CREDITS.md rows
// queries.json: [{ "kind": "sfx" | "music" | "image", "q": "bone crack", "tag": "bone" }, ...] (defaults to PRESET)
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.openverse.org/v1/';
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', 'assets-raw', 'openverse');
const LICENSES = 'cc0,by,pdm';
const PER = 8;
const UA = { 'User-Agent': 'grodius-openverse-scout (https://github.com/mattarvon/grodius)' };

// tag = which src/sfx/<category>/ (or music slot / art use) the hit is a candidate for
const PRESET = [
  { kind: 'sfx', q: 'gore splat', tag: 'splat' },
  { kind: 'sfx', q: 'flesh squelch', tag: 'splat' },
  { kind: 'sfx', q: 'bone crack', tag: 'bone' },
  { kind: 'sfx', q: 'body fall thud', tag: 'thud' },
  { kind: 'sfx', q: 'explosion', tag: 'explode' },
  { kind: 'sfx', q: 'monster growl', tag: 'monster' },
  { kind: 'sfx', q: 'creature scream', tag: 'monster' },
  { kind: 'sfx', q: 'ice crack', tag: 'ice' },
  { kind: 'sfx', q: 'acid sizzle', tag: 'acid' },
  { kind: 'sfx', q: 'fire whoosh', tag: 'fire' },
  { kind: 'sfx', q: 'slime squish', tag: 'snot' },
  { kind: 'sfx', q: 'sneeze', tag: 'snot' },
  { kind: 'sfx', q: 'alarm siren warning', tag: 'warning' },
  { kind: 'sfx', q: 'metal hull creak', tag: 'ambience' },
  { kind: 'music', q: 'synthwave', tag: 'music' },
  { kind: 'music', q: 'dark ambient drone', tag: 'music' },
  { kind: 'music', q: 'horror ambience loop', tag: 'music' },
  { kind: 'music', q: 'cyberpunk loop', tag: 'music' },
  { kind: 'image', q: 'anatomical engraving', tag: 'anatomy' },
  { kind: 'image', q: 'anatomy skeleton illustration', tag: 'anatomy' },
  { kind: 'image', q: 'neptune voyager', tag: 'space' },
  { kind: 'image', q: 'x-ray skull', tag: 'xray' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const lic = (r) => (r.license === 'pdm' ? 'Public Domain Mark' : r.license === 'cc0' ? 'CC0 1.0' : `CC ${r.license.toUpperCase()} ${r.license_version}`);

async function get(url) {
  for (let tries = 0; ; tries++) {
    const res = await fetch(url, { headers: UA });
    if (res.status === 429 && tries < 3) { await sleep(20000); continue; }
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return { json: await res.json(), left: res.headers.get('x-ratelimit-available-anon_sustained') };
  }
}

async function search(file) {
  const qs = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : PRESET;
  const hits = [], seen = new Set();
  let left = '?';
  for (const { kind, q, tag } of qs) {
    const p = new URLSearchParams({ q, license: LICENSES, page_size: PER, mature: 'true' });
    if (kind === 'sfx') p.set('length', 'short'); // freesound clips under ~30 s
    const r = await get(`${API}${kind === 'image' ? 'images' : 'audio'}/?${p}`);
    left = r.left ?? left;
    let n = 0;
    for (const h of r.json.results) {
      if (seen.has(h.id)) continue;
      seen.add(h.id); n++;
      hits.push({ kind, q, tag, id: h.id, title: h.title, creator: h.creator, creator_url: h.creator_url, license: lic(h),
        license_url: h.license_url, page: h.foreign_landing_url, url: h.url, thumb: h.thumbnail, source: h.source,
        duration: h.duration ? +(h.duration / 1000).toFixed(1) : null, filetype: h.filetype, attribution: h.attribution });
    }
    console.log(`${kind.padEnd(5)} ${q.padEnd(28)} ${String(r.json.result_count).padStart(5)} found, ${n} new`);
    await sleep(3200); // stay under 20/min
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'hits.json'), JSON.stringify(hits, null, 1));
  fs.writeFileSync(path.join(OUT, 'picker.html'), picker(hits));
  console.log(`\n${hits.length} candidates -> ${path.join(OUT, 'picker.html')}  (API calls left today: ${left})`);
}

function picker(hits) {
  const groups = {};
  for (const h of hits) (groups[`${h.kind}: ${h.q}`] ??= []).push(h);
  const card = (h) => `<label class="card"><input type="checkbox" data-id="${h.id}">
    ${h.kind === 'image' ? `<img loading="lazy" src="${esc(h.thumb || h.url)}" alt="">` : `<audio controls preload="none" src="${esc(h.url)}"></audio>`}
    <b>${esc(h.title)}</b><span>${esc(h.creator)} &middot; ${esc(h.source)}${h.duration ? ` &middot; ${h.duration}s` : ''}</span>
    <span class="${h.license.startsWith('CC BY') ? 'by' : 'free'}">${esc(h.license)}</span><a href="${esc(h.page)}" target="_blank">source</a></label>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Grodius Openverse picker</title><style>
:root { color-scheme: dark; } body { margin: 0; padding: 16px; background: #0c0809; color: #e6dcdc; font: 14px/1.4 system-ui, sans-serif; }
h1 { font-size: 20px; margin: 0 0 4px; color: #ff4a5a; } h2 { font-size: 13px; margin: 22px 0 8px; color: #8a98a8; text-transform: uppercase; letter-spacing: .08em; }
p { color: #8a98a8; font-size: 13px; margin: 0 0 8px; } .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px; }
.card { display: flex; flex-direction: column; gap: 3px; background: #160d0f; border: 1px solid #2a1a1d; border-radius: 6px; padding: 8px; cursor: pointer; }
.card:has(input:checked) { border-color: #ff4a5a; background: #231014; } .card input { align-self: flex-start; accent-color: #ff4a5a; }
.card img { width: 100%; height: 150px; object-fit: cover; border-radius: 4px; background: #000; } audio { width: 100%; height: 32px; }
.card span { color: #8a98a8; font-size: 12px; } .card .by { color: #e0b050; } .card .free { color: #6fcf7f; } a { color: #7ab0ff; font-size: 12px; }
.bar { position: sticky; top: 0; background: #0c0809; padding: 8px 0; display: flex; gap: 12px; align-items: center; z-index: 1; }
button { background: #ff4a5a; color: #0c0809; border: 0; border-radius: 4px; padding: 8px 14px; font-weight: 700; cursor: pointer; }
</style></head><body>
<h1>Openverse picker</h1><p>CC0 / public domain in green, CC BY in amber (needs a CREDITS.md line). Freesound audio is the HQ preview MP3.
Tick what you want, hit SAVE PICKS, then: <code>node tools/openverse.mjs fetch picks.json</code></p>
<div class="bar"><button id="save">SAVE PICKS</button><span id="n">0 picked</span></div>
${Object.entries(groups).map(([g, hs]) => `<h2>${esc(g)}</h2><div class="grid">${hs.map(card).join('')}</div>`).join('\n')}
<script>
const HITS = ${JSON.stringify(hits).replace(/</g, '\\u003c')};
const boxes = [...document.querySelectorAll('input[data-id]')];
const KEY = 'grodius.openverse.picks';
try { const s = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); boxes.forEach((b) => (b.checked = s.has(b.dataset.id))); } catch (e) {}
const ids = () => boxes.filter((b) => b.checked).map((b) => b.dataset.id);
const upd = () => { document.getElementById('n').textContent = ids().length + ' picked'; try { localStorage.setItem(KEY, JSON.stringify(ids())); } catch (e) {} };
document.addEventListener('change', upd); upd();
document.querySelectorAll('audio').forEach((a) => a.addEventListener('play', () => document.querySelectorAll('audio').forEach((o) => o !== a && o.pause())));
document.getElementById('save').onclick = () => {
  const s = new Set(ids()), blob = new Blob([JSON.stringify(HITS.filter((h) => s.has(h.id)), null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'picks.json'; a.click();
};
</script></body></html>`;
}

async function fetchPicks(file) {
  const picks = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = [];
  for (const h of picks) {
    const ext = (h.filetype || path.extname(new URL(h.url).pathname).slice(1) || (h.kind === 'image' ? 'jpg' : 'mp3')).toLowerCase();
    const slug = `${h.title}`.toLowerCase().replace(/\.(wav|mp3|ogg|flac|aiff?)$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    const dir = path.join(OUT, h.kind, h.tag);
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, `ov-${slug}-${h.id.slice(0, 6)}.${ext}`);
    if (!fs.existsSync(dest)) {
      const res = await fetch(h.url, { headers: UA });
      if (!res.ok) { console.log(`skip ${h.title}: ${res.status}`); continue; }
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    }
    console.log(`got  ${path.relative(OUT, dest)}`);
    rows.push(`| \`${path.basename(dest)}\` | ${h.title} | ${h.creator} | ${h.license} | ${h.page} |`);
  }
  fs.writeFileSync(path.join(OUT, 'credits-rows.md'), rows.join('\n') + '\n');
  console.log(`\nCREDITS.md rows (also in assets-raw/openverse/credits-rows.md):\n| File | Title | Creator | License | Source |\n|---|---|---|---|---|\n${rows.join('\n')}`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'search') await search(arg);
else if (cmd === 'fetch' && arg) await fetchPicks(arg);
else console.log('usage: node tools/openverse.mjs search [queries.json] | fetch <picks.json>');

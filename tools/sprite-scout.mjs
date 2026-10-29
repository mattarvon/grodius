// Sprite scout: search OpenGameArt (https://opengameart.org) 2D art for gross creature sprites, show them in a picker
// page, then download the picks with their credits. Only CC0 and attribution licenses (CC-BY 3.0/4.0, OGA-BY 3.0/4.0)
// are requested, so anything picked is fine in this public repo (BY needs its CREDITS.md line). No SA, no GPL.
// OGA has no API and its robots.txt asks for a 10 s crawl delay, which every request here honours. Each query is
// searched twice (CC0, then BY) so the license class is known from the search alone; item pages (author, exact
// license, files) are only fetched for picks. Pages are cached in assets-raw/sprites/.cache, so reruns are free.
// Usage:
//   node tools/sprite-scout.mjs search [queries.json]   -> assets-raw/sprites/picker.html (open it, tick picks, SAVE PICKS)
//   node tools/sprite-scout.mjs fetch <picks.json>      -> assets-raw/sprites/<tag>/<slug>/..., prints CREDITS.md rows
// queries.json: [{ "q": "eyeball", "tag": "eye" }, ...] (defaults to PRESET)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const OGA = 'https://opengameart.org';
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', 'assets-raw', 'sprites');
const CACHE = path.join(OUT, '.cache');
const UA = { 'User-Agent': 'grodius-sprite-scout (https://github.com/mattarvon/grodius)' };
const DELAY = 10000; // robots.txt Crawl-delay
const GROUPS = { cc0: [4], by: [2, 17981, 10310, 31772] }; // OGA license term ids: CC0 | CC-BY 3.0, CC-BY 4.0, OGA-BY 3.0, OGA-BY 4.0
const OK_LICENSES = ['CC0', 'CC-BY 3.0', 'CC-BY 4.0', 'OGA-BY 3.0', 'OGA-BY 4.0']; // most permissive first
const PER = 24;

// tag = which enemy family / use the hit is a candidate for
const PRESET = [
  { q: 'monster', tag: 'monster' },
  { q: 'alien', tag: 'alien' },
  { q: 'zombie', tag: 'zombie' },
  { q: 'slime', tag: 'blob' },
  { q: 'blob', tag: 'blob' },
  { q: 'tentacle', tag: 'tentacle' },
  { q: 'eyeball', tag: 'eye' },
  { q: 'worm', tag: 'worm' },
  { q: 'parasite', tag: 'parasite' },
  { q: 'insect', tag: 'bug' },
  { q: 'flesh', tag: 'flesh' },
  { q: 'gore', tag: 'gore' },
  { q: 'mutant', tag: 'mutant' },
  { q: 'demon', tag: 'demon' },
  { q: 'boss', tag: 'boss' },
  { q: 'shmup enemy', tag: 'shmup' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const unesc = (s) => s.replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
const text = (h) => unesc(h.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

let last = 0;
async function page(url) {
  const key = path.join(CACHE, url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 180) + '.html');
  if (fs.existsSync(key)) return fs.readFileSync(key, 'utf8');
  for (let tries = 0; ; tries++) {
    await sleep(Math.max(0, last + DELAY - Date.now()));
    last = Date.now();
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(res.status);
      const html = await res.text();
      fs.mkdirSync(CACHE, { recursive: true });
      fs.writeFileSync(key, html);
      return html;
    } catch (e) {
      if (tries < 2) continue;
      throw new Error(`${e.message} ${url}`);
    }
  }
}

// search results: each art-preview row is a title link plus a thumbnail
function results(html) {
  const out = [];
  for (const m of html.matchAll(/art-preview-title"><a href="(\/content\/[^"]+)">([^<]+)<\/a>[\s\S]*?<img src='([^']+)'/g)) {
    const thumb = m[3];
    out.push({ id: m[1].slice(9), page: OGA + m[1], title: unesc(m[2]), thumb, preview: thumb.replace('/styles/thumbnail/public/', '/') });
  }
  return out;
}

async function search(file) {
  const qs = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : PRESET;
  const hits = [], seen = new Map();
  for (const { q, tag } of qs) {
    for (const [lic, ids] of Object.entries(GROUPS)) {
      const p = new URLSearchParams({ keys: q, sort_by: 'count', sort_order: 'DESC', items_per_page: PER });
      p.append('field_art_type_tid[]', 9); // 2D Art
      for (const id of ids) p.append('field_art_licenses_tid[]', id);
      const rs = results(await page(`${OGA}/art-search-advanced?${p}`));
      let n = 0;
      for (const r of rs) {
        if (seen.has(r.id)) continue; // dual-licensed: the CC0 pass saw it first
        const h = { ...r, q, tag, lic };
        seen.set(r.id, h); hits.push(h); n++;
      }
      console.log(`${q.padEnd(14)} ${lic.padEnd(4)} ${String(rs.length).padStart(3)} found, ${n} new`);
    }
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'hits.json'), JSON.stringify(hits, null, 1));
  fs.writeFileSync(path.join(OUT, 'picker.html'), picker(hits));
  console.log(`\n${hits.length} candidates -> ${path.join(OUT, 'picker.html')}`);
}

function picker(hits) {
  const groups = {};
  for (const h of hits) (groups[h.q] ??= []).push(h);
  const card = (h) => `<label class="card" data-lic="${h.lic}"><input type="checkbox" data-id="${esc(h.id)}">
    <div class="pv"><img loading="lazy" src="${esc(h.preview)}" data-thumb="${esc(h.thumb)}" alt=""></div>
    <b>${esc(h.title)}</b><span class="dim"></span>
    <span class="${h.lic}">${h.lic === 'cc0' ? 'CC0' : 'CC-BY / OGA-BY (credit)'}</span><a href="${esc(h.page)}" target="_blank" rel="noopener">source</a></label>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Grodius sprite picker</title><style>
:root { color-scheme: dark; } body { margin: 0; padding: 16px; background: #0c0809; color: #e6dcdc; font: 14px/1.4 system-ui, sans-serif; }
h1 { font-size: 20px; margin: 0 0 4px; color: #ff4a5a; } h2 { font-size: 13px; margin: 22px 0 8px; color: #8a98a8; text-transform: uppercase; letter-spacing: .08em; }
p { color: #8a98a8; font-size: 13px; margin: 0 0 8px; } .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
.card { display: flex; flex-direction: column; gap: 3px; background: #160d0f; border: 1px solid #2a1a1d; border-radius: 6px; padding: 8px; cursor: pointer; min-width: 0; }
.card:has(input:checked) { border-color: #ff4a5a; background: #231014; } .card input { align-self: flex-start; accent-color: #ff4a5a; }
.pv { height: 170px; display: flex; align-items: center; justify-content: center; border-radius: 4px; overflow: hidden;
  background: repeating-conic-gradient(#1b1416 0% 25%, #120c0e 0% 50%) 0 0 / 16px 16px; }
.pv img { max-width: 100%; max-height: 100%; image-rendering: pixelated; }
body.zoom .pv img { min-height: 60%; object-fit: contain; }
.card b { overflow-wrap: anywhere; } .card span { color: #8a98a8; font-size: 12px; } .card .by { color: #e0b050; } .card .cc0 { color: #6fcf7f; }
a { color: #7ab0ff; font-size: 12px; } code { color: #e6dcdc; }
.bar { position: sticky; top: 0; background: #0c0809; padding: 8px 0; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; z-index: 1; }
button { background: #ff4a5a; color: #0c0809; border: 0; border-radius: 4px; padding: 8px 14px; font-weight: 700; cursor: pointer; }
.bar label { color: #8a98a8; font-size: 13px; display: flex; gap: 4px; align-items: center; }
body.only-cc0 .card[data-lic="by"], body.only-picked .card:not(:has(input:checked)) { display: none; }
@media (max-width: 500px) { body { padding: 16px; } .grid { grid-template-columns: 1fr 1fr; } .pv { height: 120px; } }
</style></head><body>
<h1>Sprite picker</h1><p>OpenGameArt 2D art, most-favourited first. CC0 in green; CC-BY / OGA-BY in amber (needs a CREDITS.md line).
Previews are what the author uploaded, often a sheet; the download may hold more. Tick what you want, hit SAVE PICKS, then:
<code>node tools/sprite-scout.mjs fetch picks.json</code></p>
<div class="bar"><button id="save">SAVE PICKS</button><span id="n">0 picked</span>
<label><input type="checkbox" id="zoom"> blow up small art</label>
<label><input type="checkbox" id="cc0"> CC0 only</label>
<label><input type="checkbox" id="picked"> picked only</label></div>
${Object.entries(groups).map(([g, hs]) => `<h2>${esc(g)} (${hs.length})</h2><div class="grid">${hs.map(card).join('')}</div>`).join('\n')}
<script>
const HITS = ${JSON.stringify(hits).replace(/</g, '\\u003c')};
const boxes = [...document.querySelectorAll('input[data-id]')];
const KEY = 'grodius.sprites.picks';
try { const s = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); boxes.forEach((b) => (b.checked = s.has(b.dataset.id))); } catch (e) {}
const ids = () => boxes.filter((b) => b.checked).map((b) => b.dataset.id);
const upd = () => { document.getElementById('n').textContent = ids().length + ' picked'; try { localStorage.setItem(KEY, JSON.stringify(ids())); } catch (e) {} };
document.addEventListener('change', upd); upd();
for (const [id, cls] of [['zoom', 'zoom'], ['cc0', 'only-cc0'], ['picked', 'only-picked']])
  document.getElementById(id).addEventListener('change', (e) => document.body.classList.toggle(cls, e.target.checked));
document.querySelectorAll('.pv img').forEach((img) => {
  // full preview missing (some are generated thumbnails only): fall back to the thumbnail; show the pixel size
  img.addEventListener('error', () => { if (img.dataset.thumb && img.src !== img.dataset.thumb) img.src = img.dataset.thumb; }, { once: false });
  img.addEventListener('load', () => { img.closest('.card').querySelector('.dim').textContent = img.naturalWidth + ' x ' + img.naturalHeight + ' px preview'; });
});
document.getElementById('save').onclick = () => {
  const s = new Set(ids()), blob = new Blob([JSON.stringify(HITS.filter((h) => s.has(h.id)), null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'picks.json'; a.click();
};
</script></body></html>`;
}

// unzip next to the archive with Windows' own bsdtar: Git Bash's GNU tar can't read zips (and takes "E:" for a host)
function unzip(zip) {
  const to = zip.replace(/\.(zip|7z)$/i, '');
  if (fs.existsSync(to) && fs.readdirSync(to).length) return;
  fs.mkdirSync(to, { recursive: true });
  const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  try { execFileSync(tar, ['-xf', path.basename(zip), '-C', path.basename(to)], { cwd: path.dirname(zip) }); }
  catch (e) { console.log(`could not unzip ${path.basename(zip)}: ${e.message.split('\n')[0]}`); }
}

// the block of one Drupal field on an item page, up to the next field
function field(html, name) {
  let i = html.indexOf(`field-name-${name} `);
  if (i < 0) return '';
  i = html.indexOf('">', i) + 2;
  const j = html.indexOf('class="field field-name-', i);
  return html.slice(i, j < 0 ? undefined : html.lastIndexOf('<div', j));
}

async function fetchPicks(file) {
  const picks = JSON.parse(fs.readFileSync(file, 'utf8'));
  const rows = [];
  for (const h of picks) {
    const html = await page(h.page);
    const author = unesc(field(html, 'author-submitter').match(/username'><a [^>]*>([^<]+)/)?.[1] ?? '?');
    const lics = [...field(html, 'field-art-licenses').matchAll(/license-name'>([^<]+)/g)].map((m) => text(m[1]));
    const license = OK_LICENSES.find((l) => lics.includes(l));
    if (!license) { console.log(`skip ${h.title}: licenses ${lics.join(', ') || '?'} (none allowed)`); continue; }
    const notice = text(field(html, 'field-copyright-notice')).replace(/^Copyright\/Attribution Notice:\s*/, '');
    const files = [...field(html, 'field-art-files').matchAll(/href="(https:\/\/opengameart\.org\/sites\/default\/files\/[^"]+)"/g)].map((m) => m[1]);
    const slug = h.id.replace(/[^a-z0-9]+/gi, '-').slice(0, 40);
    const dir = path.join(OUT, h.tag, slug);
    fs.mkdirSync(dir, { recursive: true });
    for (const url of files) {
      const name = decodeURIComponent(path.basename(new URL(url).pathname));
      const dest = path.join(dir, name);
      if (!fs.existsSync(dest)) {
        await sleep(Math.max(0, last + DELAY - Date.now()));
        last = Date.now();
        const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(180000) });
        if (!res.ok) { console.log(`skip ${name}: ${res.status}`); continue; }
        fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      }
      if (/\.(zip|7z)$/i.test(name)) unzip(dest);
      console.log(`got  ${path.relative(OUT, dest)}`);
    }
    fs.writeFileSync(path.join(dir, 'SOURCE.txt'), `${h.title}\n${h.page}\nAuthor: ${author}\nLicense: ${license} (listed: ${lics.join(', ')})\nNotice: ${notice || '-'}\n`);
    rows.push(`| \`${h.tag}/${slug}\` | ${h.title} | ${author}${notice && notice !== author ? ` (notice: ${notice})` : ''} | ${license} | ${h.page} |`);
  }
  fs.writeFileSync(path.join(OUT, 'credits-rows.md'), rows.join('\n') + '\n');
  console.log(`\nCREDITS.md rows (also in assets-raw/sprites/credits-rows.md):\n| Source | Title | Author | License | Page |\n|---|---|---|---|---|\n${rows.join('\n')}`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'search') await search(arg);
else if (cmd === 'fetch' && arg) await fetchPicks(arg);
else console.log('usage: node tools/sprite-scout.mjs search [queries.json] | fetch <picks.json>');

#!/usr/bin/env node
// Ask the rig's local LLM (Ollama on the RTX 5090) for cheap, bulk, low-stakes text: drafting candidate VO lines and
// quips for Matt to pick from, tagging or summarising long lists (Openverse results, playtest logs), first-pass
// rewrites. Not for code, balance calls or anything shipped unreviewed: a human or Claude picks from its output.
// Usage: node tools/local-llm.mjs [--model qwen3.8:27b] [--system <text>|--system-file <f>] [--json] [--n 8] <prompt|->
//   -        read the prompt from stdin
//   --json   ask for JSON (Ollama format=json); the reply is printed as is
//   --n N    ask for N candidates as a JSON array of strings, one per line on stdout
// Env: OLLAMA_URL (default http://localhost:11434), LOCAL_LLM_MODEL. Exit 2 if Ollama is not reachable (fall back to
// Claude, don't retry in a loop). The model stays loaded 30 min after the call (keep_alive).
import fs from 'node:fs';

const a = process.argv.slice(2);
const opt = (k) => { const i = a.indexOf(k); if (i < 0) return undefined; const v = a[i + 1]; a.splice(i, 2); return v; };
const flag = (k) => { const i = a.indexOf(k); if (i < 0) return false; a.splice(i, 1); return true; };
const model = opt('--model') ?? process.env.LOCAL_LLM_MODEL ?? 'qwen3.8:27b';
const sysFile = opt('--system-file');
const system = opt('--system') ?? (sysFile ? fs.readFileSync(sysFile, 'utf8') : undefined);
const n = opt('--n');
const json = flag('--json') || n != null;
let prompt = a.join(' ');
if (prompt === '-' || (!prompt && !process.stdin.isTTY)) prompt = fs.readFileSync(0, 'utf8');
if (!prompt.trim()) { console.error('usage: node tools/local-llm.mjs [--model M] [--system S] [--json] [--n N] <prompt|->'); process.exit(1); }
if (n != null) prompt += `\n\nReply with ONLY a JSON object {"items": [${n} strings]}.`;

const url = (process.env.OLLAMA_URL ?? 'http://localhost:11434') + '/api/generate';
let r;
try {
  r = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, system, prompt, stream: false, think: false, keep_alive: '30m', ...(json ? { format: 'json' } : {}), options: { temperature: n != null ? 0.9 : 0.6 } }),
    signal: AbortSignal.timeout(300_000),
  });
} catch (e) { console.error(`local-llm: Ollama not reachable at ${url} (${e.message})`); process.exit(2); }
if (!r.ok) { console.error(`local-llm: ${r.status} ${await r.text()}`); process.exit(2); }
const out = await r.json();
const tps = out.eval_count && out.eval_duration ? (out.eval_count / (out.eval_duration / 1e9)).toFixed(0) : '?';
if (n != null) {
  let items;
  try { const v = JSON.parse(out.response); items = Array.isArray(v) ? v : Object.values(v).find(Array.isArray); } catch { /* fall through */ }
  if (!items) { console.error('local-llm: no JSON list in the reply, raw follows'); console.log(out.response); process.exit(3); }
  for (const s of items) console.log(String(s).trim());
} else console.log(out.response.trim());
console.error(`[${model}, ${tps} tok/s]`);

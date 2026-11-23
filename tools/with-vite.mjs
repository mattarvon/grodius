// Run a probe against a fresh Vite dev server: a new cacheDir every run, file watching and HMR off, so no HMR timestamp
// (?t=) can split a module into two instances. After an edit, a long-lived dev server serves the game's modules as
// /src/x.ts?t=<stamp> while a probe's own import('/src/x.ts') gets a second, empty copy, and the probe silently reads
// nothing (W5 follow-up, item 11). The probes also refuse such a page (tools/layout-arg.mjs useLayout).
// Usage: node tools/with-vite.mjs [--port 5210] -- <command ...>   every {URL} in the command becomes the server's URL
//   e.g. node tools/with-vite.mjs --port 5211 -- node tools/pod-probe.mjs {URL} 1 16 1 --pilot --tier 1
// The server uses this checkout's vite.config.ts (root = the repo), listens on 127.0.0.1 only, and is closed (and its
// cache removed) when the command exits; the command's exit code is passed through.
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2), dd = argv.indexOf('--');
if (dd < 0 || dd === argv.length - 1) { console.error('usage: node tools/with-vite.mjs [--port N] -- <command ...> ({URL} = the server)'); process.exit(2); }
const pi = argv.indexOf('--port'), PORT = pi >= 0 && pi < dd ? +argv[pi + 1] : 5210;
if (!(PORT > 0)) { console.error('--port needs a number'); process.exit(2); }
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cacheDir = mkdtempSync(join(tmpdir(), `grodius-vite-${PORT}-`));
let nm = null; try { nm = realpathSync(join(root, 'node_modules')); } catch (e) {} // a worktree's node_modules is often a junction
const rmCache = () => { try { rmSync(cacheDir, { recursive: true, force: true }); } catch (e) {} };
// watching off: vite.config.ts sets server.watch, and mergeConfig skips a null override, so an ignore-everything
// matcher is merged in and the resolved config's watch is nulled as well; hmr false keeps lastHMRTimestamp at 0 (no ?t=)
const noWatch = { name: 'w5-no-watch', configResolved(c) { c.server.watch = null; } };
let server;
try {
  server = await createServer({
    root, cacheDir, logLevel: 'error', clearScreen: false, plugins: [noWatch],
    server: { port: PORT, strictPort: true, host: '127.0.0.1', watch: { ignored: () => true }, hmr: false, fs: { allow: [root, ...(nm ? [nm] : [])] } },
  });
  await server.listen();
} catch (e) { console.error(`with-vite: could not start Vite on ${PORT}: ${e.message}`); rmCache(); process.exit(2); }
const url = `http://127.0.0.1:${PORT}/`;
// warm the module graph once so the first probe page doesn't race the dependency pre-bundle
try { await fetch(url + 'src/main.ts'); await fetch(url); } catch (e) {}
const cmd = argv.slice(dd + 1).map((a) => a.split('{URL}').join(url));
// `node` runs as this very Node (no shell, args passed as they are); anything else (npx, a .cmd) goes through the shell
// on Windows, each argument quoted
const isNode = cmd[0] === 'node', q = (a) => (/^[\w./:=@%+,-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`);
const child = isNode ? spawn(process.execPath, cmd.slice(1), { stdio: 'inherit' })
  : spawn(process.platform === 'win32' ? cmd.map(q).join(' ') : cmd[0], process.platform === 'win32' ? [] : cmd.slice(1), { stdio: 'inherit', shell: process.platform === 'win32' });
const done = async (code) => { try { await server.close(); } catch (e) {} rmCache(); process.exit(code ?? 1); };
child.on('exit', (code) => done(code));
child.on('error', (e) => { console.error('with-vite: ' + e.message); done(1); });
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { child.kill(); });

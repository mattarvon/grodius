#!/usr/bin/env python3
"""Mirror this repo's docs into the Obsidian vault, byte-compatible with
E:\\projects\\obsidian-vault-sync\\Sync-Vault.ps1 (same frontmatter stamp, callout, stale cleanup).
Exists so the mirror can be refreshed from a shell without PowerShell (e.g. after a push from CI or Claude).

  python3 tools/vault_mirror.py <repo dir> <vault Projects/Grodius dir> [--win-repo E:\\projects\\grodius]

Keep INCLUDE in sync with the Grodius entry in Sync-Vault.ps1's $Manifest.
"""
import datetime, glob, os, subprocess, sys

INCLUDE = ['README.md', 'CHANGELOG.md', 'docs/*.md', 'docs/*.png']


def git(repo, *args):
    try:
        return subprocess.run(['git', '-C', repo, *args], capture_output=True, text=True, check=True).stdout
    except Exception:
        return ''


def main():
    repo, proj = sys.argv[1], sys.argv[2]
    win_repo = sys.argv[sys.argv.index('--win-repo') + 1] if '--win-repo' in sys.argv else repo
    dest = os.path.join(proj, 'Mirrors')
    url = git(repo, 'remote', 'get-url', 'origin').strip()
    url = url[:-4] if url.endswith('.git') else url
    commit = git(repo, 'log', '-1', '--format=%h').strip()
    dirty = len([l for l in git(repo, 'status', '--porcelain').splitlines() if l.strip()])
    today = datetime.date.today().isoformat()
    name = os.path.basename(win_repo.rstrip('\\/').replace('\\', '/'))
    wanted, n = set(), 0
    for pat in INCLUDE:
        for f in sorted(glob.glob(os.path.join(repo, pat))):
            if not os.path.isfile(f):
                continue
            rel = os.path.relpath(f, repo)
            out = os.path.join(dest, rel)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            wanted.add(os.path.normcase(os.path.abspath(out)))
            if f.endswith('.md'):
                body = open(f, encoding='utf-8').read()
                rel_win = rel.replace('/', '\\')
                stamp = (
                    '---\n'
                    'type: mirror\n'
                    f'source: {win_repo}\\{rel_win}\n'
                    f'repo: {url}\n'
                    f'commit: {commit}{f" (+{dirty} uncommitted)" if dirty else ""}\n'
                    f'synced: {today}\n'
                    '---\n'
                    f'> [!info] Read-only mirror of `{rel_win}` in **{name}**{f" @ {commit}" if commit else ""}. '
                    'Edit in the repo, then run `Sync-Vault.ps1`.\n'
                )
                with open(out, 'w', encoding='utf-8', newline='\n') as w:
                    w.write(stamp + body)
            else:
                with open(f, 'rb') as r, open(out, 'wb') as w:
                    w.write(r.read())
            n += 1
    for root, _, files in os.walk(dest):
        for fn in files:
            p = os.path.join(root, fn)
            if os.path.normcase(os.path.abspath(p)) not in wanted:
                os.remove(p)
                print('removed stale mirror:', p)
    print(f'Synced {n} files into {dest} @ {commit} ({today})')


if __name__ == '__main__':
    main()

# Engine Reference — not used by Grodius

The Claude Code Game Studios template keeps version-pinned engine API snapshots
here (`<engine>/VERSION.md`, `breaking-changes.md`, `deprecated-apis.md`,
`modules/*.md`) for Godot, Unity and Unreal.

**Grodius has no engine.** It is TypeScript on a Canvas 2D context, built with
Vite and packaged for Android with Capacitor. The godot/unity/unreal folders
were removed (see `.claude/.ccgs-source`).

The pinned toolchain and its post-cutoff changes live in
**`docs/architecture/stack-reference.md`**. Where a skill or agent says to read
`docs/engine-reference/<engine>/...`, read that file instead, and verify library
APIs against the installed types in `node_modules/<pkg>/`.

`engine.name` in `project.yaml` is intentionally unset; `specialists.*` route to
`web-specialist`.

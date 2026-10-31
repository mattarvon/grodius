> Gate definition. The spawning skill passes this file's path to the director agent; the AGENT reads it — the parent session should not.

# TD-ENGINE-RISK — Engine Version Risk Review

Agent: `technical-director` | Model tier: Opus | Domain: Architecture, engine risk, performance

**Trigger**: When making architecture decisions that touch post-cutoff engine APIs,
or before finalizing any engine-specific implementation approach

**Context to pass**:
- The specific API or feature being used
- Engine version and LLM knowledge cutoff (from `docs/engine-reference/[engine]/VERSION.md`)
- Relevant excerpt from breaking-changes or deprecated-apis docs
- **Grodius (no engine):** pass the pinned package version and the "what changed"
  notes from `docs/architecture/stack-reference.md`, plus the installed type
  signature from `node_modules/<pkg>/**/*.d.ts` for the API in question. If no
  installed type or stack-reference entry covers the API, the reviewer returns
  CONCERNS with `NOT SOURCEABLE — <API> is not covered by stack-reference.md or
  the installed types`, never APPROVE

**Prompt**:
> "Review this engine API usage against the version reference. Is this API present
> in [engine version]? Has its signature, behaviour, or namespace changed since the
> LLM knowledge cutoff? Are there known deprecations or post-cutoff alternatives?
> Return APPROVE (safe to use as described), CONCERNS [verify before implementing],
> or REJECT [API has changed — provide corrected approach]."

**Verdicts**: APPROVE / CONCERNS / REJECT

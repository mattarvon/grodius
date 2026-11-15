// The booth's text frame (LS2-booth, see text.html): reads every slot's words from the game modules and posts them
// to the booth page as { [cat]: { lines, name?, face, tag } }, so the script shown to the speaker is the game's own
// text, and the caller is the game's own face and tag.
// Imports follow main.ts's order for the modules they pull in: the kind files sit in an import cycle that main.ts's
// order resolves (src/CLAUDE.md "Load order").
import '/src/core';
import '/src/save';
import '/src/audio';
import '/src/input';
import '/src/world';
import '/src/fx/spawn';
import '/src/enemies/spawn';
import '/src/enemies/update';
import '/src/enemies/mid';
import { CARN, HYPE } from '/src/fx/update';
import { MID_NAMES, MID_SIM } from '/src/enemies/mid/roster';
import { voiceOf } from '/src/render/hype';
import { SLOTS } from './slots';
import { slugify } from './names';

const out: Record<string, { lines: string[]; name?: string; err?: string; face?: number; tag?: string }> = {};
for (const s of SLOTS) {
  const t = s.text;
  if (!t) continue;
  if ('hype' in t) out[s.cat] = HYPE[t.hype] ? { lines: [...HYPE[t.hype]] } : { lines: [], err: `HYPE[${t.hype}] is gone` };
  else if ('carn' in t) {
    const w = CARN.find(([n]) => n === t.carn);
    out[s.cat] = w ? { lines: [String(w[1])] } : { lines: [], err: `CARN has no ${t.carn}` };
  } else {
    const w = MID_SIM[t.mid]?.word;
    out[s.cat] = w ? { lines: [w], name: MID_NAMES[t.mid] } : { lines: [], err: `no midboss '${t.mid}'` };
  }
}
// the face and tag the comms window gives a take of this slot (render/hype.ts voiceOf, by folder or by clip name):
// the booth shows the game's own answer, so a slot the game would call UNKNOWN CALLER shows that
for (const s of SLOTS) {
  const o = (out[s.cat] ||= { lines: s.copy?.lines ?? [] });
  const [face, tag] = voiceOf((s.slug ?? slugify(o.lines.join(' '))) + '-matty-1', s.cat);
  Object.assign(o, { face, tag });
}
parent.postMessage({ booth: 'text', out }, location.origin);

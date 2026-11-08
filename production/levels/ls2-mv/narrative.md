# LS2-mv narrative review (narrative-director)

Verdict: no BLOCKING. Two SHOULD FIX, four NICE TO HAVE. Read: studio brief, game-brief pillars and tone (Event Horizon straight man, pillar 5), the BIOMES table (names, subs, logs), `src/setdraw.ts` CATALOG, `src/render/moveprops.ts` (first 60 lines: ice and the start of acid), contact sheets sets1-3. I did not read the SET bodies in the diff or the second half of moveprops.ts, so the "no player-facing text" check below is partial.

## Player-facing text
None seen. CATALOG ids are internal keys and moveprops has only comments. The sheets show only pre-existing HUD and log lines. Please confirm with a quick grep of the diff for new quoted uppercase strings in `SET` and `logLine` calls; I could not run it (the grep tool was broken in this shell). Unchanged: BIOMES names, tags, subs and logs.

## Naming voice
No impact, it fits. Existing ids are single lowercase nouns or verbs (morgue, crucify, walls, gutter, pincer, kiln, flood, drip). The new twelve match. Several echo the logs: `sneeze` (IT SNEEZED), `clot` and `congestion` (THE CLOG IS CHEWING), `slurry` and `vats` (THE TANK IS NOT FULL), `thaw` (THE COLD IS NOT SLOWING THEM DOWN), `backdraft` and `cinders` (ASH IS FALLING UP). `meatline` is the only compound word, and it is fine. `vigil` has no religious iconography on the sheet, so the pending iconography rule is untouched. `crucify` already exists and is not part of this diff.

## Biome by biome (does it tell the story)
- **Ice, "the crew is frozen mid-scream".** Pack (hulks walking among the frozen blocks) is the strongest beat: THE BODIES ARE STANDING UP. Thaw implies the cold failing, which suits the arc of the log lines. Vigil is the thinnest. On the sheet thaw, vigil and pack share the same backdrop of frozen crew in blocks, so they differ only by spawn pattern and a few props. Crevasse and Shelf stairs read as the vault's architecture, good.
- **Acid, "everything is being eaten".** Strongest biome. Vats puts skeleton crew in lit tanks, which is dread before gore, and the swimmer in slurry is the "BOOT FLOATS PAST" beat. The Flooded tank gimmick (the lake rises and swells) literally dramatises "THE TANK IS NOT FULL. IT IS STILL EATING." Lining looks nearly empty on the sheet, so its story is weak. Folds reads as stomach wall.
- **Fire, "they burned the bodies, the bodies kept moving".** Meatline (bodies hung on chains) is exactly right. Backdraft and the Chimney B1 (ceiling vents with jets) carry "INCINERATOR RUNNING". Cinders (skeleton and flame figures on the ground) is good. Spire field is fine, more of the same furnace.
- **Snot, "the ship has a cold".** Sneeze, clot and congestion fit the cold conceit, and the cocoon figures in mucus keep the crew present. Polyps is a good, gross-funny gimmick. Problem: see SHOULD FIX 1.

## Emotional beat of the movement-B stretch
The sequence is breather with midboss A, then the gimmick, then breather with midboss B. The terrain-as-threat idea works narratively as "the biome itself turns on you between the two bodies". Ice teeth, rising acid, spires and vents all escalate pressure and then release into the second breath. Snot is the exception: Peristalsis (the narrows marching toward you) is the most legible "the room is alive" beat, but it is a digestive concept. The Sinus is respiratory and the acid biome owns digestion (Folds), so the two risk reading as the same idea.

## Findings
**SHOULD FIX**
1. Snot B0 "Peristalsis" and acid B1 "Folds" both read as gut motion. Keep the mechanic, but reframe the Sinus one as mucus clearing and drainage: a swallow, or a cough or sneeze building. In practice, rename it in code comments and docs (e.g. "Drainage"), and have the render-only contraction bands read as cilia or sphincter rings, not gut rings. This also aligns it with the `sneeze` set piece. It is a naming and art note for the art-director to decide; it does not change the mechanic.
2. Within each biome, the three new set pieces share one backdrop and differ mostly by spawn pattern (ice thaw, vigil and pack; acid slurry and vats). Pillar 4 treats repetition as a bug, and the contact sheets rely on props to differentiate. Give each piece one distinct, readable crew or remains vignette. Suggested: ice vigil gets frozen figures facing one way, as if gathered; acid lining gets debris such as a boot or helmet drifting at the lip; fire cinders gets a ring of scorched figures. Art-director to decide.

**NICE TO HAVE**
3. Interim art: the moveprops files are procedural and wait on round 2 (meridian, idiom). Ice stairs, acid tank rungs and crevasse cracks carry no story yet. Revisit once the idiom answer lands.
4. One new log line per gimmick would deepen the stretch (cold sensor text only, e.g. an ice crevasse reading). It needs producer approval for added narrative scope and is not required now. Keep it deadpan (pillar 5).
5. Acid Lining on its own is the weakest story beat, as noted above. Consider swapping its position in the draw weights so it is less often a stage's S1.
6. The first-visit B1 roll in Descent 2+ (p .5) means the player may see "remix" gimmicks before the remix biome fiction (set remix sig). That is harmless tonally but worth a note in the content docs.

## Contradictions check
No lore contradiction with BIOMES logs, subs or the Event Horizon framing. No duplication of an existing beat beyond the thaw, vigil and pack overlap in finding 2. No tone break: no jokes in sensor text, and the gross-out is carried by creatures and props.

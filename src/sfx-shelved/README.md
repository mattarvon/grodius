# Shelved clips

These clips are kept, but the game doesn't load them. `src/audio.ts` loads only `./sfx/*/*`.

Matt shelved the first two on 2026-11-07 because they got repetitive. He'll decide later where to use them sparingly.
The rest went the same day in the tone pass ("more evil, not cartoonish", decision D39): comedy now lives in the comms only, and these read as a laugh track.

| Clip | Was in | Played when |
|---|---|---|
| `hype10/shamalama-matty-1.ogg` (BROTHER SHAMALAMA) | `src/sfx/hype10/` | The 10-kill chain hype. It shared a shuffle bag with `hell-yeah`, shelved since (below). |
| `bossreward/keyster-easter-matty-1.ogg` (THE KEYSTER) | `src/sfx/bossreward/` | Each stage-boss kill (`src/stages.ts:98`). With no clips left in that category, the boss reward plays no voice line. |
| `hype10/hell-yeah-matty-1.ogg` (SGT. RAMROD SLAB) | `src/sfx/hype10/` | The 10-kill chain hype. The chain still shows its comms window; with no clip and no text-to-speech it is silent apart from the `sfx.hype()` sting. |
| `babe20/sfriend-matty-1.ogg` (SURF CONTROL) | `src/sfx/babe20/` | The 20-kill surfer flyby and its "EXCELLENT WORK, BABY!" bubble, both cut (`src/fx/update.ts` `babe()` is gone; the 20-chain calls `hype(20)`). |
| `babe20/shamalama-matty-1.ogg` (BROTHER SHAMALAMA, second copy) | `src/sfx/babe20/` | The 20-kill surfer flyby, cut with it. Unplayed, so shelved rather than bundled and decoded at boot. Matt still picks a rare trigger for SHAMALAMA (decision log, Open). |
| `silly/*` (12 generated comedy clips and 3 of Matty's farts) | `src/sfx/silly/` | ~1 in 7 kills (`sfx.gore()` in `src/audio.ts`). The call is removed, so there is no synth stand-in. |
| `snot-jello/ov-jello-squish-01..06.ogg` | `src/sfx/snot/` | The Sinus kill layer (`audiomix.ts` `BIOME_KILL.snot`). The other 12 `ov-squish*` clips stay in `snot`. |

**To bring one back,** move it into a category folder under `src/sfx/`, or give it a new category plus its own trigger, so it can play sparingly. The comms-window faces for the voice lines are still mapped in `src/render/hype.ts` (`VOICE` rows), so a voice clip can be un-shelved without code. Bringing back `sfriend` needs a new trigger, since the 20-chain flyby is gone.

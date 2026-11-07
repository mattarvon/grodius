# Shelved voice lines

These clips are kept, but the game doesn't load them. `src/audio.ts` loads only `./sfx/*/*`.

Matt shelved them on 2026-11-07 because they got repetitive. He'll decide later where to use them sparingly.

| Clip | Was in | Played when |
|---|---|---|
| `hype10/shamalama-matty-1.ogg` (BROTHER SHAMALAMA) | `src/sfx/hype10/` | The 10-kill chain hype. It shared a shuffle bag with `hell-yeah`, which now plays alone. |
| `bossreward/keyster-easter-matty-1.ogg` (THE KEYSTER) | `src/sfx/bossreward/` | Each stage-boss kill (`src/stages.ts:98`). With no clips left in that category, the boss reward plays no voice line. |

**To bring one back,** move it into a category folder under `src/sfx/`, or give it a new category plus its own trigger, so it can play sparingly. The comms-window faces for both are still mapped in `src/render/hype.ts`.

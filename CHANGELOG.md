# Changelog

Newest first. Every push to `main` builds a fresh APK ([latest release](https://github.com/mattarvon/grodius/releases/tag/latest)) and redeploys https://mattarvon.github.io/grodius/.

## 2026-10-03

### Your voice on the hype man
- 10-kill chain "HELL YEAH BROTHER!" now plays Matty's own recording (RecForge II, trimmed, high-passed, compressed, loudness-normalized) instead of text-to-speech; the splash holds longer to match the 4.4s line.
- Any milestone can be voiced the same way: drop a clip in `src/sfx/hype<N>/` (hype20, hype35, hype50, hype75, hype100). Milestones without a clip keep the robot voice.

### Sound: sample banks (`842c59b`, `5d878de`)
- Kills, explosions and deaths play from sample folders (`src/sfx/<category>/`), random pick with pitch/volume jitter, never the same clip twice in a row.
- 78 original synthesized clips (`tools/gen_sfx.py`): wet pops, squelches, heavy bursts with drip tails, bone cracks, a comedy set (raspberries, blorps, gurgles), small and large layered explosions.
- Kenney Impact Sounds (CC0): punches and soft impacts as a `thud` layer under medium/big kills, wood cracks in `bone`, explosion crunches and low booms in the explosion banks, slime in small splats.
- ~1 kill in 7 gets the comedy layer; half of the heavy kills get a bone crack.

### Progression rework (`140c0ac`)
- Each descent is 4 stages with stage cards: Open Orbit (Maw), The Hull (Crucifer), The Corridors (Butcher), The Gravity Drive.
- Stage clear tally: kill %, hits, deaths, best chain, time, grade S/A/B/C. Pays score x descent and biomass; PERFECT bonus for no hits; best grade per stage saved.
- Seals break on the 2nd, 4th and 6th stage cleared, not every mini-boss. Full unseal moved from ~3 minutes to Descent 2.
- WARD soaks 3 hits (was 10); regrowth much slower. Graft thresholds ~3x.
- Death keeps half your THRUST, nothing else. Power rank now adds enemy HP (up to +80%, minis +40%) and bigger formations.
- Infirmary sells options, not power: removed Hollow-Point, Nerve Graft, Second Skin, Bound Wraith (biomass refunded). Black Box drops your guns as recoverable pods. New: Descend Deeper, Flesh Sculpt.

### Android app (`3208210` .. `eb6216e`)
- Split the single 2,000-line file into ~30 Vite + TypeScript modules; proven behavior-identical with a seeded replay harness (`tools/harness.mjs`). Old version on branch `legacy-singlefile`.
- Capacitor Android app: fullscreen, camera cutout, keep-awake, pause on background, back button, haptics, native text-to-speech for voice lines, bundled fonts.
- Galaxy Fold: drag anywhere to fly; on the inner screen the game pins to the top and the space below is a thumb zone.
- GitHub Actions builds the APK on every push and publishes it to the `latest` release; web build to GitHub Pages.

### Gore and readability (`1f2dcc9`)
- Gore cut ~40%: fewer particles, airborne gore clears faster, floating chunks fade back. Floor and ceiling gore keeps its long life.
- Graft pods crawl to a reachable spot instead of dying at the screen edge.
- "GRAFT GROWN" banner moved to a compact top-right strip.

## 2026-10-02
- Initial build through mini-bosses, kill-driven mutations, typed power pods, earned progression, hype man, 20-chain surfer flyby (built in Claude Desktop, single HTML file).

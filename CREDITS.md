# Credits

Third-party assets bundled in the game. Everything here is CC0 or CC BY, so it is fine in this public repo
as long as the CC BY credits stay visible (this file + the title screen line).
Raw downloads live in `assets-raw/` (git-ignored, on Matty's machine only).

## Music (`src/music/`)
| File | Track | Artist | License | Source |
|---|---|---|---|---|
| `void-02-institutional-values.ogg` | Institutional Values | dancramp | CC BY 4.0 | https://dancramp.itch.io/void-music-pack |
| `void-05-cyber-side-scroller.ogg` | Cyber Side Scroller | dancramp | CC BY 4.0 | same |
| `void-07-heist.ogg` | Heist | dancramp | CC BY 4.0 | same |
| `void-08-caves.ogg` | Caves | dancramp | CC BY 4.0 | same |
| `void-09-pods.ogg` | Pods | dancramp | CC BY 4.0 | same |
| `void-10-title-music.ogg` | Title Music for an Imaginary Sci-Fi Platformer | dancramp | CC BY 4.0 | same |
| `void-11-corporate-identity.ogg` | Corporate Identity | dancramp | CC BY 4.0 | same |
| `void-12-not-done-here-yet.ogg` | We're Not Done Here Yet | dancramp | CC BY 4.0 | same |
| `void-13-finale.ogg` | Finale | dancramp | CC BY 4.0 | same |

All tracks are from the album *Void* by dancramp (https://dancramp.itch.io/void-music-pack), licensed CC BY 4.0
(https://creativecommons.org/licenses/by/4.0/). Changes: the closing fade-out is trimmed and replaced with a 2 s fade
so the track can loop; re-encoded as Ogg Vorbis q3; gain-matched to -16 LUFS. The full WAVs are in
`assets-raw/music/void-dancramp/`.

Earlier soundtrack (no longer bundled; still in git history and `assets-raw/`): David KBD "Eternity" (CC BY 4.0),
Kenten Fina "Tech Rooms" (CC BY 3.0), Ruskerdax "Bleak Terminal" (CC0).

## Sound effects (`src/sfx/`)
| Files | Source | License |
|---|---|---|
| `kenney-*.ogg` | Impact Sounds, Kenney (kenney.nl) | CC0 |
| `gen-*.ogg` | synthesized by `tools/gen_sfx.py` | original |
| `*-matty-*.ogg` | Matty's own recordings (RecForge II) | original |

## Openverse picks (found with `tools/openverse.mjs`, processed by `tools/import_openverse.py`)

All CC0, CC BY or public domain. Freesound audio is the HQ preview MP3; sound effects are cut into one-shots,
trimmed, faded and level-matched (files `src/sfx/<bank>/ov-*.ogg`); music is silence-trimmed and normalized to
-16 LUFS (`src/music/ov-*.ogg`); images are cropped, resized and masked (`src/img/`).

### Music and stingers
| Title | Creator | License | Source | Used as |
|---|---|---|---|---|
| DX7 SynthWave Chords | ValentinSosnitskiy | CC0 1.0 | https://freesound.org/people/ValentinSosnitskiy/sounds/554256 | `ov-dx7-chords` Infirmary (alternate visits) |
| 2020-03-18 Synthwave - Doctor Dreamchip | Doctor_Dreamchip | CC BY 4.0 | https://freesound.org/people/Doctor_Dreamchip/sounds/511278 | `ov-dreamchip-synthwave` Open Orbit, Descent 3 |
| Circuit Synthwave Alt | Doctor_Dreamchip | CC0 1.0 | https://freesound.org/people/Doctor_Dreamchip/sounds/460358 | `ov-circuit-synthwave` Open Orbit, Descent 2 |
| Circuit Synthwave | Doctor_Dreamchip | CC0 1.0 | https://freesound.org/people/Doctor_Dreamchip/sounds/460357 | `ov-circuit-synthwave` Open Orbit, Descent 2 |
| Film Movie Synthwave Electropop Dance Retrowave 90s Atmo Cinematic music Mastered 120Bpm.wav | szegvari | CC0 1.0 | https://freesound.org/people/szegvari/sounds/623421 | `ov-synthwave-electropop` Open Orbit, Descent 4+ |
| Action music loop with dark ambient drones | burning-mir | CC0 1.0 | https://freesound.org/people/burning-mir/sounds/155139 | `ov-dark-drone-loop` the fork |
| drone Space wind scifi.wav | ztitchez | CC BY 4.0 | https://freesound.org/people/ztitchez/sounds/370754 | `ov-space-wind` Gravity Drive approach, Descent 3+ |
| horror ambience 16.wav | klankbeeld | CC BY 4.0 | https://freesound.org/people/klankbeeld/sounds/137109 | `ov-horror-ambience` game over |
| ScaryViolins.ogg | lennyboy | CC0 1.0 | https://freesound.org/people/lennyboy/sounds/244417 | `sfx/stinger` midboss warning |
| Cyberpunk Beat.wav | Disquantic | CC0 1.0 | https://freesound.org/people/Disquantic/sounds/525290 | `ov-cyberpunk-beat` THE MAW, Descent 1 |
| Cyberpunk 24042017_Snippet_75 bpm [loop] | cabled_mess | CC0 1.0 | https://freesound.org/people/cabled_mess/sounds/393330 | `ov-cyberpunk-snippet` THE MAW, Descent 2+ |
| Deep 01 loading, looping | cabled_mess | CC0 1.0 | https://freesound.org/people/cabled_mess/sounds/338368 | `sfx/forkopen` gates open |

### Sound effects
| Title | Creator | License | Source | Bank |
|---|---|---|---|---|
| Wet Meat.mp3 | RICHERlandTV | CC BY 4.0 | https://freesound.org/people/RICHERlandTV/sounds/264184 | splat_s/m/l |
| Massacred Banana 01 | aglinder | CC0 1.0 | https://freesound.org/people/aglinder/sounds/264478 | splat_s/m/l |
| squishy_flesh_thingy_seamless.wav | 1urker | CC0 1.0 | https://freesound.org/people/1urker/sounds/435896 | splat_s/m/l |
| Ripping slimy squelching flesh(comp,lmtr,dns,Eq,lmtr).wav | newlocknew | CC BY 4.0 | https://freesound.org/people/newlocknew/sounds/536831 | splat_s/m/l |
| Slimy squelching flesh(comp,lmtr,dnsx2,Eq,lmtr).wav | newlocknew | CC BY 4.0 | https://freesound.org/people/newlocknew/sounds/536830 | splat_s/m/l |
| Ice organic crack creak - Frozen vegetable | Nakhas | CC0 1.0 | https://freesound.org/people/Nakhas/sounds/522884 | bone |
| Explosion Simulation | ALLANZ10D | CC0 1.0 | https://freesound.org/people/ALLANZ10D/sounds/235426 | explode_s/l |
| Real explosions Real gunshots.wav | The_Sound_Side | CC0 1.0 | https://freesound.org/people/The_Sound_Side/sounds/262436 | explode_s/l |
| Dynamite explosion in the mountain | felix.blume | CC0 1.0 | https://freesound.org/people/felix.blume/sounds/251401 | explode_s/l |
| distant explosions | Kostrava | CC0 1.0 | https://freesound.org/people/Kostrava/sounds/320788 | explode_s/l |
| Wire explosions / vibrations (slow) | mlteenie | CC BY 4.0 | https://freesound.org/people/mlteenie/sounds/153112 | explode_s/l |
| Tesla Monster - Growl | vartioh | CC BY 4.0 | https://freesound.org/people/vartioh/sounds/128237 | monster (boss roars) |
| Deep gargly monster growls | griffinjennings | CC BY 4.0 | https://freesound.org/people/griffinjennings/sounds/463972 | monster (boss roars) |
| Zombie Voice | PatrickLieberkind | CC BY 4.0 | https://freesound.org/people/PatrickLieberkind/sounds/213835 | monster (boss roars) |
| haunted shrills.wav | squashy555 | CC0 1.0 | https://freesound.org/people/squashy555/sounds/240091 | monster (boss roars) |
| squishes.wav | Eneasz | CC0 1.0 | https://freesound.org/people/Eneasz/sounds/216882 | snot (Sinus kills) |
| Squish.wav | SaxOman7 | CC0 1.0 | https://freesound.org/people/SaxOman7/sounds/448641 | snot (Sinus kills) |
| Jello Squish | Fugeni | CC0 1.0 | https://freesound.org/people/Fugeni/sounds/559768 | snot (Sinus kills) |
| multiple siren | Kostrava | CC0 1.0 | https://freesound.org/people/Kostrava/sounds/324276 | warning (sirens) |
| Nuclear alarm of Tihange (Liège, Belgium) | phoriqaz | CC0 1.0 | https://freesound.org/people/phoriqaz/sounds/441089 | warning (sirens) |

### Images
| Title | Creator | License | Source | Used as |
|---|---|---|---|---|
| Neptune - Nasa's Voyager 2 - 1989 | Andrea Luck | CC BY 2.0 | https://www.flickr.com/photos/192271236@N03/52494377269 | `neptune-voyager.png` Neptune, Descent 1 |
| Neptune Through the Years | James Webb Space Telescope | CC BY 2.0 | https://www.flickr.com/photos/50785054@N03/52373099987 | `neptune-webb.png` ringed Neptune, Descent 2+ (right panel) |
| X-ray skull | erix! | CC BY 2.0 | https://www.flickr.com/photos/68387408@N00/267167699 | `xray-skull.png` Infirmary lightbox |
| The Perseus Cluster's X-Ray Skull | NASA Universe | CC BY 2.0 | https://www.flickr.com/photos/50306086@N07/5127020922 | `perseus-skull.png` behind the Gravity Drive |
| Dental X-ray | icethim | CC BY 2.0 | https://www.flickr.com/photos/15977536@N06/5443947055 | `xray-teeth.png` Infirmary lightbox |

### JWST deep field (`src/img/deepfield.png`)
JADES GOODS-S NIRCam mosaics v2.0 (F444W/F200W/F090W as R/G/B), the JWST Advanced Deep Extragalactic Survey,
NASA/ESA/CSA/STScI, via MAST HLSP (https://archive.stsci.edu/hlsp/jades), CC BY 4.0. Found through the Registry of
Open Data on AWS (`mast-jades`); a 2400x636 px cutout read with S3 range requests by `tools/jades_backdrop.py`,
asinh-stretched and downsampled. Open Orbit sky, Descent 1.

### JWST nebula skies (`src/img/sky-*.png`, built by `tools/roda_sky.py`)
From RODA dataset `mast-jwst` (MAST public JWST products, bucket `stpubdata`): public domain ("Attribution required
for refereed scientific papers"). Credit: NASA, ESA, CSA, STScI. Cutouts read with S3 range requests and colour-graded.

| Image | Program / files | Used as |
|---|---|---|
| Cosmic Cliffs, NGC 3324 (NIRCam F444W/F335M/F187N) | ERO 2731, `jwst/public/jw02731/L3/t/o001/` | `sky-carina.png` Open Orbit sky, Descent 2 + title backdrop |
| Tarantula Nebula, 30 Doradus (NIRCam F444W/F335M/F187N) | ERO 2729, `jwst/public/jw02729/L3/t/o001/` | `sky-tarantula.png` Open Orbit sky, Descent 3 |
| Cassiopeia A (MIRI F2550W/F1800W/F1130W) | program 1947, `jwst/public/jw01947/L3/t/o001/` | `sky-casa.png` breathing "wound" layer in Open Orbit |

## Fonts
Silkscreen and Grenze Gotisch via @fontsource (SIL Open Font License 1.1).

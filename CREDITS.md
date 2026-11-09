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

### Diseased-tissue terrain textures (`src/img/tex-*.png`, built by `tools/roda_textures.py`)
All CC0, read from public buckets in the Registry of Open Data on AWS. Blended, tiled and colour-graded per biome.

| Source | Creator | License | Used in |
|---|---|---|---|
| CAMELYON16 H&E sentinel lymph node slide `tumor_001` (s3://camelyon-dataset/CAMELYON16/images/tumor_001.tif), RODA `camelyon` | Radboud University Medical Center; Litjens et al., GigaScience 7(6) 2018 | CC0 | tex-flesh, tex-ice, tex-acid, tex-fire |
| *Fuligo septica* (grey foam), iNaturalist obs 383324913, photo 701579492, RODA `inaturalist-open-data` | jasonwebb | CC0 | tex-acid |
| *Fuligo septica* (yellow), iNaturalist obs 173293091, photo 300927385 | cam_boucher | CC0 | tex-snot |
| *Leocarpus fragilis*, iNaturalist obs 77441896, photo 126652158 | kent_ozment | CC0 | tex-snot |
| *Exidia glandulosa*, iNaturalist obs 80102771, photo 131259259 | dimitribrosens | CC0 | tex-fire |
| *Ascocoryne sarcoides*, iNaturalist obs 256815760, photo 460544380 | quillipede | CC0 | tex-flesh |
| *Didymium spongiosum*, iNaturalist obs 330256534, photo 598824077 | pilmar | CC0 | tex-ice |

## OpenGameArt sprites (found with `tools/sprite-scout.mjs`, cut and recoloured by `tools/prep_*.py` into `src/sprites/`)
All repainted toward the game's palette; CC-BY / OGA-BY rows are the ones that require this credit.
| Used for | Work | Author | License | Source |
|---|---|---|---|---|
| Swarm drone (`wasp`) | wasp | Tiamalt | CC-BY 3.0 | https://opengameart.org/content/wasp |
| Hatchling (`eyeball`) | Floating Eyeball | OwlishMedia | CC0 | https://opengameart.org/content/floating-eyeball-0 |
| Drifting corpses (`corpse`) | Zombie Character Pack | Soluna Software | CC0 | https://opengameart.org/content/zombie-character-pack |
| Wall eye turret, ceiling womb (`walleye`, `womb`) | Top Down Tentacle Creature | Sean Noonan | CC0 | https://opengameart.org/content/top-down-tentacle-creature |
| Wall crawler (`earwig`) | Earwig top down | Scarcz | CC-BY 4.0 | https://opengameart.org/content/earwig-top-down |
| Snot slime (`slime-*`) | Blob Sprite | Woostar | CC0 | https://opengameart.org/content/blob-sprite |
| Hulking mutant (`mutant-*`) | Zombie - Fully Animated | Cethiel | CC0 | https://opengameart.org/content/zombie-fully-animated |
| Security drone (`sentry`), corridor plating (`src/img/tex-derelict.png`) | Enemy sprite | mieki256 | CC0 | https://opengameart.org/content/enemy-sprite |
| THE SQUIDFUCKED SAUCER (`ufo1-3`) | Alien Boss Set (Infested UFO Boss) | The_Scientist___ | CC0 | https://opengameart.org/content/alien-boss-set |
| Hit sparks (`hit_*`) | Sparks (Fire, Ice, Blood) | Clint Bellanger | CC-BY 3.0 | https://opengameart.org/content/sparks-fire-ice-blood |
| Explosions (`boom_*`) | Space Sprites: "Sinistar clone", "Hard Vacuum" & "Remastered Tyrian" graphics by Daniel Cook (Lostgarden.com), collected by titmouse001 | Daniel Cook | CC-BY 3.0 | https://opengameart.org/content/space-sprites-0 |
| Eye irises (`iris_grey`, `pupil`) | Eyeballs | sunburn | CC-BY 3.0 | https://opengameart.org/content/eyeballs |
| Triton (`src/img/triton.png`) | Planet T | krislachowski | CC0 | https://opengameart.org/content/planet-t-0 |
| Ice crystals (`crystal-*`) | Magic Fence | qwedeath | CC0 | https://opengameart.org/content/magic-fence |
| Hype-voice comms faces (`hface`) | Modular Reticulan Portraits | surt | CC0 | https://opengameart.org/content/modular-reticulan-portraits |
| Game-over demon (`creep`) | Animated Creepy Thing | Charlie | CC0 | https://opengameart.org/content/animated-creepy-thing |
| Infirmary poster (`poster`) | Zombie Take Away | CiderCorpse | OGA-BY 3.0 | https://opengameart.org/content/zombie-take-away |

## Title eye and head (`src/sprites/`)
| Used for | Work | Author | License |
|---|---|---|---|
| Title hero eye (`rot_*`), eye kit (`kit/eye_*`, not yet used in play) | original, procedural, `tools/gen_eyes.py` | made for Grodius | original, first-party (not CC) |
| Title easter-egg head (`head_egg@3`) | title head: Matt Arvon (self-portrait) | Matt Arvon | original, first-party (not CC) |

## Boss art photo sources (`src/sprites/boss/`, LS2-bossart)
The baked boss atlases are painted by `tools/bossart/**` (Python, PIL). Real photographs give the tissue its micro-detail: each
is warped, regraded and high-passed into a painted height field, never pasted whole. Raw files live in `assets-raw/bossart/`
(git-ignored). Found with `tools/openverse.mjs` (CC0, CC BY and public domain only).

| File | Title | Creator | License | Source |
|---|---|---|---|---|
| `angler_43.jpg` | 줄씬벵이, anglerfish, antenarius malabarski, cá lưỡi dong lông, fishing frog, frog fish, harige hengelaar, hispid frogfish, kelalawar, kertatok, krötenfisch, lepu, lepu harimau, shaggy angler, shaggy anglerfish, shaggy fishing frog, sôshi-izariuo | Dan Schofield | CC BY 4.0 | https://www.inaturalist.org/photos/57622222 |
| `angler_45.jpg` | deep-water frogfish, deepwater frogfish, spiny-head anglerfish, 黑紋裸身躄魚, 黑纹裸身躄鱼 | Pauline Walsh Jacobson | CC BY 4.0 | https://www.inaturalist.org/photos/365386261 |
| `angler_48.jpg` | clown anglerfish, kumadori-izariuo, laffe cinq doigts, laffe cochon, largespotted angler, marmoreret tudsefisk, wartskin frogfish, warty anglerfish, warty frogfish, warzen-anglerfisch, 大斑躄魚, 大斑躄鱼, 大点躄鱼, 大點躄魚, 瘤突躄魚, 瘤突躄鱼 | Pauline Walsh Jacobson | CC BY 4.0 | https://www.inaturalist.org/photos/365991140 |
| `angler_49.jpg` | clown anglerfish, kumadori-izariuo, laffe cinq doigts, laffe cochon, largespotted angler, marmoreret tudsefisk, wartskin frogfish, warty anglerfish, warty frogfish, warzen-anglerfisch, 大斑躄魚, 大斑躄鱼, 大点躄鱼, 大點躄魚, 瘤突躄魚, 瘤突躄鱼 | Pauline Walsh Jacobson | CC BY 4.0 | https://www.inaturalist.org/photos/331992566 |
| `carcass_142.jpg` | CARVING THE WHALE. Japanese whalers cutting a finback for meat and other uses | Thoth, God of Knowledge | CC BY 2.0 | https://www.flickr.com/photos/62025628@N00/4176675983 |
| `carcass_180.jpg` | The Butcher Of Meizhou | tarotastic | CC BY 2.0 | https://www.flickr.com/photos/30674396@N00/510687517 |
| `carcass_181.jpg` | the butcher shop | linh.ngan | CC BY 2.0 | https://www.flickr.com/photos/75199686@N00/3061818219 |
| `carcass_183.jpg` | camel butcher | Paul Keller | CC BY 2.0 | https://www.flickr.com/photos/18259771@N00/3167787796 |
| `carcass_286.jpg` | Bison Necropsy | USFWS Mountain Prairie | CC BY 2.0 | https://www.flickr.com/photos/51986662@N05/5789992293 |
| `carcass_287.jpg` | Elk Necropsy | USFWS Mountain Prairie | CC BY 2.0 | https://www.flickr.com/photos/51986662@N05/5790549452 |
| `chain_82.jpg` | Rusty Chains | Dave Hamster | CC BY 2.0 | https://www.flickr.com/photos/14265068@N00/52256349538 |
| `chain_83.jpg` | The old rusty chain | muffinn | CC BY 2.0 | https://www.flickr.com/photos/26445715@N00/52918272967 |
| `chain_84.jpg` | Rusty Chain | Abhinav fr | CC0 1.0 | https://stocksnap.io/photo/rusty-chain-8SXBFNYKZK |
| `chain_85.jpg` | Rusty chain on wooden deck in Loddebo | AnnSophieQ | CC0 1.0 | https://www.flickr.com/photos/141281588@N05/51459378520 |
| `chain_89.jpg` | Rusty iron tends to the sky | Audire Silentium | CC BY 2.0 | https://www.flickr.com/photos/155589534@N03/52410431505 |
| `engr_247.jpg` | View of Viscera Page 82 | perpetualplum | CC BY 2.0 | https://www.flickr.com/photos/14277117@N03/3953862552 |
| `engr_249.jpg` | 33-2 The abdominal viscera seen after removal of the mesentery, as well as the lungs, from the front. | Knowledge Collector | Public Domain Mark 1.0 | https://www.flickr.com/photos/133115863@N08/18693373442 |
| `engr_250.jpg` | 33-1 The abdominal viscera (digestive tract, seen from the front); the thoracic organs seen, in part, between in situ ribs. | Knowledge Collector | Public Domain Mark 1.0 | https://www.flickr.com/photos/133115863@N08/18511949939 |
| `engr_251.jpg` | 35-1 The thoracic and abdominal cavities are opened from the front and important lymph glands and their vessels are shown. Viscera of the left side are removed. | Knowledge Collector | Public Domain Mark 1.0 | https://www.flickr.com/photos/133115863@N08/18698347465 |
| `engr_65.jpg` | Illustration placenta, additional parts shown | not listed (see source) | CC0 1.0 | https://www.rawpixel.com/image/13972876/illustration-placenta-with-additional-parts-shown-underneath |
| `engr_66.jpg` | Several examples diseased placenta, numbered | not listed (see source) | CC0 1.0 | https://www.rawpixel.com/image/13995063/image-paper-cartoon-art |
| `jaw_39.jpg` | Invasive sea lamprey | U.S. Fish and Wildlife Service - Midwest Region | Public Domain Mark 1.0 | https://www.flickr.com/photos/49208525@N08/54644439829 |
| `jaw_40.jpg` | Gymnothorax moringa (spotted moray eel) (Bahamas) 2 | James St. John | CC BY 2.0 | https://www.flickr.com/photos/47445767@N05/51307209980 |
| `jaw_41.jpg` | Gymnothorax moringa (spotted moray eel) (Bahamas) 3 | James St. John | CC BY 2.0 | https://www.flickr.com/photos/47445767@N05/51311384659 |
| `leech_234.jpg` | Leeches Suck (but they are great creatures) | OakleyOriginals | CC BY 2.0 | https://www.flickr.com/photos/47264866@N00/3622999458 |
| `leech_238.jpg` | Malagasy rainforest leech on my skin, Ranomafana National Park, Madagascar | Frank.Vassen | CC BY 2.0 | https://www.flickr.com/photos/42244964@N03/11916858975 |
| `meat_134.jpg` | Tripe | Editor B | CC BY 2.0 | https://www.flickr.com/photos/11018968@N00/2629062392 |
| `meat_146.jpg` | meat done right | In Memoriam: chrisbulle | CC BY 2.0 | https://www.flickr.com/photos/67726656@N00/4657658048 |
| `meat_148.jpg` | Meat | Keith.Lee | CC BY 2.0 | https://www.flickr.com/photos/27413230@N00/5188818942 |
| `mold_219.jpg` | Hemitrichia, Lava Lamp Slime Mold_2014-07-01-12.21.16 ZS PMax | Sam Droege | Public Domain Mark 1.0 | https://www.flickr.com/photos/54563451@N08/14367791348 |
| `mold_222.jpg` | Wolf's Milk Slime | pellaea | CC BY 2.0 | https://www.flickr.com/photos/7147684@N03/1294205045 |
| `mold_224.jpg` | Red Raspberry Slime Mold - Tubifera ferruginosa, Idylwild Wildlife Management Area, Federalsburg, Maryland | Judy Gallagher | CC BY 2.0 | https://www.flickr.com/photos/52450054@N04/48208953781 |
| `mold_225.jpg` | Insect Egg Slime | pellaea | CC BY 2.0 | https://www.flickr.com/photos/7147684@N03/1018817344 |
| `mold_226.jpg` | Slime mould. | Bernard Spragg | CC0 1.0 | https://www.flickr.com/photos/88123769@N02/17025090657 |
| `mold_227.jpg` | Slime Mold | mountainamoeba | CC BY 2.0 | https://www.flickr.com/photos/8289791@N02/4877160857 |
| `mold_228.jpg` | Wolf's milk slime. (Lycogala epidendrum,) | Bernard Spragg | CC0 1.0 | https://www.flickr.com/photos/88123769@N02/32204568210 |
| `mold_231.jpg` | Hot pink slime mold | Benimoto | CC BY 2.0 | https://www.flickr.com/photos/44545509@N00/1485982215 |
| `nail_100.jpg` | untitled | not listed (see source) | CC0 1.0 | https://www.rawpixel.com/image/6045320/free-public-domain-cc0-photo |
| `nail_95.jpg` | Antique Square Nails with Hammer | ShebleyCL | CC BY 2.0 | https://www.flickr.com/photos/25636851@N03/51913861417 |
| `nail_98.jpg` | Rust Never Nails | cogdogblog | CC0 1.0 | https://www.flickr.com/photos/37996646802@N01/54523785423 |
| `nail_99.jpg` | Rusty nails on a shelf | Roy Tanck | CC0 1.0 | https://wordpress.org/photos/photo/1306350e2b/ |
| `octo_303.jpg` | octopus | f10n4 | CC BY 2.0 | https://www.flickr.com/photos/52127651@N00/186861994 |
| `octo_304.jpg` | octopus | mazaletel | CC BY 2.0 | https://www.flickr.com/photos/38928586@N07/5647796879 |
| `octo_305.jpg` | octopus | mazaletel | CC BY 2.0 | https://www.flickr.com/photos/38928586@N07/5647799175 |
| `octo_306.jpg` | octopus | mazaletel | CC BY 2.0 | https://www.flickr.com/photos/38928586@N07/5647800611 |
| `octo_308.jpg` | octopus! | Web-Betty | CC BY 2.0 | https://www.flickr.com/photos/17017714@N04/35718125972 |
| `octo_309.jpg` | Octopuses | michael-day | CC BY 2.0 | https://www.flickr.com/photos/63328822@N00/6969745466 |
| `octo_311.jpg` | Octopus | quinet | CC BY 2.0 | https://www.flickr.com/photos/91994044@N00/6061582220 |
| `octo_313.jpg` | Suckers! | jblyberg | CC BY 2.0 | https://www.flickr.com/photos/36813960@N00/3738440099 |
| `octo_316.jpg` | sucker! | Web-Betty | CC BY 2.0 | https://www.flickr.com/photos/17017714@N04/35718191992 |
| `path_191.jpg` | Mixed Germ Cell Tumor of Testis | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/3260625567 |
| `path_192.jpg` | Proliferating Mucinous Tumor of the Ovary (1) | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/2669292762 |
| `path_193.jpg` | Mixed Germ Cell Tumor of Testis (w/ ruler) | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/3261449706 |
| `path_196.jpg` | Proliferating Mucinous Tumor of the Ovary (8) | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/2669296576 |
| `path_197.jpg` | Proliferating Mucinous Tumor of the Ovary (6) | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/2668475303 |
| `path_198.jpg` | Stomach: Gastrointestinal stromal tumor (2001, gross) | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/5924349274 |
| `path_199.jpg` | Brenner Tumor of Ovary | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/218889488 |
| `path_200.jpg` | Proliferating Mucinous Tumor of the Ovary (3) | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/2668473213 |
| `path_201.jpg` | Proliferating Mucinous Tumor of the Ovary (7) | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/2669291138 |
| `path_202.jpg` | Proliferating Mucinous Tumor of the Ovary (2) | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/2669292092 |
| `path_203.jpg` | Proliferating Mucinous Tumor of the Ovary (5) | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/2668474643 |
| `path_204.jpg` | Uterine Tumor in a 33-Year-Old (2) | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/2145764413 |
| `path_364.jpg` | Leiomyoma | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/119271509 |
| `path_365.jpg` | Seminoma of the Testis | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/267781607 |
| `path_367.jpg` | Cervical Carcinoma with Adnexa | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/218889486 |
| `path_368.jpg` | Gastric Adenocarcinoma | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/138614039 |
| `path_369.jpg` | Seminoma of the Testis (with ruler) | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/267781611 |
| `path_372.jpg` | Mucinous Cystadenoma of Ovary | euthman | CC BY 2.0 | https://www.flickr.com/photos/78147607@N00/218889489 |
| `rust_101.jpg` | Door Nail | themet | CC0 1.0 | https://www.rawpixel.com/image/8301801/door-nail |
| `rust_103.jpg` | Plate and Nail | themet | CC0 1.0 | https://www.rawpixel.com/image/8301577/plate-and-nail |
| `rust_105.jpg` | Rusted Metal Texture | not listed (see source) | CC0 1.0 | https://www.rawpixel.com/image/5966510/rusted-metal-texture |
| `rust_107.jpg` | Rusty Tin Study #1 | Calsidyrose | CC BY 2.0 | https://www.flickr.com/photos/17557997@N02/21691570786 |
| `rust_113.jpg` | Hinge o' Rust | cogdogblog | CC BY 2.0 | https://www.flickr.com/photos/37996646802@N01/16788659529 |
| `rust_331.jpg` | Rust - Rouille | fred_v | CC BY 2.0 | https://www.flickr.com/photos/8514720@N04/36982461846 |
| `rust_334.jpg` | Rust texture | Baron Von Horrible | CC BY 2.0 | https://www.flickr.com/photos/69029705@N07/6277711154 |
| `rust_335.jpg` | Rust | kevin dooley | CC BY 2.0 | https://www.flickr.com/photos/12836528@N00/8687598298 |
| `rust_336.jpg` | Rust texture | Baron Von Horrible | CC BY 2.0 | https://www.flickr.com/photos/69029705@N07/6277710330 |
| `rust_337.jpg` | Rust Knight | enneafive | CC BY 2.0 | https://www.flickr.com/photos/75612671@N03/8483029696 |
| `rust_340.jpg` | Rusted Fence | longhorndave | CC BY 2.0 | https://www.flickr.com/photos/99255685@N00/171769833 |
| `rust_341.jpg` | Rust - Dark 004 | Asbestos Bill | CC BY 2.0 | https://www.flickr.com/photos/9516941@N08/2902675259 |
| `rust_343.jpg` | texture 151 rust | Nasos3 | CC BY 2.0 | https://www.flickr.com/photos/34413757@N02/5260896766 |
| `rust_386.jpg` | Mechanistic Skin Disease | FeatheredTar | CC BY 2.0 | https://www.flickr.com/photos/55915190@N00/2848783965 |
| `rust_88.jpg` | Chain Drive | Me in ME | CC BY 2.0 | https://www.flickr.com/photos/12357841@N02/51497829373 |
| `shell_56.jpg` | Placenticeras placenta (fossil ammonite) (Upper Cretaceous; Black Hills area, South Dakota, USA) | James St. John | CC BY 2.0 | https://www.flickr.com/photos/47445767@N05/53536698868 |
| `shell_57.jpg` | Placenticeras placenta (fossil ammonite) (Upper Cretaceous; western North America) 5 | James St. John | CC BY 2.0 | https://www.flickr.com/photos/47445767@N05/53535569342 |
| `shell_60.jpg` | Placenticeras placenta (fossil ammonite) (Upper Cretaceous; western North America) 1 | James St. John | CC BY 2.0 | https://www.flickr.com/photos/47445767@N05/53536632243 |
| `shell_61.jpg` | Placenticeras placenta (fossil ammonite) (Upper Cretaceous; western North America) 2 | James St. John | CC BY 2.0 | https://www.flickr.com/photos/47445767@N05/53536632808 |
| `squid_317.jpg` | cuttlefish squid | BioDivLibrary | Public Domain Mark 1.0 | https://www.flickr.com/photos/61021753@N02/5883845425 |
| `squid_321.jpg` | Squid! | watchsmart | CC BY 2.0 | https://www.flickr.com/photos/7741046@N06/2874911007 |
| `squid_322.jpg` | squid and shrimps | Michele Milidoni | CC BY 2.0 | https://www.flickr.com/photos/18119763@N07/6590232275 |
| `squid_323.jpg` | vampire squid | snigl3t | CC BY 2.0 | https://www.flickr.com/photos/58598613@N00/2111032672 |
| `maw_open_wide.jpg` | Open wide | U.S. Fish and Wildlife Service - Midwest Region | CC BY 2.0 | https://www.flickr.com/photos/49208525@N08/27969592266 |
| `rawpixel_teeth_6266016.jpg` | Vintage teeth illustration | public domain, via rawpixel | CC0 1.0 | https://www.rawpixel.com/image/6266016/png-vintage-public-domain |
| `tools/bossart/ufo/shaw_arms.png` | Back viewed eight armed cuttlefish (George Shaw) | NYPL, via rawpixel | CC0 1.0 | cut from the plate; see `tools/bossart/ufo/paint.py` |

Changes: cropped, warped, regraded and filtered into original paintings. CC BY licences: https://creativecommons.org/licenses/.

## Fonts
Silkscreen and Grenze Gotisch via @fontsource (SIL Open Font License 1.1).

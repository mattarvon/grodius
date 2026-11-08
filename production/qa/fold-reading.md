# Fold reading for S2-K1 (D30): how to take it

You do this twice:
- **Session 1** on the build that is live today. It must happen **before wave 1 (ls2-w1) is merged to main**, because the merge replaces the live build.
- **Session 2** after wave 1 is live.

Each session is one short run and one long run, both to the end of the Drive. That is about 15-20 minutes of play.

**What the meter shows** (checked in `src/perf.ts`): a small green box in the top-left corner with four lines:
- `FPS 60  slow 3%`
- `step a/b  world a/b`
- `fx a/b  hud a/b`
- `present a/b  ms avg/p95`

Each `a/b` pair is the average and the "bad frame" time (p95) in milliseconds, over roughly the last 4 seconds. `slow` is the share of frames that took longer than 20 ms. The meter shows **no worst-frame (max) number**. You can only get that from `__perf()` with a cable (optional; step 14).

## Steps

1. **Use Chrome on the Fold, not the app.** The APK can't turn the meter on. Unfold the phone and use the inner screen both times. Close other apps and set brightness to about half. Let the phone sit locked for 10 minutes first so it is cool. If it is charging, it should be charging both times, or neither.
2. **Open** `https://mattarvon.github.io/grodius/?perf`. Don't add `&layout=` to the address, because it would override the LAB. If that address doesn't load, open the repo's GitHub Pages link and add `?perf` at the end. Check that the green box appears in the top-left corner.
3. **Write down** the date, the time, and which session this is (1 or 2) in the table below.
4. **Set short:** on the title screen, tap **LAB**, then tap **LAYOUT** until it reads **SHORT**. Leave MIDBOSSES on OFF and CHECKPOINT on QUIT ONLY, then tap **BACK**. The LAB row on the title should now say SHORT.
5. **Start a new run with DESCEND** (not RESUME, because a resumed run flies the layout it was saved on). Play normally. Pick whatever the fork offers, and take the first biome you are given.
6. **How to read a moment:** take a phone screenshot (power + volume down) at each moment below. The meter is part of the screen, so the screenshot captures it, and you can copy the numbers off it later. Don't stop playing to read it. If you die before a moment, write "died" and carry on from the next run.
7. **Moment A, cruise:** about 30 s into Orbit, before "SOMETHING IS COMING". This is the calm baseline.
8. **Moment B, Maw arrival:** about 1 s after the Maw appears. Take a second screenshot about 2 s after you kill it (**moment C**).
9. **Moment D, midboss death:** about 2 s after the first biome midboss dies. This is the gib-heavy frame.
10. **Moment E, busiest stretch:** the moment in the first biome stage when the screen is fullest of enemies and shots.
11. **Moment F, the Drive:** during the Drive's WARNING banner, and again about 1 s after the Drive boss fight starts (**moment G**). You can stop the run there.
12. **Set long:** back on the title, tap **LAB**, then **LAYOUT** until it reads **LONG**, then **BACK**. Wait 5 minutes with the screen off so the phone cools. Then repeat steps 5-11 on long. Long has two midbosses per biome stage; use the first one for moment D.
13. **Fill in the table** from the screenshots. For each moment, copy FPS and slow %. Then add up the five p95 numbers (step + world + fx + hud + present) and write the sum as **work p95**. The sum is a rough upper bound, which is fine because short and long are added up the same way.
14. **Optional, worst frame (needs the USB cable and a PC):**
    - On the Fold, turn on USB debugging (Settings > Developer options).
    - Plug the phone into the PC. In Chrome on the PC, open `chrome://inspect`, find the game tab under the Fold, and click **inspect**. Click **Console**.
    - Right after a moment (within about 2 s), paste this line and press Enter:
      `(()=>{const s=__perf(),f=k=>s[k]?s[k].p95.toFixed(1)+'/'+s[k].max.toFixed(1):'-';return 'frame '+f('frame')+' step '+f('step')+' world '+f('world')+' fx '+f('fx')+' hud '+f('hud')+' present '+f('present')+' slow '+Math.round(s.slow*100)+'%'})()`
    - Write the `frame` max (the second number after `frame`) in the **frame max** column.
    - At the end of the run, also type `__warm().filter(e=>e.warn).length`. It should print `0`.
15. **Session 2:** once you're told wave 1 is live, repeat steps 1-14 at about the same time of day, with the same screen and the same cooling. Use a fresh copy of the table.

## Table (one copy per session)

Session: ___ Date/time: ___________ Phone temp/feel: ___________

| moment | layout | FPS | slow % | work p95 (sum ms) | frame max ms (optional) | notes (visible hitch?) |
|---|---|---|---|---|---|---|
| A cruise | short | | | | | |
| A cruise | long | | | | | |
| B Maw +1 s | short | | | | | |
| B Maw +1 s | long | | | | | |
| C Maw kill +2 s | short | | | | | |
| C Maw kill +2 s | long | | | | | |
| D midboss death +2 s | short | | | | | |
| D midboss death +2 s | long | | | | | |
| E busiest | short | | | | | |
| E busiest | long | | | | | |
| F Drive WARNING | short | | | | | |
| F Drive WARNING | long | | | | | |
| G Drive fight +1 s | short | | | | | |
| G Drive fight +1 s | long | | | | | |

## What closes S2-K1 (D30)

- **The test:** on the **same build**, long is not worse than short at the matching moments. Compare work p95 and slow % row by row, short against long. This test needs session 2 only. Session 1 shows whether wave 1 helped, and it is the baseline if session 2 looks bad.
- **The hitch limit:** if you took worst-frame numbers, no `frame max` at F or G may be over 100 ms. This is row M's cold-hitch limit, carried over from `ls1-k.md`.
- **Two calls for Matt or the technical-director,** both proposals from performance-analyst:
  - **"Not worse" needs a noise margin.** Phone readings move from run to run, so the proposal is that long may read up to about 10% above short before it counts as a regression. That margin is not in D30.
  - **The absolute 16.7 ms target is not part of this test.** It stays with D15/M6.
- **Timing:** take session 2 before the D31 tune lane, which stretches the long stages, lands. If it lands first, long is a different workload and the comparison should be taken again.

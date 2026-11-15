#!/usr/bin/env python3
"""Synthesized sounds for THE KEEPSAKE as a stage boss (design: the keepsake-boss proposal, section 5). All original, no
samples or recordings: the crier, the vinyl, the steel and the music box are built from noise, oscillators and filters.
The music box plays Brahms' Wiegenlied (op. 49 no. 4, 1868: the composition is public domain), synthesized note by note
here from the melody, not from any recording or arrangement.

  uv run --with numpy,scipy,imageio-ffmpeg python tools/gen_keepsake_boss_sfx.py [--measure [--gen]]
    -> src/sfx/kboss_<name>/gen-NN.ogg

Reused from the midboss (tools/gen_keepsake_sfx.py, unchanged): keep_tink (forks landing), keep_throw and keep_whirr
(throws, the boomerang: play them at rate ~.9 for the bigger head), keep_thud / keep_squelch (face x.15 / wound hits:
the ANGLE lesson by ear) and keep_clack (the eyes on every tell).

THE BANKS (for kboss-core to wire). level = the in-game target, LUFS: ffmpeg ebur128 momentary max of the file (padded
with 1 s of silence) plus the gain, the same measure as the midboss's SND table in enemies/mid/keepsake.ts. vol = the
sample() gain that lands it, measured by --measure on this seed (mean over the takes). wet = suggested reverb send.
Timing points ("at .30 s") are in the file, so the sim can call it on the right frame. Every one: spread .02-.06 (the
takes carry their own variation), a bank not decoded yet falls back like the midboss's ks() (sfx.groan for the cries,
sfx.squish for the wet ones, nothing for the rest), and it is audio only: never R().

  bank             n  len        level  vol   wet  what / when
  kboss_wail       3  2.6 s      -18    .44   .45  the boss-scale crier wail (phase 2 wail ring): "ma... maaa" ~5 semitones
                                                   under the midboss's, a sub-octave under it, a reverse-reverb swell sucking
                                                   into the cry, a tin-can bellows rasp. Call it at the ring's tell start: "ma"
                                                   at .30 s, "maaa" at .73 s (44 f, the ring's release). prio: true (a tell)
  kboss_mama       2  1.65 s     -18    .38   .40  the phase-3 "ma-ma" double cry, one syllable per ring, .50 s (30 f) apart.
                                                   Call it at the FIRST ring's release (syllables at .02 and .52 s). Never
                                                   again once the crier is broken. prio: true
  kboss_crack      3  0.7-1.6 s  -22    .60   .30  the vinyl splitting: a creak, the tear at .35 s, a wet give. The takes run
                                                   drier to wetter (hairline, split, split open); the bag rotates them, so any
                                                   one fits any crack step. IT CRACKED: this plus kboss_rocker
  kboss_roll       4  0.45 s     -30    .15   .12  the hollow head rocking onto a tilt extreme (phase 2, every reversal, under
                                                   keep_clack's eyes): a knock, the cavity booming, a small rock-back. Kept
                                                   dull and short: it comes every ~110 f
  kboss_snap       3  0.7 s      -34    .10   .15  a mobile thread snapping and the freed fork shivering: on each fork's DROP
  kboss_chime      4  0.4-0.7 s  -36    .04   .25  a hanging fork rattling on the hoop: each fork's drop TELL (staggered 12 f),
                                                   and 3 staggered as the mobile lowers at IT WOKE UP. Light: 3 at once is fine
  kboss_rocker     2  0.95 s     -26    .17   .25  the sleep-eye rocker falling out at IT CRACKED: the lead weight, the wire's
                                                   boing, the two glass eyes knocking in shrinking bounces. Call it on the drop
  kboss_swing      3  0.5 s      -38    .10   .20  the pendulum's dry wire-pivot creak and the glass tick at the turn (.45 s):
                                                   once per half-swing (every 90 f of the 3 s period). Quiet: it runs all of
                                                   phase 3
  kboss_crierdie   2  1.4 s      -24    .15   .30  the crier broken (IT STOPPED CRYING): a strangled squeak choked off at
                                                   ~.33 s, the tin crunching, the air wheezing out. prio: true
  kboss_wake       2  1.8 s      -22    .23   .30  IT WOKE UP: the eyes slam open (a heavy double clack), the head lurches (a
                                                   low boom), the vinyl groans, the crier draws a breath and hums at 1.0 s.
                                                   prio: true
  kboss_enrage     2  2.4 s      -20    .25   .35  IT WON'T LET GO (the one capped enrage): the crier's spring ratcheted tight
                                                   (0-.85 s), then a strained, grinding cry that chokes off at 2.2 s. prio: true
  kboss_shut       3  0.27 s     -30    .22   .10  the death's slow eye clack shut: a slow roll, a heavy damped clack at .14 s,
                                                   the lids' flop. The three beats: rate 1, .9, .8, ~40 f apart, the last final
  kboss_topple     2  1.6 s      -24    .25   .25  the head tipping onto its side: a lean creak, the big hollow thud at .38 s, a
                                                   bounce, a wet settle, one last rattle of the eyes. prio: true
  kboss_die        1  3.2 s      -20    .29   .45  the crier's last "ma-", sagging down an octave, wobbling, running out of
                                                   air (after the clacks, before the gore burst). prio: true
  kboss_musicbox   2  4.8 s      -19    .19   .40  THE STING, for WARNING // THE KEEPSAKE: the key wound (krrk krrk), then a
                                                   broken music box playing the Wiegenlied's opening, out-of-tune tines, a bent
                                                   one, a snapped one that only buzzes, the spring dragging the tempo, tape
                                                   wow, stopping unresolved on the A. Call it with sfx.dread() (or in place of
                                                   its string stinger, which plays at .7 = -19 too): prio: true, spread 0, and
                                                   duckMusic(4.5) so the track drops under it; the boss's first attack crushes
                                                   it as the music comes back up
  kboss_musicend   1  7.6 s      -21    .15   .45  the death's box running down: the next phrase, slower and slower, the last
                                                   note's pin missing (a click, no note, ~6.7 s) and the spring's clunk. At PUT
                                                   TO BED: prio: true, duckMusic(7); it sits under the readout and SLAB
  kboss_mobilebox  1  9.6 s      -36    .03   .55  the same box faint and far, in the world while the fork mobile hangs (phases
                                                   2-3): call it every 540 f (9 s) while the mobile has forks; stop when gone

Pillar 5: the box is broken, never sweet; the crier is a toy part, never a child. Audio only: nothing here draws R().
Every file is peak-normalized by gen_sfx.write_ogg; its level in the mix is set where it plays (the vol column).
Seeded (2049): the same run writes the same files. --measure prints each bank's momentary max and the vol for its target.
"""
import os, re, subprocess, sys
import numpy as np
from scipy import signal
sys.path.insert(0, os.path.dirname(__file__))
import gen_sfx as G
import gen_keepsake_sfx as K  # its building blocks (modes, click, formant); importing it writes nothing
from gen_sfx import SR, t_, env, bp, lp, hp, place, sat, bubble, thump, squelch, crackle

FF = K.FF
rng = np.random.default_rng(2049)
G.rng = rng; K.rng = rng  # one stream for every shared block, so the run is reproducible
modes, click, formant = K.modes, K.click, K.formant


# ---------------- shared pieces ----------------
def stickslip(d, r0, r1, lo, hi, peaks=(), jit=.25):
    """a creak: stick-slip, a train of tiny impulses whose rate sweeps r0 -> r1 Hz (jittered), through a band and a few
    resonances (the vinyl or the wire singing). Returns d seconds, no envelope"""
    n = int(SR * d); x = np.zeros(n); tt = 0.0
    imp = np.exp(-np.arange(int(SR * .002)) / (SR * .0004))
    while tt < d:
        u = tt / d; r = r0 + (r1 - r0) * u
        i = int(tt * SR); m = min(len(imp), n - i)
        x[i:i + m] += imp[:m] * rng.uniform(.4, 1.0) * (1 if rng.random() > .08 else 2.2)
        tt += (1 / r) * (1 + rng.uniform(-jit, jit))
    y = bp(x, lo, hi)
    for f, q, g in peaks:
        b, a = signal.iirpeak(f, q, fs=SR); y += signal.lfilter(b, a, x) * g
    return y


def cavity(f0, d, amp=1.0, drop=.1, long=1.0):
    """the hollow vinyl head booming: low modes with the pitch bent down by the flex"""
    return modes(f0, [1, 1.52, 2.08, 2.9], [.12 * long, .08 * long, .05 * long, .03 * long], [.8, .45, .25, .1], d, f_drop=drop) * amp


def glass(f0, amp=1.0, d=.08):
    """a glass eye knocking: a hard click and a bright, short inharmonic ring"""
    x = modes(f0, [1, 1.47, 2.9], [.03, .02, .01], [1, .5, .25], d)
    place(x, click(.002, 3000, 10000) * 1.2, 0)
    return x * amp


def syl_curves(n, t, syls):
    """f, amp and vowel-opening curves for crier syllables: (start, length, level, base Hz, sag, rise)"""
    f = np.full(n, float(syls[0][3])); vow = np.zeros(n); amp = np.zeros(n)
    for s0, L, lv, base, sag, rise in syls:
        i0, i1 = int(s0 * SR), int(min(n / SR, s0 + L) * SR); u = (t[i0:i1] - s0) / L
        f[i0:i1] = base * (1 + rise * np.sin(np.pi * np.minimum(1, u * 2.5))) * (1 - sag * u ** 1.4)
        vow[i0:i1] = np.clip(u / .18, 0, 1)
        amp[i0:i1] = lv * np.minimum(1, u / .06) * np.clip((1 - u) / .25, 0, 1) * (1 - .25 * u)
    return f, lp(amp, 40), vow


def crier(f, amp, vow, warp=1.0, twin=.971, under=.5, air=.12, rasp=0.0, drive=2.0, lpf=3600):
    """the doll's tilt crier as a voice: a buzzy free reed, a quarter-tone-flat twin, an octave under it, three moving
    formants (m -> a), the bellows' air and (rasp) a tin can rattling round it. The midboss wail's voice, opened up"""
    n = len(f); t = np.arange(n) / SR
    w = 1 + warp * (.035 * np.sin(2 * np.pi * 5.3 * t) + .02 * np.sin(2 * np.pi * .9 * t + 1) + .12 * lp(rng.standard_normal(n), 6))
    f = lp(f, 25) * w
    ph = 2 * np.pi * np.cumsum(f) / SR
    reed = signal.sawtooth(ph, .12) + .6 * signal.square(ph, .3)
    tw = signal.sawtooth(2 * np.pi * np.cumsum(f * twin) / SR, .12)
    sub = np.sin(ph * .5) + .35 * signal.sawtooth(ph * .5, .5)
    src = (reed + .55 * tw + under * sub) * amp
    F1 = 260 + 560 * vow; F2 = 1100 + 250 * vow; F3 = np.full(n, 2450.0)
    v = formant(src, [(F1, 4.0, 1.0), (F2, 6.0, .55), (F3, 8.0, .25)])
    v += lp(src, 320) * .35 * (1 - vow)
    v += bp(rng.standard_normal(n), 1200, 4500) * amp * air
    if rasp:  # the tin-can bellows: air chopped by the reed, ringing a thin metal cylinder
        chop = bp(rng.standard_normal(n), 700, 3200) * (.5 + .5 * signal.square(ph, .25)) * amp
        tin = modes(1130 * rng.uniform(.9, 1.1), [1, 1.58, 2.31, 3.47], [.012, .009, .007, .005], [1, .7, .5, .3], .05)
        tin /= np.sqrt(np.sum(tin ** 2))  # unit energy: the can colours the rasp, it must not ring on as a drone
        v += signal.fftconvolve(chop, tin)[:n] * rasp * .5
    return hp(lp(sat(v, drive), lpf), 70)  # the reed and its twin beat into sub rumble through the drive: cut it


def ir_(d, tau, f=None):
    """a noise reverb tail of d seconds decaying with time constant tau, at unit energy (so `mix` is a real wet level)"""
    ir = rng.standard_normal(int(SR * d)) * np.exp(-np.arange(int(SR * d)) / (SR * tau))
    if f: ir = lp(ir, f)
    return ir / np.sqrt(np.sum(ir ** 2))


def room(x, d=.18, tau=.04, mix=.3, f=1800):
    """a short dark room so it isn't a clean synth in a void (the game's reverb adds the hall)"""
    return x + lp(signal.fftconvolve(x, ir_(d, tau))[:len(x)], f) * mix


def gargle(buf, a, b, lo=160, hi=420):
    tt = a
    while tt < b:
        place(buf, bubble(rng.uniform(lo, hi), rng.uniform(.04, .09), rng.uniform(2, 5), rng.uniform(.1, .25)), tt)
        tt += rng.uniform(.05, .14)


# ---------------- the crier ----------------
def wail(i):
    """the boss-scale wail: the midboss's "ma... maaa" about 5 semitones down, a sub-octave under it, a reverse-reverb
    swell sucking into the cry and the tin-can bellows rasping. "ma" at .30 s, "maaa" at .73 s (the ring's release)"""
    d = 2.7; n = int(SR * d); t = t_(d)
    k = rng.uniform(.96, 1.04)
    f, amp, vow = syl_curves(n, t, [(.30, .38, 1.0, 252 * k, .14, .08), (.73, 1.75, 1.15, 266 * k, .45, .08)])
    v = crier(f, amp, vow, under=.9, rasp=.3, air=.14, drive=2.2, lpf=3300)
    # reverse reverb into the first syllable: reverse, smear, reverse back, keep only what comes before the onset
    sw = signal.fftconvolve(v[::-1], ir_(.5, .16))[:n][::-1]
    sw *= (t < .31) * np.clip(t / .3, 0, 1) ** 2
    buf = np.zeros(n + SR // 3)
    place(buf, v + lp(sw, 2200) * 1.4, 0)
    gargle(buf, .95, 2.3, 120, 320)
    place(buf, click(.006, 500, 2500) * 2, .28)  # the weight dropping inside
    place(buf, thump(120, 45, .15, .6), .28)
    return room(buf, mix=.3)


def mama(i):
    """the phase-3 double cry: "ma" then "MA", one per ring, .5 s (30 f) apart; the second harder and longer"""
    d = 1.6; n = int(SR * d); t = t_(d)
    k = rng.uniform(.96, 1.04)
    f, amp, vow = syl_curves(n, t, [(.02, .42, 1.0, 250 * k, .15, .06), (.52, .95, 1.15, 272 * k, .38, .1)])
    v = crier(f, amp, vow, under=.9, rasp=.35, air=.14, drive=2.4, lpf=3300)
    buf = np.zeros(n + SR // 4)
    place(buf, v, 0)
    gargle(buf, .6, 1.4, 120, 300)
    return room(buf, mix=.3)


def crierdie(i):
    """the crier broken: a strangled squeak shooting up and choked off, the tin crunching, the air leaking out"""
    d = 1.4; n = int(SR * d); t = t_(d)
    f = 300 * (1 + 2.4 * np.clip(t / .26, 0, 1) ** 1.6) * (1 + .12 * lp(rng.standard_normal(n), 30) * 6)
    cut = rng.uniform(.3, .36)
    amp = np.clip(t / .03, 0, 1) * (t < cut) * 1.0
    vow = np.clip(.9 - t * 1.5, .2, 1)
    v = crier(f, lp(amp, 120), vow, warp=2.0, twin=.95, under=.2, air=.25, rasp=.5, drive=3.0, lpf=4200)
    buf = np.zeros(n)
    place(buf, v, 0)
    place(buf, click(.004, 1200, 6000) * 2, cut)  # the reed giving
    place(buf, crackle(.12, 40, 1200) * 1.2, cut)  # the tin crunching
    place(buf, modes(1300, [1, 1.7, 2.6, 3.9], [.04, .03, .02, .015], [1, .6, .4, .2], .2) * .6, cut)
    place(buf, thump(200, 90, .08, .5), cut)
    L = d - cut; tl = t_(L)
    leak = bp(rng.standard_normal(len(tl)), 1500, 5000) * np.exp(-tl / .45) * (.6 + .4 * np.sin(2 * np.pi * rng.uniform(4, 7) * tl)) * .45
    whine = np.sin(2 * np.pi * np.cumsum(880 * (1 - .35 * tl / L) * (1 + .02 * np.sin(2 * np.pi * 9 * tl))) / SR) * np.exp(-tl / .3) * .08
    place(buf, leak + whine, cut + .01)
    return room(lp(sat(buf, 1.4), 7000), mix=.25)


def die(i):
    """the last "ma-": one long cry sagging down an octave, the warp slowing and widening, wobbling, running out of air
    into a breathy hiss"""
    d = 3.2; n = int(SR * d); t = t_(d)
    s0, L = .05, 2.9; u = np.clip((t - s0) / L, 0, 1)
    f = 268 * (1 + .06 * np.sin(np.pi * np.minimum(1, u * 3))) * (1 - .5 * u ** 1.2)
    vow = np.clip((t - s0) / .2, 0, 1) * (1 - .6 * u ** 2)
    amp = (t > s0) * np.minimum(1, (t - s0) / .06) * (1 - u) ** .7 * (1 - .65 * u ** 1.5 * (.5 + .5 * np.sin(2 * np.pi * (6 - 3.5 * u) * t)))
    v = crier(f, lp(amp, 40), vow, warp=1.8, under=.8, air=.1, rasp=.25, drive=2.0, lpf=3000)
    hiss = bp(rng.standard_normal(n), 900, 4000) * np.clip((u - .4) / .4, 0, 1) * (1 - u) ** .5 * .12
    buf = np.zeros(n + SR // 3)
    place(buf, v + hiss, 0)
    gargle(buf, .4, 1.6, 100, 260)
    return room(buf, d=.3, tau=.07, mix=.35)


def enrage(i):
    """IT WON'T LET GO: the crier's spring ratcheted tight (clicks speeding up, the spring straining), then a strained,
    grinding cry, higher than the wail, that chokes off"""
    d = 2.4; n = int(SR * d); t = t_(d)
    buf = np.zeros(n)
    tt, gap = .0, .09
    while tt < .82:
        place(buf, click(.003, 1500, 6000) * .7, tt)
        place(buf, modes(1800 * rng.uniform(.97, 1.03), [1, 2.3], [.01, .005], [.6, .2], .03), tt)
        place(buf, thump(600, 380, .02, .25), tt)
        tt += gap; gap = max(.026, gap * .9)
    tw = t_(.85); strain = signal.sawtooth(2 * np.pi * np.cumsum(180 + 420 * (tw / .85) ** 2) / SR, .3)
    place(buf, lp(strain, 1400) * np.clip(tw / .85, 0, 1) ** 2 * .12, 0)
    k = rng.uniform(.97, 1.03)
    f, amp, vow = syl_curves(n, t, [(.85, 1.45, 1.25, 330 * k, .22, .14)])
    grind = 1 - .35 * (.5 + .5 * signal.square(2 * np.pi * 31 * t, .4))
    v = crier(f, amp * grind, vow, warp=1.4, twin=.94, under=1.0, air=.16, rasp=.5, drive=3.4, lpf=3600)
    cut = int(SR * 2.2); v[cut:] *= np.exp(-np.arange(n - cut) / (SR * .012))
    place(buf, v, 0)
    place(buf, click(.005, 800, 4000) * 1.5, 2.2)  # it chokes
    return room(buf, mix=.3)


# ---------------- the head ----------------
def roll(i):
    """the hollow vinyl head rocking onto a tilt extreme: a low knock, the cavity booming, the vinyl's slap and a little
    floor grit, then a smaller rock-back knock. Dull and short: it comes every reversal"""
    d = .5; buf = np.zeros(int(SR * d))
    place(buf, thump(rng.uniform(150, 190), rng.uniform(50, 60), .2, .55), 0)
    place(buf, cavity(rng.uniform(160, 200), .4, .5), 0)
    place(buf, cavity(rng.uniform(260, 320), .3, 1.1, drop=.06, long=.7), 0)  # the knock a phone speaker can carry
    place(buf, bp(click(.008, 200, 3000), 400, 1600) * 1.4, 0)
    place(buf, lp(crackle(.06, 10, 400), 2500) * .3, .004)
    rb = rng.uniform(.09, .14)
    place(buf, thump(rng.uniform(140, 170), 55, .12, .35) + cavity(rng.uniform(250, 300), .12, .35), rb)
    return lp(sat(buf, 1.5), 2600)


def wake(i):
    """IT WOKE UP: the sleep eyes slam open (a heavy double clack), the head lurches (a low boom and the cavity), the vinyl
    groans, the crier draws a breath and hums, low and closed-mouthed"""
    d = 1.8; n = int(SR * d); buf = np.zeros(n)
    for k, at in enumerate([.02, .02 + rng.uniform(.008, .016)]):
        a = 1 if k == 0 else .75
        place(buf, click(.004, 1200, 5000) * 1.6 * a, at)
        place(buf, modes(rng.uniform(900, 1100), [1, 2.3, 3.4], [.02, .01, .006], [.7, .3, .1], .06) * a, at)
        place(buf, thump(rng.uniform(400, 460), 260, .04, .6 * a), at)
    place(buf, thump(rng.uniform(85, 100), 40, .35, .7), .03)
    place(buf, cavity(rng.uniform(200, 240), .6, .9, long=1.4), .03)
    gl = .8; tg = t_(gl)
    place(buf, stickslip(gl, 25, 60, 150, 900, [(380, 6, .3), (640, 8, .2)]) * np.sin(np.pi * tg / gl) ** 1.5 * .5, .1)
    bl = .55; tb = t_(bl)
    place(buf, bp(rng.standard_normal(len(tb)), 600, 3000) * (tb / bl) ** 2 * .22, .45)  # the intake, rising
    hl = .62; nh = int(SR * hl); th = t_(hl)
    f, amp, vow = syl_curves(nh, th, [(.0, .6, .8, 178 * rng.uniform(.97, 1.03), .1, .03)])
    place(buf, crier(f, amp, vow * .15, under=.9, air=.05, drive=1.8, lpf=1800), 1.0)  # "mm", mouth shut
    return room(lp(sat(buf, 1.4), 5000), mix=.25)


def crack(i):
    """the vinyl splitting: a creak building, a tear (dense crackle and a low rip) at .35 s, a wet give. gen-01 hairline
    (dry, short), gen-02 split, gen-03 split open (the wettest, the longest)"""
    s = min(i, 2); d = [.9, 1.3, 1.6][s]; n = int(SR * d); buf = np.zeros(n)
    cl = .36; tc = t_(cl)
    place(buf, stickslip(cl, 40, 140 + 40 * s, 300, 1500, [(520, 6, .4), (930, 8, .3)]) * (tc / cl) ** 1.5 * .7, 0)
    t0 = .35
    place(buf, crackle(.18 + .06 * s, 50 + 15 * s, 1500) * 1.3, t0)
    rl = .14 + .05 * s
    place(buf, lp(rng.standard_normal(int(SR * rl)), 600) * env(int(SR * rl), .003, .05 + .03 * s) * .9, t0)
    place(buf, click(.004, 900, 6000) * 2.2, t0)
    if s >= 1:
        place(buf, squelch(.3 + .12 * s, 1600, 200, 26) * .55 * s, t0 + .07)
        place(buf, thump(110, 40, .25, .5 + .2 * s), t0 + .07)
        G.drips(buf, t0 + .15, 3 + 3 * s, .5 + .2 * s)
    if s == 2:
        place(buf, squelch(.45, 900, 140, 18) * .6, t0 + .3)  # the meat sagging into the split
    return room(lp(sat(buf, 1.7), 6000), mix=.22)


def shut(i):
    """the death's eye clack shut, heavy and slow: the eyes roll down slowly, clack hard and damped against the stops a
    hair apart, the lids flop. Played three times, slower each time"""
    d = .45; buf = np.zeros(int(SR * d))
    rl = .14; nr = int(SR * rl)
    place(buf, lp(rng.standard_normal(nr), 1500) * np.sin(np.pi * np.arange(nr) / nr) ** 2 * .22, 0)
    for k, at in enumerate([.14, .14 + rng.uniform(.015, .03)]):
        a = 1 if k == 0 else rng.uniform(.6, .75)
        place(buf, click(.004, 900, 4500) * 1.2 * a, at)
        place(buf, modes(rng.uniform(700, 900), [1, 2.3, 3.4], [.03, .015, .008], [.7, .3, .1], .08) * a, at)
        place(buf, thump(rng.uniform(310, 350), 210, .06, .7 * a), at)
    place(buf, lp(thump(160, 70, .1, .4), 800), .16)
    return lp(sat(buf, 1.5), 6000)


def topple(i):
    """the head tipping onto its side: a lean creak slowing, a big hollow thud at .38 s, a bounce or two, a wet settle,
    one last tiny rattle of the eyes"""
    d = 1.6; n = int(SR * d); buf = np.zeros(n)
    cl = .36; tc = t_(cl)
    place(buf, stickslip(cl, 32, 14, 200, 1200, [(420, 6, .3)]) * (tc / cl) ** 1.2 * .45, 0)
    T = .38
    place(buf, thump(rng.uniform(100, 120), 32, .4, 1.2), T)
    place(buf, cavity(rng.uniform(110, 140), 1.0, 1.0, long=2.0), T)
    place(buf, cavity(rng.uniform(260, 320), .5, 1.3, drop=.08), T)  # the hollow knock in the phone's band
    place(buf, bp(click(.01, 200, 3000), 350, 2000) * 1.8, T)
    place(buf, lp(crackle(.08, 14, 300), 2000) * .4, T + .005)
    for k, (dt, a) in enumerate([(rng.uniform(.14, .18), .4), (rng.uniform(.25, .3), .15)]):
        place(buf, thump(130, 45, .2, a) + cavity(150, .2, a * .6), T + dt)
    place(buf, squelch(.4, 900, 150, 18) * .5, T + .12)
    G.drips(buf, T + .2, 3, .5)
    place(buf, glass(rng.uniform(1800, 2200), .18), T + .55)  # the eyes settling behind the shut lids
    return room(lp(sat(buf, 1.6), 4000), d=.25, tau=.06, mix=.25)


# ---------------- the mobile and the mechanism ----------------
def snap(i):
    """a mobile thread snapping: a tiny bright snap, the thread's twang, the freed fork shivering as it falls"""
    d = .7; n = int(SR * d); t = t_(d); buf = np.zeros(n)
    place(buf, hp(rng.standard_normal(int(SR * .006)), 2500) * env(int(SR * .006), .0005, .002, 3) * 1.6, 0)
    place(buf, click(.003, 3000, 9000) * 1.2, 0)
    tl = .1; tt = t_(tl); f0 = rng.uniform(500, 800)
    tw = signal.sawtooth(2 * np.pi * np.cumsum(f0 * (.7 + .3 * np.exp(-tt / .04))) / SR) * np.exp(-tt / .05)
    place(buf, lp(tw, 3000) * .3, .002)
    sv = modes(rng.uniform(1100, 1500), [1, 2.76, 5.4], [.25, .12, .06], [1, .4, .15], .65)
    sv *= (1 + .5 * np.sin(2 * np.pi * rng.uniform(14, 20) * t[:len(sv)])) * .35
    place(buf, sv, .005)
    for k in range(rng.integers(1, 3)):
        place(buf, click(.002, 2500, 8000) * .4, rng.uniform(.02, .06))
    return lp(sat(buf, 1.3), 8000)


def chime(i):
    """a hanging fork rattling against the hoop and its neighbour: a few small steel tinks, a lower tick of the wire
    hoop, a faint shiver. Much lighter than keep_tink: several can run at once"""
    d = .8; buf = np.zeros(int(SR * d))
    tt, a = 0.0, 1.0
    for k in range(rng.integers(3, 7)):
        f = rng.uniform(1600, 2600)
        place(buf, modes(f, [1, 2.76], [.06 * a + .02, .03], [1, .3], .15) * a, tt)
        place(buf, click(.002, 2500, 8000) * .5 * a, tt)
        tt += rng.uniform(.05, .16); a *= rng.uniform(.6, .85)
    place(buf, modes(rng.uniform(700, 900), [1, 2.4], [.1, .05], [1, .3], .25) * .35, rng.uniform(0, .06))  # the hoop
    return lp(sat(buf, 1.2), 7000)


def rocker(i):
    """the sleep-eye rocker falling out: the lead weight's dull thunk, the bent wire's boing, the two glass eyes knocking
    together in shrinking bounces as it settles on its wire, a little rolling between"""
    d = 1.5; n = int(SR * d); t = t_(d); buf = np.zeros(n)
    place(buf, thump(130, 50, .18, 1.0), 0)
    place(buf, modes(420, [1, 1.9], [.03, .02], [1, .4], .1) * .35, 0)
    place(buf, lp(click(.006, 200, 1500), 1500), 0)
    bl = .9; tb = t_(bl); fb = rng.uniform(240, 300)
    boing = np.sin(2 * np.pi * np.cumsum(fb * (1 + .25 * np.sin(2 * np.pi * 7 * tb) * np.exp(-tb / .15))) / SR)
    boing = (boing + .3 * np.sin(2 * np.pi * np.cumsum(fb * 2.7 * np.ones(len(tb))) / SR) * np.exp(-tb / .1)) * np.exp(-tb / .35) * .35
    place(buf, boing, .01)
    tt, gap, a = .06, .16, .8
    for k in range(7):
        f = rng.uniform(2600, 3400)
        place(buf, glass(f, a), tt)
        place(buf, glass(f * rng.uniform(1.04, 1.1), a * .7), tt + rng.uniform(.006, .012))  # the other eye
        tt += gap; gap *= .75; a *= .7
    rl = .55; nr = int(SR * rl)
    place(buf, lp(rng.standard_normal(nr), 2000) * np.sin(np.pi * np.arange(nr) / nr) * .06, .05)
    return lp(sat(buf, 1.3), 9000)


def swing(i):
    """the pendulum's half-swing: a dry creak at the wire's pivot, rising and falling with the speed, then the glass eyes
    ticking softly at the turn (.45 s). Quiet and dry: it runs the whole of phase 3"""
    d = .8; buf = np.zeros(int(SR * d))
    cl = .45; tc = t_(cl)
    cr = stickslip(cl, rng.uniform(70, 90), rng.uniform(100, 120), 800, 2600, [(rng.uniform(1200, 1800), 8, .5)], jit=.35)
    place(buf, cr * np.sin(np.pi * tc / cl) ** 1.5 * .6, 0)
    place(buf, glass(rng.uniform(2800, 3300), .3, .05), .45)
    place(buf, thump(500, 340, .02, .15), .45)
    return lp(sat(buf, 1.2), 6000)


# ---------------- the music box (Brahms, Wiegenlied op. 49 no. 4, 1868: public domain) ----------------
# the melody, C major, 3/4: (note, beats). Transcribed from the tune itself
WIEGENLIED = [('E5', .5), ('E5', .5), ('G5', 1.5), ('E5', .5), ('E5', 1), ('G5', 2), ('E5', .5), ('G5', .5),
              ('C6', 1), ('B5', 1.5), ('A5', .5), ('A5', 1), ('G5', 1), ('D5', .5), ('E5', .5),
              ('F5', 1), ('D5', 1), ('D5', .5), ('E5', .5), ('F5', 2), ('D5', .5), ('F5', .5),
              ('B5', .5), ('A5', .5), ('G5', 1), ('B5', 1), ('C6', 3)]
BASS = {0: 'C4', 1: 'C4', 2: 'F4', 3: 'G3', 4: 'G3', 5: 'G3', 6: 'G3', 7: 'C4'}  # a low tine on each downbeat
SEMI = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
# the comb sounds an octave above the written tune (E6-C7, the bass tines G4-F5): a music box's register, and the band a
# phone speaker carries best
def hz(nm): return 880 * 2 ** ((SEMI[nm[0]] + 12 * (int(nm[1]) + 1) - 69) / 12)
# the comb's damage, fixed per tine (the same tine sounds the same wrong every time): a few cents off everywhere, G5
# bent badly flat, D5's and B5's tines snapped off (their dampers only buzz)
BENT, DEAD = {'G5': -70}, {'D5', 'B5'}
TUNE = {nm: rng.uniform(-18, 18) for nm in sorted({n for n, _ in WIEGENLIED} | set(BASS.values()))}


def tine(f, amp=1.0, d=None):
    """one comb tine plucked by a pin: a sine with its octave and the beam's 6.27 partial, a tiny bend as it's released,
    a pin click; low tines ring longer"""
    tau = float(np.clip(.9 * (600 / f) ** .6, .25, 1.6)); d = d or tau * 4; t = t_(d)
    ff = f * (1 + .004 * np.exp(-t * 60))
    ph = 2 * np.pi * np.cumsum(ff) / SR
    x = np.sin(ph) * np.exp(-t / tau) + .22 * np.sin(2 * ph) * np.exp(-t / (tau * .4)) + .1 * np.sin(6.27 * ph) * np.exp(-t / (tau * .12))
    x *= np.minimum(1, t / .0015)
    x[:int(SR * .004)] += hp(rng.standard_normal(int(SR * .004)), 3000) * env(int(SR * .004), .0003, .0012, 3) * .25
    return x * amp


def dead_tine(f, amp=1.0):
    """the snapped tine: the pin's click, the damper buzzing on the stub, a dull short ghost of the note"""
    d = .14; t = t_(d)
    bz = bp(rng.standard_normal(len(t)), 1500, 4000) * (.5 + .5 * signal.square(2 * np.pi * 90 * t)) * np.exp(-t / .03) * .35
    gh = np.sin(2 * np.pi * f * .5 * t) * np.exp(-t / .03) * .25
    pin = np.zeros(len(t)); place(pin, click(.003, 2000, 8000) * .6, 0)
    return (bz + gh + pin) * amp


def wind(buf, at, k=4):
    """the winding key: krrk krrk, a ratchet pawl clicking over the spring"""
    for j in range(k):
        for c in range(5):
            place(buf, lp(click(.002, 900, 4000), 4500) * .22 * (1 - .12 * c), at + j * .085 + c * .012)
        place(buf, thump(700, 500, .02, .12), at + j * .085)


def tape(x, wow=.012, flutter=.002, seed_ph=0.0):
    """heard off an old tape: the playback speed wanders (a slow wow, a fast flutter, a drift), resampled"""
    n = len(x); t = np.arange(n) / SR
    r = 1 + wow * np.sin(2 * np.pi * .55 * t + seed_ph) + flutter * np.sin(2 * np.pi * 7.1 * t) + .006 * lp(rng.standard_normal(n), 2) * 30
    pos = np.cumsum(r) - r[0]
    pos = pos[pos < n - 1]
    return np.interp(pos, np.arange(n), x)


def music_box(seq, beat, drag, d, lead=0.0, bass=True, stop=None, gov=1.0, far=False, first=1.0, bar0=0):
    """play (note, beats) through the broken box. beat: seconds per beat at the start; drag(u) stretches each beat as the
    spring runs down (u = 0..1 over the phrase); stop: 'dead' ends on a missing pin plus the spring's clunk"""
    n = int(SR * d); buf = np.zeros(n)
    tot = sum(b for _, b in seq); tt, acc = lead, 0.0
    onsets = []
    for k, (nm, b) in enumerate(seq):
        onsets.append(tt)
        u = acc / tot
        step = b * beat * drag(u) * (1 + rng.uniform(-.04, .04))
        if rng.random() < .12: step *= 1.35  # the spring catches...
        tt += step; acc += b
    for k, ((nm, b), at) in enumerate(zip(seq, onsets)):
        last = k == len(seq) - 1
        f = hz(nm) * 2 ** ((TUNE[nm] + BENT.get(nm, 0)) / 1200)
        a = rng.uniform(.75, 1.0)
        if last and stop == 'dead':
            place(buf, click(.003, 2000, 8000) * .7, at)  # the pin is gone: nothing sounds
            place(buf, thump(90, 40, .2, .9), at + .35)  # the spring lets go
            place(buf, lp(click(.01, 200, 1500), 1500), at + .35)
            place(buf, crackle(.05, 8, 600) * .4, at + .36)
            continue
        place(buf, dead_tine(f, a) if nm in DEAD else tine(f, a), at)
        if nm in BENT: place(buf, tine(f * 1.012, a * .35), at + .003)  # the bent tine buzzes against its neighbour
        pos = sum(bb for _, bb in seq[:k]) - first  # beats since the first downbeat (the tune opens on a 1-beat pickup)
        if bass and pos >= 0 and abs(pos / 3 - round(pos / 3)) < 1e-6 and int(round(pos / 3)) + bar0 in BASS:
            bn = BASS[int(round(pos / 3)) + bar0]  # a low tine on each bar's downbeat
            place(buf, tine(hz(bn) * 2 ** (TUNE[bn] / 1200), .55), at + .004)
    # the mechanism: the governor's fan whirring at a rate that follows the tempo, the cylinder's gear ticking
    t = t_(d); rate = np.interp(t, onsets + [onsets[-1] + 1], [18 / drag(i / len(onsets)) for i in range(len(onsets))] + [6])
    rate *= (t >= lead) * (t < onsets[-1] + .3)
    fan = bp(rng.standard_normal(n), 300, 1400) * (.4 + .6 * np.abs(np.sin(np.pi * np.cumsum(rate) / SR))) * .05 * gov
    fan *= (t >= lead) * np.clip((onsets[-1] + .3 - t) / .3, 0, 1)
    buf += fan
    for at in onsets[:-1]:
        place(buf, click(.002, 800, 3000) * .06 * gov, at - .01)
    # the box's wooden body, then the tape
    x = buf + signal.fftconvolve(buf, ir_(.12, .025, 2500))[:n] * .25
    x = hp(x, 160)
    x = tape(x, seed_ph=rng.uniform(0, 6))
    if far:
        x = lp(x, 2200)
        x = x * .45 + lp(signal.fftconvolve(x, ir_(.8, .22))[:len(x)], 2000) * .35
    return lp(sat(x * .9, 1.2), 8500)


def musicbox(i):
    """THE STING: the key wound (krrk krrk), then the Wiegenlied's opening through the broken box, the spring dragging
    harder each bar, stopping on "be-dight" (the A5), unresolved. ~4.6 s"""
    seq = WIEGENLIED[:11]
    drag = (lambda u: 1 + .9 * u ** 2.2) if i == 0 else (lambda u: 1 + 1.2 * u ** 1.8)
    d = 4.8; buf = np.zeros(int(SR * d))
    wind(buf, 0, 3 + i)
    lead = .3 + .085 * (3 + i)
    x = music_box(seq, .34, drag, d, lead=lead)
    m = min(len(buf), len(x)); x = x[:m] + buf[:m] * .9
    return x


def musicend(i):
    """the death's box running down: "with lilies o'erspread is baby's wee bed", slower and slower, the last note's pin
    missing (a click, no note), the spring's clunk. ~7 s"""
    seq = WIEGENLIED[11:]
    return music_box(seq, .42, lambda u: 1 + 2.6 * u ** 1.6, 7.6, lead=.05, stop='dead', gov=.8, first=0.0, bar0=3)


def mobilebox(i):
    """the same box far off in the world, while the mobile hangs: the whole tune at a tired, steady tempo, dark and
    distant. Re-triggered every ~9 s"""
    return music_box(WIEGENLIED, .3, lambda u: 1 + .15 * u, 9.6, lead=.05, gov=.5, far=True)


# name: (fn, takes, target LUFS momentary max in game)
CATS = {
    'kboss_wail': (wail, 3, -18), 'kboss_mama': (mama, 2, -18), 'kboss_crack': (crack, 3, -22),
    'kboss_roll': (roll, 4, -30), 'kboss_snap': (snap, 3, -34), 'kboss_chime': (chime, 4, -36),
    'kboss_rocker': (rocker, 2, -26), 'kboss_swing': (swing, 3, -38), 'kboss_crierdie': (crierdie, 2, -24),
    'kboss_wake': (wake, 2, -22), 'kboss_enrage': (enrage, 2, -20), 'kboss_shut': (shut, 3, -30),
    'kboss_topple': (topple, 2, -24), 'kboss_die': (die, 1, -20),
    'kboss_musicbox': (musicbox, 2, -19), 'kboss_musicend': (musicend, 1, -21), 'kboss_mobilebox': (mobilebox, 1, -36),
}


def mmax(path):
    """ffmpeg ebur128: the file's momentary-loudness maximum (LUFS) and its length (s)"""
    # padded with a second of silence: a clip under the 400 ms window still gets a momentary reading
    out = subprocess.run([FF, '-v', 'verbose', '-nostats', '-i', path, '-af', 'apad=pad_dur=1,ebur128=framelog=verbose', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    ms = [float(m) for m in re.findall(r'M:\s*(-?[\d.]+)', out)]
    dur = re.search(r'Duration: (\d+):(\d+):([\d.]+)', out)
    return max(ms), (float(dur[3]) + 60 * float(dur[2]) if dur else 0)


if __name__ == '__main__':
    if '--measure' not in sys.argv[1:] or '--gen' in sys.argv[1:]:
        for cat, (fn, count, _) in CATS.items():
            d = os.path.join(G.OUT, cat); os.makedirs(d, exist_ok=True)
            for f in os.listdir(d):
                if f.startswith('gen-'): os.remove(os.path.join(d, f))
            for i in range(count):
                G.write_ogg(hp(fn(i), 40), os.path.join(d, f'gen-{i + 1:02d}.ogg'))  # nothing a speaker can play lives under 40 Hz
            print(cat, count)
    if '--measure' in sys.argv[1:]:
        for cat, (_, count, tgt) in CATS.items():
            r = [mmax(os.path.join(G.OUT, cat, f'gen-{i + 1:02d}.ogg')) for i in range(count)]
            m = sum(x for x, _ in r) / count
            print(f'{cat:16s} n={count} len={"/".join(f"{l:.2f}" for _, l in r)} Mmax={m:6.1f} target={tgt} vol={10 ** ((tgt - m) / 20):.3f}')

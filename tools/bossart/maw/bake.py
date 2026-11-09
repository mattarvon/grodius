#!/usr/bin/env python3
"""THE MAW / THE DISSOLVED MAW / THE MUCUS MAW, Matt's pick c1 Lamprey Disc, baked for the game.
Run: python3 -I tools/bossart/maw/bake.py [orbit acid snot]   (no args = all three)
Writes src/sprites/boss/maw_<variant>.png + .json, one atlas per variant so a route loads only its own. Lists, origin = the
boss's (0,0): idle<w> (5, gill pores breathing + peristalsis), jaw<w> (5, e.jaw .2..1: disc dilates, teeth erect and flare,
the retch rising in the throat), spew<w> (2, the gush at cycle 100), hurt<w> (1) for wound stage w = 0 whole, 1 the 50% tear,
2 ruined; die (8: disc rips off, the flank splits along the gill pores, gut slides out, collapse); disc (8 turns of the torn
disc for its fall, origin = its centre); eye0..2 (8 gazes + a blink, drawn live at each eyesP point); tooth (4, loose teeth)."""
import os, sys, math, random, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import importlib.util
_sp = importlib.util.spec_from_file_location('bossbake', os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'bake.py'))
_bb = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(_bb)   # the lane's Baker (this file shares its name)
Baker, bend, smooth = _bb.Baker, _bb.bend, _bb.smooth
from common import *
from teeth import teeth

O = (OX, OY)
def peri(im, i, n=5, amp=1.0):
    """peristalsis: a swallowing bulge crawling from the tail toward the disc, the disc itself barely moving"""
    xb = 26 - i * 34 / (n - 1)
    def fn(x, y):
        gx, gy = (x - OX) / K, (y - OY) / K
        b = math.exp(-((gx - xb) / 6.5) ** 2) * smooth(-14, -6, gx)
        return (-b * 1.4 * amp * K * .25, gy * .06 * b * amp * K * .5 + .2 * K * b)
    return bend(im, fn)
def collapse(im, k):
    """the dead weight: it sags and flattens toward its belly, the tail end dropping first"""
    def fn(x, y):
        gx, gy = (x - OX) / K, (y - OY) / K
        return (gx * .04 * k * K * .3, (k * k * 7 + max(0, gy + 24) * .18 * k + max(0, gx) * .12 * k) * K)
    return bend(im, fn)

def small(b, name, im, cx, cy):
    """add a little hero view (an eye, a tooth) to list name with its (cx, cy) as the frame origin; Baker.add wants full canvases"""
    gw, gh = max(1, round(im.width / K)), max(1, round(im.height / K))
    p = im.convert('RGBa').resize((gw, gh), LAN).convert('RGBA'); r, g, bb, a = p.split()
    rgb = Image.merge('RGB', (r, g, bb)).filter(ImageFilter.UnsharpMask(radius=1.0, percent=60, threshold=2))
    rgb.putalpha(a.point(lambda q: 255 if q >= 96 else 0)); box = rgb.getchannel('A').getbbox() or (0, 0, 1, 1)
    sp = rgb.crop(box)
    if name not in b.frames: b.frames[name] = []; b.names.append(name)
    b.frames[name].append((sp, box[0] - round(cx / K), box[1] - round(cy / K)))

EIRIS = dict(orbit=((.55, .30, .03), (.98, .78, .22)), acid=((.48, .50, .48), (.84, .86, .80)), snot=((.50, .38, .08), (.92, .80, .34)))
ESCL = dict(orbit=(.80, .66, .46), acid=(.72, .68, .62), snot=(.74, .66, .44))
LID = dict(orbit=(.09, .012, .016), acid=(.24, .16, .16), snot=(.12, .045, .03))
def eye(v, R, gx, gy, blink):
    """a slit-pupilled eye seated in a swollen socket, the gaze offset by (gx, gy) in -1..1; R in hero px"""
    n = int(R * 3.2) // 2 * 2; s = (n, n); c = n / 2; rng = random.Random(int(R * 10) + 3)
    Xs, Ys = coords(s)
    d = (((Xs - c) ** 2.0 + (Ys - c) ** 2.0) ** .5) * (1 / R)
    ball = ss(1.0, .9, d); sock = ss(1.22, 1.05, d + (fbm(rng, 4, s, 3) - .5) * .3)
    lidr = sock * (1 - ball * (0 if blink else 1)) + sock * ball * (1 if blink else 0)
    sph = mx(1 - d * d, 0) ** .5
    scl = tuple(const(q, s) for q in ESCL[v])
    vn = veinnet(rng, s, ball, n=10, w0=1.2, branch=.1)
    scl = cmix(scl, (const(.55, s), const(.05, s), const(.05, s)), cl(vn * 1.1 + ss(.7, 1, d) * .5))
    ix, iy = c + gx * R * .42, c + gy * R * .34
    di = (((Xs - ix) * (1 / (R * .66))) ** 2.0 + ((Ys - iy) * (1 / (R * .7))) ** 2.0) ** .5
    iris = ss(1.0, .9, di) * ball
    ic = cmix(tuple(const(q, s) for q in EIRIS[v][1]), tuple(const(q, s) for q in EIRIS[v][0]), cl(di * .9 + (fbm(rng, 9, s, 3) - .5) * .5))
    col = cmix(scl, ic, iris)
    if v == 'acid': pu = ss(.32, .22, di) * ball   # cataract: a small dim pupil under a milk film
    else: pu = ss(1.0, .7, (((Xs - ix) * (1 / (R * .12))) ** 2.0 + ((Ys - iy) * (1 / (R * .5))) ** 2.0) ** .5) * ball
    col = cmix(col, (const(.01, s), const(.005, s), const(.003, s)), pu * (.6 if v == 'acid' else 1))
    if v == 'acid': col = cmix(col, (const(.72, s), const(.74, s), const(.70, s)), iris * .45)
    E = wet(col, sph * .6, ball, k=10, sss=.2, spec=.9, shin=60., glint=1.5, film=ball if v == 'snot' else None, rim=.0)
    lc = tuple(const(q, s) for q in LID[v])
    hl = blur(sock, 3) * .6 + (blur(ball, 2) * .5 if blink else 0)
    Lw = wet(lc, hl, lidr, k=14, sss=.7, spec=.3, film=lidr)
    cv = over(fade(shadow(ball, 3, .8, 1, 2), 1), canvas(s))
    cv = over(dict(rgb=(const(.03, s), const(.0, s), const(.0, s)), a=sock * .95), cv)
    cv = over(Lw, cv)
    if not blink: cv = over(E, cv); cv = over(dict(rgb=(const(0, s),) * 3, a=shadow(ball, 2, .55, 0, 3)['a'] * ball * (1 - ss(-.2, .3, (Ys - c) * (1 / R)))), cv)
    return to_pil(cv), c

def tooth_bits():
    """loose teeth for the death spray, cut from the same plate"""
    out = []
    for t in teeth()[:2]:
        L = 26; tw = max(4, int(L / t['ar'])); mk = t['mask'].resize((tw, L), LAN); ik = t['ink'].resize((tw, L), LAN)
        sz = (40, 40); M = Image.new('L', sz, 0); I = Image.new('L', sz, 255); M.paste(mk, (20 - tw // 2, 7)); I.paste(ik, (20 - tw // 2, 7))
        m = T(M.convert('F')) * (1 / 255); ti = T(I.convert('F')) * (1 / 255)
        a = grade((ti, ti, ti), (.16, .10, .04), (.62, .52, .32), (.88, .80, .60), keep=0)
        L_ = wet(a, blur(m, 3) * .5 + (ti - .5) * .05, m, k=10, spec=.7, sss=.1)
        im = to_pil(L_)
        for r in (0, 90): out.append(im.rotate(r, BIC))
    return out

def run(v):
    t0 = time.time()
    b = Baker('maw_' + v, S, GS, O, colors=220)
    for w in range(3):
        for i in range(5): b.add(f'idle{w}', peri(to_pil(body(v, w, pore=i / 4)), i))
        for j in (.2, .4, .6, .8, 1.0): b.add(f'jaw{w}', to_pil(body(v, w, pore=.5, jaw=j)))
        for sp in (.6, 1.0): b.add(f'spew{w}', to_pil(body(v, w, pore=.2, jaw=1, spew=sp)))
        b.add(f'hurt{w}', to_pil(body(v, w, pore=0, hurt=1)))
        print(v, 'stage', w, round(time.time() - t0), 's', flush=True)
    for k in (.06, .16, .26, .4, .55, .7, .85, 1.0):
        b.add('die', collapse(to_pil(body(v, 2, pore=0, jaw=.6 if k < .3 else 0, hurt=1, die=k)), max(0, k - .25) / .75))
    # the disc torn free, turning as it falls: its own frames, centred on the disc
    Ld, md = disc(v, 2, jaw=.6, hurt=1, tearoff=.25); dimg = to_pil(Ld)
    cx, cy = DISC; box = (int(cx - 15 * K), int(cy - 25 * K), int(cx + 15 * K), int(cy + 25 * K)); dc = dimg.crop(box)
    for i in range(8):
        r = dc.rotate(-i * 45 + 10, BIC, expand=True); o = Image.new('RGBA', S, (0, 0, 0, 0))
        o.paste(r, (OX - r.width // 2, OY - r.height // 2), r); b.add('disc', o)
    for si, R in enumerate((1.5, 1.85, 2.2)):   # a little under ep.s: nine eyes must not bury the disc
        for g in range(8):
            a = g / 8 * math.tau; im, c = eye(v, R * K, math.cos(a), math.sin(a), 0); small(b, f'eye{si}', im, c, c)
        im, c = eye(v, R * K, 0, 0, 1); small(b, f'eye{si}', im, c, c)
    for im in tooth_bits(): small(b, 'tooth', im, 20, 20)
    b.save(512)
    print(v, 'done', round(time.time() - t0), 's')

if __name__ == '__main__':
    for v in (sys.argv[1:] or ['orbit', 'acid', 'snot']): run(v)

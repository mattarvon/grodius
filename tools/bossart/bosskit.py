#!/usr/bin/env python3
"""LS2-bossart shared paint kit. PIL only (no numpy); run scripts with python3 -I and sys.path.insert this folder.
The bar is the ROT eye: tissue lit from a height field, photographic micro-detail, an irregular silhouette, no outlines.
Floats go through T (PIL 'F' images) so nothing loops per pixel in Python. Deterministic: pass a random.Random.
All colours are 0..1. A layer is dict(rgb=(r,g,b) premultiplied, a=alpha)."""
import json, math, os, random
from PIL import Image, ImageMath, ImageDraw, ImageChops, ImageFilter, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.environ.get('BOSSART_TEX') or os.path.join(os.path.dirname(os.path.dirname(HERE)), 'assets-raw', 'bossart', 'tex')  # raw photos stay out of the repo: see tools/bossart/README.md
BIC = Image.Resampling.BICUBIC; BOX = Image.Resampling.BOX; LAN = Image.Resampling.LANCZOS; NEAR = Image.Resampling.NEAREST
GAME_BG = (7, 8, 11)

# ---------------------------------------------------------------- float maths
class T:
    __slots__ = ('im',)
    def __init__(s, im): s.im = im
    def _op(s, o, f):
        if isinstance(o, T): return T(ImageMath.lambda_eval(lambda e: f(e['a'], e['b']), a=s.im, b=o.im))
        o = float(o); return T(ImageMath.lambda_eval(lambda e: f(e['a'], o), a=s.im))
    def __add__(s, o): return s._op(o, lambda a, b: a + b)
    __radd__ = __add__
    def __sub__(s, o): return s._op(o, lambda a, b: a - b)
    def __rsub__(s, o): return s._op(o, lambda a, b: b - a)
    def __mul__(s, o): return s._op(o, lambda a, b: a * b)
    __rmul__ = __mul__
    def __truediv__(s, o): return s._op(o, lambda a, b: a / b)
    def __neg__(s): return s * -1.0
    def __pow__(s, p): return s._op(p, lambda a, b: a ** b)
    @property
    def size(s): return s.im.size
def _mm(a, b, op):
    if isinstance(b, T): return T(ImageMath.lambda_eval(lambda e: e[op](e['a'], e['b']), a=a.im, b=b.im))
    b = float(b); return T(ImageMath.lambda_eval(lambda e: e[op](e['a'], b), a=a.im))
def mx(a, b): return _mm(a, b, 'max')
def mn(a, b): return _mm(a, b, 'min')
def cl(a, lo=0.0, hi=1.0): return mn(mx(a, lo), hi)
def ss(e0, e1, x):
    t = cl((x - e0) * (1.0 / (e1 - e0))); return t * t * (3.0 - 2.0 * t)
def mix(a, b, t): return a + (b - a) * t
def const(v, size): return T(Image.new('F', size, float(v)))
def sh(a, dx, dy): return T(ImageChops.offset(a.im, dx, dy))
def blur(a, r):
    if r <= 0: return a
    im = a.im; w, h = im.size
    if r >= 3:
        k = max(2, int(r / 1.6)); im = im.resize((max(1, w // k), max(1, h // k)), BOX).resize((w, h), BIC); r = 1.2
    t = T(im)
    for _ in range(max(1, round(1.5 * r * r))):
        t = (sh(t, 1, 0) + sh(t, -1, 0) + t) * (1 / 3); t = (sh(t, 0, 1) + sh(t, 0, -1) + t) * (1 / 3)
    return t
def grad(h): return (sh(h, -1, 0) - sh(h, 1, 0)) * 0.5, (sh(h, 0, -1) - sh(h, 0, 1)) * 0.5
def nrm(a, b, c):
    l = mx((a * a + b * b + c * c) ** 0.5, 1e-5); return a / l, b / l, c / l
def dot3(n, v): return n[0] * v[0] + n[1] * v[1] + n[2] * v[2]
def cmix(A, B, t): return tuple(mix(a, b, t) for a, b in zip(A, B))
def cmul(A, k): return tuple(a * k for a in A)
def cadd(A, B): return tuple(a + b for a, b in zip(A, B))
def vnoise(rng, cx, cy, size):
    cx = max(1, int(cx)); cy = max(1, int(cy)); g = Image.new('F', (cx + 1, cy + 1))
    g.putdata([rng.random() for _ in range((cx + 1) * (cy + 1))]); return T(g.resize(size, BIC))
def fbm(rng, c, size, octaves=5, gain=0.5, aspect=1.0):
    tot = None; amp = 1.0; norm = 0.0
    for i in range(octaves):
        n = vnoise(rng, min(size[0], c * 2 ** i), min(size[1], max(1, c * aspect * 2 ** i)), size) * amp
        tot = n if tot is None else tot + n; norm += amp; amp *= gain
    return tot * (1.0 / norm)
def ridged(rng, c, size, octaves=4):
    """creases and folds: 1 at the crease, for gut folds, scar lines, cracks"""
    return 1.0 - cl(_abs(fbm(rng, c, size, octaves) - 0.5) * 7.0)
def _abs(a): return T(ImageMath.lambda_eval(lambda e: abs(e['a']), a=a.im))
absT = _abs
def coords(size):
    w, h = size
    X = Image.linear_gradient('L').rotate(90, expand=True)
    # exact float ramps: built from rows, not an 8-bit gradient
    gx = Image.new('F', (w, 1)); gx.putdata([float(x) for x in range(w)]); gx = gx.resize((w, h), NEAR)
    gy = Image.new('F', (1, h)); gy.putdata([float(y) for y in range(h)]); gy = gy.resize((w, h), NEAR)
    return T(gx), T(gy)

# ---------------------------------------------------------------- photographs
def tex_list(prefix=''): return sorted(f for f in os.listdir(TEX) if f.endswith('.jpg') and f.startswith(prefix))
def credit(name):
    """the credit row for a library photo: put every one you use in the concept's sources"""
    c = json.load(open(os.path.join(TEX, 'credits.json')))[name]
    return dict(title=c['title'], creator=c['creator'], licence=c['license'], url=c['page'], file=name)
def photo(name, size, crop=None, rot=0, mirror=False):
    """a library photo as an RGB PIL image cover-fitted to size. crop = fractions (l,t,r,b) of the source"""
    im = Image.open(os.path.join(TEX, name)).convert('RGB')
    if crop: im = im.crop((int(crop[0] * im.width), int(crop[1] * im.height), int(crop[2] * im.width), int(crop[3] * im.height)))
    if rot: im = im.rotate(rot, BIC, expand=False)
    if mirror: im = ImageOps.mirror(im)
    return ImageOps.fit(im, size, BIC)
def warp(im, rng, amp=30, cells=10):
    """domain-warp a PIL image with a jittered mesh, so a photo stops reading as a rectangle of photo"""
    w, h = im.size; cw = w / cells; ch = h / cells
    pt = {(i, j): (i * cw + rng.uniform(-amp, amp), j * ch + rng.uniform(-amp, amp)) for i in range(cells + 1) for j in range(cells + 1)}
    mesh = []
    for i in range(cells):
        for j in range(cells):
            bb = (int(i * cw), int(j * ch), int((i + 1) * cw), int((j + 1) * ch))
            q = pt[i, j] + pt[i, j + 1] + pt[i + 1, j + 1] + pt[i + 1, j]
            mesh.append((bb, q))
    return im.transform(im.size, Image.Transform.MESH, mesh, BIC)
def bulge(im, cx, cy, r, k=0.6, n=24):
    """wrap a photo over a dome: pulls the source toward (cx, cy) so the texture foreshortens at the rim like real skin on a body"""
    w, h = im.size; cw = w / n; ch = h / n
    def src(x, y):
        dx, dy = x - cx, y - cy; d = math.hypot(dx, dy) / r
        if d < 1e-4 or d > 1: return (x, y)
        s = (1 - k) + k * math.asin(d) / (d * math.pi / 2)
        return (cx + dx * s, cy + dy * s)
    mesh = []
    for i in range(n):
        for j in range(n):
            x0, y0, x1, y1 = i * cw, j * ch, (i + 1) * cw, (j + 1) * ch
            mesh.append(((int(x0), int(y0), int(x1), int(y1)), src(x0, y0) + src(x0, y1) + src(x1, y1) + src(x1, y0)))
    return im.transform(im.size, Image.Transform.MESH, mesh, BIC)
def rgbT(im):
    r, g, b = im.convert('RGB').split(); f = lambda c: T(c.convert('F')) * (1 / 255)
    return f(r), f(g), f(b)
def lumaT(im): return T(im.convert('L').convert('F')) * (1 / 255)
def highpass(lum, r=24, gain=2.0): return cl((lum - blur(lum, r)) * gain + 0.5)
def grade(rgb, shadow, mid, hi, contrast=1.15, keep=0.35):
    """regrade a photo into a palette through its luminance, keeping `keep` of the original chroma. Takes a photo's food-photo
    pink or museum orange down into the game's dark wet values"""
    l = rgb[0] * .3 + rgb[1] * .59 + rgb[2] * .11; l = cl((l - .5) * contrast + .5)
    m = cmix(shadow, mid, ss(0, .5, l)); m = cmix(m, hi, ss(.5, 1, l))
    return cmix(m, cmul(rgb, 0.8), keep)

# ---------------------------------------------------------------- shapes (no hard primitives: a silhouette is thresholded noise)
def _field(size, cx, cy, rx, ry, ang=0.0):
    X, Y = coords(size); c, s = math.cos(ang), math.sin(ang)
    u = ((X - cx) * c + (Y - cy) * s) * (1 / rx); v = ((Y - cy) * c - (X - cx) * s) * (1 / ry)
    return (u * u + v * v) ** 0.5
def blob(rng, size, cx, cy, rx, ry, rough=0.22, lobes=3, ang=0.0, edge=2.0):
    """an organic mask, never a clean ellipse. rough = silhouette irregularity, lobes = lump scale"""
    d = _field(size, cx, cy, rx, ry, ang) + (fbm(rng, lobes, size, 4) - 0.5) * rough * 2.0
    return ss(1.0 + edge / max(rx, ry), 1.0 - edge / max(rx, ry), d)
def polymask(size, pts, sc=2, soft=1.0):
    w, h = size; m = Image.new('L', (w * sc, h * sc), 0); ImageDraw.Draw(m).polygon([(x * sc, y * sc) for x, y in pts], fill=255)
    m = m.resize(size, LAN); t = T(m.convert('F')) * (1 / 255); return blur(t, soft) if soft else t
def dome(mask, r=30, r2=8, flat=0.0):
    """a height field from a mask: bulk from a wide blur, form from a tight one. Not a sphere: follows the silhouette"""
    return cl(blur(mask, r) * 1.2 - flat) * mask + blur(mask, r2) * 0.25
def bez(p0, p1, p2, p3, n=48):
    out = []
    for i in range(n + 1):
        t = i / n; u = 1 - t
        out.append((u**3*p0[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t**3*p3[0], u**3*p0[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t**3*p3[1]))
    return out
def tubes(size, paths, sc=2, steps=6):
    """round-section tube heights. paths = [(pts, width0, width1, [lift])]. Returns (height, mask): nest draws with lift for
    cords, gut, tendons, tentacles. Height is in 0..1 and bright at the centreline so the shader rounds them"""
    w, h = size; H = Image.new('L', (w * sc, h * sc), 0); d = ImageDraw.Draw(H)
    for p in paths:
        pts, w0, w1 = p[0], p[1], p[2]; lift = p[3] if len(p) > 3 else 1.0; n = len(pts) - 1
        for k in range(steps):
            f = 1 - k / steps; v = int(255 * lift * math.sqrt(max(0, 1 - f * f)) )
            for i in range(n):
                a, b = pts[i], pts[i + 1]; t = i / max(1, n); rad = (w0 + (w1 - w0) * t) * f * sc
                if rad < .4: continue
                d.line((a[0]*sc, a[1]*sc, b[0]*sc, b[1]*sc), fill=v, width=max(1, int(rad*2)))
                d.ellipse((b[0]*sc-rad, b[1]*sc-rad, b[0]*sc+rad, b[1]*sc+rad), fill=v)
    H = H.resize(size, LAN); ht = T(H.convert('F')) * (1 / 255)
    return blur(ht, 1), ss(0.0, 0.08, ht)
def veinnet(rng, size, mask, n=14, w0=2.2, branch=0.07, seedpts=None):
    """branching vessel height (0..1) inside mask, for raised veins. Darken or redden with vein height, do not stroke a colour on"""
    w, h = size; im = Image.new('L', (w * 2, h * 2), 0); d = ImageDraw.Draw(im); seeds = seedpts or []
    def walk(x, y, a, wd, life):
        while life > 0 and wd > .35:
            a += rng.gauss(0, .28); nx, ny = x + math.cos(a) * 7, y + math.sin(a) * 7
            d.line((x*2, y*2, nx*2, ny*2), fill=255, width=max(1, int(wd*2))); x, y = nx, ny; wd *= .985; life -= 1
            if rng.random() < branch: walk(x, y, a + rng.choice((-1, 1)) * rng.uniform(.4, 1.1), wd * .72, life * .7)
    for i in range(n):
        x, y = seeds[i % len(seeds)] if seeds else (rng.uniform(0, w), rng.uniform(0, h))
        walk(x, y, rng.uniform(0, 6.28), w0 * rng.uniform(.6, 1.2), rng.randint(25, 60))
    v = T(im.resize(size, LAN).convert('F')) * (1 / 255); return blur(v, 0.7) * mask

# ---------------------------------------------------------------- palettes (dark on purpose: bullets must read over all of them)
PAL = dict(
  meat=((.11,.012,.016),(.40,.055,.05),(.72,.28,.22)), clot=((.03,.004,.006),(.17,.012,.018),(.44,.05,.05)),
  fat=((.20,.12,.05),(.55,.42,.20),(.84,.74,.48)), pus=((.13,.11,.02),(.45,.40,.10),(.82,.76,.36)),
  bile=((.05,.08,.02),(.20,.27,.05),(.54,.58,.14)), bruise=((.05,.02,.07),(.19,.07,.17),(.42,.20,.26)),
  necro=((.025,.02,.015),(.11,.085,.05),(.32,.27,.17)), bone=((.16,.12,.07),(.50,.42,.27),(.86,.80,.62)),
  rust=((.05,.025,.015),(.27,.11,.04),(.58,.30,.12)), frost=((.05,.08,.12),(.27,.37,.45),(.72,.84,.92)),
  char=((.012,.010,.010),(.07,.05,.045),(.25,.15,.09)), iron=((.03,.03,.035),(.13,.13,.14),(.40,.39,.38)),
  pale=((.14,.08,.08),(.48,.33,.30),(.80,.68,.60)), mucus=((.09,.10,.03),(.33,.35,.11),(.70,.70,.34)))

# ---------------------------------------------------------------- the shader
LIGHT = (lambda v: tuple(c / math.sqrt(sum(q * q for q in v)) for c in v))((-.5, -.62, .6))
HALF = (lambda v: tuple(c / math.sqrt(sum(q * q for q in v)) for c in v))((LIGHT[0], LIGHT[1], LIGHT[2] + 1))
def wet(base, h, mask, detail=None, k=22.0, dk=4.0, ao=5.0, amb=.05, key=.95, sss=.55, sss_col=(.60,.02,.03), spec=.32, shin=30.0,
        glint=.9, film=None, rim=.10, rim_col=(.35,.45,.6), light=LIGHT, half=HALF):
    """wet tissue lighting. base = albedo triple; h = form height (dome + tubes); detail = high-frequency height, usually a photo's
    high pass; film = optional slime map (0..1) that raises gloss and flattens bumps where it pools. Returns a premultiplied layer"""
    size = h.size; hh = h if detail is None else h + (detail - .5) * (dk / k)
    dx, dy = grad(hh); n = nrm(-dx * k, -dy * k, const(1.0, size))
    d = dot3(n, light); diff = cl((d + .3) * (1 / 1.3))
    cav = cl((hh - blur(hh, 7)) * ao + .55); cav2 = cl((hh - blur(hh, 22)) * ao * .6 + .6)
    col = cmul(base, (amb + diff * key) * (.25 + .85 * cav) * (.45 + .6 * cav2))
    # blood under the skin: thin edges and creases glow red instead of going black
    thin = (1 - ss(0, .55, blur(mask, 5))) * mask + (1 - cav) * .35
    col = cadd(col, cmul(sss_col, thin * sss * (.35 + .65 * diff)))
    # two-scale gloss: broad sheen, then broken pinpoint glints off the micro bumps (what makes it read wet, not plastic)
    hd = mx(dot3(n, half), 0.0); f = 1.0 if film is None else (.45 + film * 1.2)
    brk = ss(.42, .62, vnoise(random.Random(11), size[0] // 5, size[1] // 5, size))  # sheen breaks into beads, as a wet film does
    s = hd ** (shin * 12) * glint * f * brk
    tint = cmix((1.0, .93, .88), cmul(base, 2.2), .55)
    col = cadd(col, cmul(tint, hd ** shin * spec * f * (.35 + .65 * brk)))
    if film is not None:
        fh = blur(hh, 3); fx, fy = grad(fh); nf = nrm(-fx * k * .7, -fy * k * .7, const(1.0, size)); fd = mx(dot3(nf, half), 0.0)
        s = s + (fd ** 90.0) * film * .8
    col = cadd(col, cmul((1.0, .93, .88), s))
    r = (1 - cl(n[2])) ** 2.0 * rim
    col = cadd(col, cmul(rim_col, r * mask))
    return dict(rgb=cmul(col, mask), a=mask)
def film_map(rng, size, mask, c=6, lo=.48, hi=.68): return ss(lo, hi, fbm(rng, c, size, 4)) * mask
def drips(rng, size, starts, col=(.42,.40,.1), maxlen=60, w=2.5, gravity=1.0):
    """hanging strands and drips from (x, y) points, as a shaded layer: thin neck, swollen bead at the end"""
    paths = []
    for x, y in starts:
        L = rng.uniform(.25, 1) ** 1.6 * maxlen; wob = rng.uniform(-w * 1.5, w * 1.5)
        paths.append((bez((x, y), (x + wob, y + L * .3), (x - wob, y + L * .6), (x, y + L), 16), w * rng.uniform(1.1, 1.8), w * rng.uniform(.35, .6)))
    h, m = tubes(size, paths); beads = Image.new('L', size, 0); d = ImageDraw.Draw(beads)
    for p in paths:
        ex, ey = p[0][-1]; r = w * rng.uniform(.8, 1.5); d.ellipse((ex - r, ey - r * .9, ex + r, ey + r * 1.5), fill=255)
    bm = blur(T(beads.convert('F')) * (1 / 255), .8); M = mx(m, bm); H = mx(h, bm * .9)
    return wet(tuple(const(c, size) for c in col), H, M, k=14, sss=.15, spec=.9, glint=1.0, film=M)
def base_from(pal, t, size=None):
    """albedo from a palette triple and a 0..1 map"""
    s, m, h = PAL[pal] if isinstance(pal, str) else pal
    return cmix(cmix(s, m, ss(0, .5, t)), h, ss(.5, 1, t))

# ---------------------------------------------------------------- layers
def canvas(size): return dict(rgb=(const(0, size),) * 3, a=const(0, size))
def over(top, under):
    k = 1 - top['a']; return dict(rgb=tuple(a + b * k for a, b in zip(top['rgb'], under['rgb'])), a=top['a'] + under['a'] * k)
def fade(layer, k): return dict(rgb=cmul(layer['rgb'], k), a=layer['a'] * k)
def shadow(mask, r=9, k=.75, dx=2, dy=4):
    """contact shadow/AO cast by a part on what is below: stops parts reading as stickers"""
    m = sh(blur(mask, r), dx, dy) * k; return dict(rgb=(const(0, mask.size),) * 3, a=m)
def to_pil(layer):
    """layer -> straight-alpha RGBA PIL"""
    a = cl(layer['a']); ch = []
    for c in layer['rgb']: ch.append(cl(c / mx(a, 1e-3)))
    conv = lambda t: t.im.point(lambda v: v * 255).convert('L')
    return Image.merge('RGBA', [conv(ch[0]), conv(ch[1]), conv(ch[2]), conv(a)])
def from_pil(im):
    r, g, b, a = im.convert('RGBA').split(); A = T(a.convert('F')) * (1 / 255); f = lambda c: T(c.convert('F')) * (1 / 255) * A
    return dict(rgb=(f(r), f(g), f(b)), a=A)

# ---------------------------------------------------------------- delivery (same format as bosspick; adds the in-game mock)
def game_sprite(hero, game_size, colors=56, alpha_cut=96, sharpen=True):
    """a painted RGBA view -> the real crisp sprite: premultiplied Lanczos down, a little unsharp, a hard alpha edge, a limited palette"""
    p = hero.convert('RGBa').resize(game_size, LAN).convert('RGBA'); r, g, b, a = p.split()
    rgb = Image.merge('RGB', (r, g, b))
    if sharpen: rgb = rgb.filter(ImageFilter.UnsharpMask(radius=1.2, percent=70, threshold=2))
    q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    a = a.point(lambda v: 255 if v >= alpha_cut else 0); q.putalpha(a); return q
def on_bg(im, bg=GAME_BG):
    o = Image.new('RGBA', im.size, bg + (255,)); o.alpha_composite(im.convert('RGBA')); return o.convert('RGB')
def x4(sp, n=4):
    return on_bg(sp.resize((sp.width * n, sp.height * n), NEAR))
BULLETS = [(0.30, .30, (130, 235, 60)), (.18, .55, (130, 235, 60)), (.38, .70, (245, 70, 60)), (.26, .45, (245, 70, 60))]
def in_game(sp, biome, at=(.76, .5)):
    """the sprite at true pixel size on the boss's real captured biome background with sample enemy shots, x2: the read test"""
    bgp = os.path.join(HERE, 'bg', biome + '.png'); bg = Image.open(bgp).convert('RGBA'); s = bg.copy()
    s.alpha_composite(sp, (int(s.width * at[0] - sp.width / 2), int(s.height * at[1] - sp.height / 2)))
    d = ImageDraw.Draw(s)
    for fx, fy, c in BULLETS:
        x, y = int(fx * s.width), int(fy * s.height); d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=c + (255,)); d.ellipse((x - 1, y - 1, x + 1, y + 1), fill=(255, 255, 230, 255))
    return s.convert('RGB').resize((s.width * 2, s.height * 2), NEAR)
def strip(frames, labels=None, n=3, gap=6):
    """states at game size, nearest xn, with labels: frames are RGBA sprites"""
    W = sum(f.width * n + gap for f in frames) + gap; H = max(f.height for f in frames) * n + 22
    s = Image.new('RGB', (W, H), GAME_BG); x = gap; d = ImageDraw.Draw(s)
    for i, f in enumerate(frames):
        s.paste(on_bg(f.resize((f.width * n, f.height * n), NEAR)), (x, 18))
        if labels: d.text((x, 3), labels[i], fill=(200, 170, 160))
        x += f.width * n + gap
    return s
def deliver(out, cid, hero, game_size, biome, states, name, pitch, method, notes, sources, at=(.76, .5), colors=56):
    """writes <cid>_hero/_game/_game_x4/_strip/_ingame.png and returns the concepts.json row. hero: RGBA painted view. states: [(label, RGBA view)]
    of attack, hurt, wounded, dying at least (same canvas as hero). game_size: the real footprint (w, h) from the code"""
    os.makedirs(out, exist_ok=True); p = lambda s: os.path.join(out, f'{cid}_{s}.png')
    H = on_bg(hero); H.thumbnail((640, 640), LAN); H.save(p('hero'))
    sp = game_sprite(hero, game_size, colors); sp.save(p('game')); x4(sp).save(p('game_x4'))
    fr = [sp] + [game_sprite(v, game_size, colors) for _, v in states]; strip(fr, ['idle'] + [l for l, _ in states]).save(p('strip'))
    in_game(sp, biome, at).save(p('ingame'))
    return dict(id=cid, name=name, pitch=pitch, method=method, notes=notes, sources=sources,
                files=dict(hero=f'{cid}_hero.png', x4=f'{cid}_game_x4.png', strip=f'{cid}_strip.png', game=f'{cid}_game.png', ingame=f'{cid}_ingame.png'))

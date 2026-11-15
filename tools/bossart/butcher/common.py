"""THE BURNING BUTCHER, painter helpers for this boss only (ported from the Phase 1 lane's bk.py; the kit is imported, never edited).
Hero canvas 736x960 = 92x120 game px at K=8. Boss origin (0,0) sits at game (64,48): room for the cleaver's whole swing
(pivot (-10,-10), reach ~45 px) on the left and the dropped bowel below."""
import sys, random, math, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from bosskit import *
from PIL import Image, ImageDraw, ImageFilter
S=(736,960); K=8; OX,OY=64*K,48*K; GS=(92,120)
def P(x,y): return (OX+x*K, OY+y*K)
def Pn(pts): return [P(*p) for p in pts]
def R(n): return random.Random(n)
def chaikin(p,it=2,closed=True):
    for _ in range(it):
        q=[]; n=len(p); rng_=range(n) if closed else range(n-1)
        for i in rng_:
            a,b=p[i],p[(i+1)%n]
            q+=[(a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25),(a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75)]
        p=q
    return p
def shape(pts,it=2,soft=1.0): return polymask(S,chaikin(Pn(pts),it),soft=soft)
def rough(m,rng,c=14,amt=.35,r=5,lo=.47,hi=.53):
    """tear a mask's edge with noise: a silhouette is thresholded, never a clean curve"""
    return ss(lo,hi,blur(m,r)+(fbm(rng,c,S,4)-.5)*amt)
_ph={}
def ph(name,crop=None,seed=1,amp=24,cells=9,rot=0,mirror=False):
    k=(name,crop,seed,amp,cells,rot,mirror)
    if k not in _ph:
        im=photo(name,S,crop=crop,rot=rot,mirror=mirror)
        if amp: im=warp(im,R(seed),amp,cells)
        _ph[k]=im
    return _ph[k]
def phT(*a,hp=16,gain=2.6,**kw):
    im=ph(*a,**kw); return rgbT(im), highpass(lumaT(im),hp,gain)
def C(c): return tuple(const(v,S) for v in c)
HOT=((.42,.03,.01),(1.0,.30,.03),(1.0,.82,.42))
def emit(L,e,ramp=HOT,gain=1.0):
    col=cmix(cmix(ramp[0],ramp[1],ss(0,.5,e)),ramp[2],ss(.5,1,e))
    return dict(rgb=cadd(L['rgb'],cmul(col,e*gain*L['a'])),a=L['a'])
def cast(cv,m,r=8,k=.7,dx=3,dy=6):
    """part shadow: darkens what is under, never adds alpha (a halo on transparency would become an outline in the sprite)"""
    d=1-cl(sh(blur(m,r),dx,dy)*k); return dict(rgb=cmul(cv['rgb'],d),a=cv['a'])
def under(cv,m,r=10,k=.8,dx=3,dy=6):
    return cast(cv,m,r,k,dx,dy)
def clipL(L,m): return dict(rgb=cmul(L['rgb'],m),a=L['a']*m)
def bloodbase(rng,c=9):
    t=fbm(rng,c,S,3); return cmix(C((.10,.004,.008)),C((.42,.012,.02)),ss(.3,.7,t))
BLOOD=dict(k=16,sss=.25,sss_col=(.5,.01,.02),spec=.6,shin=50,glint=1.0)
def runs(rng,starts,maxlen=120,w=7,col=None,minlen=.25,lift=.9):
    """hanging runs: an uneven taper with a long drawn-out tip. Never a bead on a thread"""
    paths=[]
    for x,y in starts:
        L=rng.uniform(minlen,1)**1.4*maxlen; n=rng.randint(3,5); xx,yy=x,y; wd=w*rng.uniform(.7,1.3); dx=rng.uniform(-.06,.06)
        for i in range(n):
            ny=yy+L/n; nx=xx+dx*L/n+rng.uniform(-w*.3,w*.3); w1=wd*rng.uniform(.62,1.12) if i<n-1 else .6
            paths.append((bez((xx,yy),(xx,yy+L/n*.3),(nx,ny-L/n*.3),(nx,ny),5),wd,w1,lift)); xx,yy,wd=nx,ny,w1
    return tubes(S,paths)
def bloodruns(rng,starts,maxlen=120,w=7,base=None,**kw):
    h,m=runs(rng,starts,maxlen,w,**kw)
    return wet(base or bloodbase(rng),h*.8,m,**BLOOD,film=m)
def spatter(rng,c,n,spread,rmax=9,stretch=2.2):
    """blood fleck mask around c (paint coords)"""
    im=Image.new('L',S,0); d=ImageDraw.Draw(im)
    for _ in range(n):
        a=rng.uniform(0,6.28); q=rng.random()**.6*spread; x=c[0]+math.cos(a)*q; y=c[1]+math.sin(a)*q*.8
        r=rng.uniform(1,rmax)*(1-q/spread*.7)
        d.ellipse((x-r,y-r,x+r,y+r*stretch),fill=255)
    return blur(T(im.convert('F'))*(1/255),.8)
def chainH(a,b,lw=4.8,ln=8.2,seed=3,droop=0.0):
    """hand-forged links along a line (game-px sizes): alternating open ring and edge-on link, each slightly off"""
    rng=R(seed); dx,dy=b[0]-a[0],b[1]-a[1]; L=math.hypot(dx,dy) or 1; ux,uy=dx/L,dy/L; vx,vy=-uy,ux
    paths=[]; step=ln*.72*K; n=int(L/step)+1; lwP=lw*K/2; lnP=ln*K/2
    for i in range(n):
        t=(i+.5)*step; off=rng.uniform(-3,3); cx=a[0]+ux*t+vx*off; cy=a[1]+uy*t+vy*off
        if i%2==0:
            pts=[]; tw=rng.uniform(-.25,.25)
            for j in range(13):
                q=j/12*6.283; lx=math.cos(q)*lnP; ly=math.sin(q)*lwP*.8
                ca,sa=math.cos(tw),math.sin(tw); lx,ly=lx*ca-ly*sa,lx*sa+ly*ca
                pts.append((cx+ux*lx+vx*ly,cy+uy*lx+vy*ly))
            paths.append((pts,6.5,6.5,.9))
        else:
            hl=lnP*.92; paths.append(([(cx-ux*hl,cy-uy*hl),(cx+ux*hl,cy+uy*hl)],7.5,7.5,1.0))
    return tubes(S,paths,steps=5)
def chainL(a,b,seed=3,bright=1.0):
    h,m=chainH(a,b,seed=seed)
    rgb,det=phT('rust_107.jpg',(.05,.05,.95,.95),seed=seed,amp=10,cells=6,hp=8,gain=3)
    base=grade(rgb,(.012,.009,.008),(.13,.06,.035),(.52,.30,.15),contrast=1.5,keep=.1); base=cmul(base,bright)
    return wet(base,h,m,detail=det,k=10,dk=2.5,ao=2,sss=0,spec=.35,shin=22,glint=.6,rim=.25,rim_col=(.9,.35,.1)),m
def hookL(a,tip,seed=5,w=7):
    """steel meat hook: a shank from the chain end curving into the flesh"""
    h,m=tubes(S,[(bez(a,(a[0]+18,a[1]+34),(tip[0]+34,tip[1]+6),tip,20),w,w*.45,1.0)])
    rgb,det=phT('rust_103.jpg',None,seed=seed,amp=8,cells=5,hp=8,gain=3)
    base=grade(rgb,(.01,.01,.012),(.14,.10,.08),(.55,.42,.32),contrast=1.5,keep=.05)
    return wet(base,h,m,detail=det,k=10,dk=2,ao=2,sss=0,spec=.5,shin=30,glint=.9,rim=.25,rim_col=(.9,.35,.1)),m
def blade_poly(hand,ang,L=30,W=15,seed=9,nicks=3):
    """an irregular butcher's blade. hand in game px, ang degrees (direction hand->tip, y up). Few broad nicks, not a saw"""
    rng=R(seed); a=math.radians(ang); ux,uy=math.cos(a),-math.sin(a); vx,vy=-uy,ux
    if 90<ang%360<270: vx,vy=uy,-ux
    hx,hy=P(*hand); LP,WP=L*K,W*K
    def q(u,v): return (hx+ux*u*LP+vx*v*WP,hy+uy*u*LP+vy*v*WP)
    sp=[q(.06,-.40),q(.34,-.46),q(.62,-.42),q(.97,-.47)]
    tip=[q(1.05,-.22),q(1.04,.2)]
    us=[1.0-i/28*.94 for i in range(29)]; nu=[rng.uniform(.15,.95) for _ in range(nicks)]; edge=[]
    for u in us:
        v=.55+.045*math.sin(u*4.3+seed)+rng.uniform(-.006,.006)
        for n in nu:
            d=abs(u-n)
            if d<.03: v-=(.03-d)/.03*.07
        edge.append(q(u,v))
    return sp+tip+edge+[q(.05,.12)],edge,(ux,uy,vx,vy),q
def blade_layer(hand,ang,L=30,W=15,seed=9,hot=0.0,rustn='rust_107.jpg',crop=(.25,.45,.8,.75),bloody=.5):
    outline,edge,ax,q=blade_poly(hand,ang,L,W,seed)
    rng=R(seed+1); m=polymask(S,outline,soft=.7)
    rgb,det=phT(rustn,crop,seed=seed,amp=14,cells=6,hp=26,gain=2.2)
    base=grade(rgb,(.012,.009,.009),(.11,.06,.042),(.38,.24,.15),contrast=1.7,keep=.06)
    # bevel: a wide paler band along the edge so the blade reads as a blade at 90 px
    bev=[q(u,.27+.02*math.sin(u*9)) for u in [1.02-i/10*.96 for i in range(11)]]+list(reversed(edge))
    bm=polymask(S,bev,soft=1.2)*m
    base=cmix(base,cmix(cmul(base,1.4),C((.30,.27,.24)),ss(.3,.75,fbm(rng,10,S,4))),bm)
    if bloody:
        b=ss(.60-.14*bloody,.70,fbm(rng,5,S,4)); base=cmix(base,C((.21,.008,.012)),b*.9)
    h=blur(m,7)*.25-bm*.12
    L_=wet(base,h,m,detail=det,k=14,dk=3.0,ao=2.5,sss=0,spec=.26,shin=16,glint=.45,rim=.2,rim_col=(.9,.35,.1))
    im=Image.new('L',S,0); ImageDraw.Draw(im).line(edge,fill=255,width=7); e=blur(T(im.convert('F'))*(1/255),1.2)*m
    col=cmix(C((.72,.68,.60)),cmix(C((.95,.42,.08)),C((1.0,.78,.40)),ss(.35,.65,fbm(rng,14,S,3))),const(hot,S))
    L_=dict(rgb=cmix(L_['rgb'],cmul(col,m),e*.9),a=m)
    if hot>0: L_=emit(L_,blur(bm,5)*hot*.4)
    return L_,m,ax,q
def limb(pts,widths,it=2,seed=None,amt=0.0):
    """an organic limb mask from an axis and half-widths in game px: real shoulders, condyles, taper. Not a tube"""
    pts=[tuple(p) for p in pts]; n=len(pts); L=[];Rr=[]
    for i,p in enumerate(pts):
        a=pts[max(i-1,0)]; b=pts[min(i+1,n-1)]; dx,dy=b[0]-a[0],b[1]-a[1]; l=math.hypot(dx,dy) or 1
        w=widths[i]; wl,wr=(w if not isinstance(w,tuple) else w[0]),(w if not isinstance(w,tuple) else w[1])
        L.append((p[0]-dy/l*wl,p[1]+dx/l*wl)); Rr.append((p[0]+dy/l*wr,p[1]-dx/l*wr))
    m=shape(L+Rr[::-1],it=it)
    if seed is not None: m=rough(m,R(seed),c=24,amt=amt or .2,r=3)
    return m
def porous(rng,base,m,k=1.0):
    """cancellous bone: dark red pits at two scales"""
    a=ss(.60,.72,vnoise(rng,110,134,S)); b=ss(.62,.76,vnoise(rng,46,56,S))
    p=cl(a*.7+b)*k
    return cmix(base,C((.10,.012,.012)),p*m),p
def gutrope(rng,x,y,drop,sway=30,w=20,seg=9):
    """a hanging bowel loop as ONE slack path: drawn in one stroke so joints never bead into sausages"""
    ph_=rng.uniform(0,6); f=rng.uniform(4,6.5); pts=[]; N=seg*10
    for i in range(N+1):
        t=i/N; pts.append((x+math.sin(ph_+t*f)*sway*(.45+t*.8),y+drop*t+math.cos(ph_+t*f*2)*drop*.04))
    return [(pts,w*rng.uniform(.95,1.15),w*rng.uniform(.75,.95),1.0)]
GUTPAL=((.035,.004,.007),(.27,.045,.05),(.52,.20,.17))   # dark and red: bowel, not sausage pink
def gutsL(rng,paths,seed=4,gl=.85):
    h,m=tubes(S,paths,steps=6)
    rgb,det=phT('path_198.jpg',(.1,.1,.9,.9),seed=seed,amp=26,cells=8,hp=10,gain=3)
    base=grade(rgb,*GUTPAL,contrast=1.6,keep=.08)
    v=veinnet(rng,S,m,n=26,w0=2.0); base=cmix(base,C((.16,.01,.02)),v*.8)
    return wet(base,h*.9,m,detail=det,k=14,dk=4,ao=3,sss=.5,spec=.55,shin=40,glint=1.0,film=m*.8),m
_vc={}
def voronoi(seed,n=44,box=None,lo=(180,220)):
    """cracked plates: returns (crack 0..1, plate value 0..1, plate tilt x, tilt y) at canvas size. Computed low-res once, then warped"""
    k=(seed,n)
    if k in _vc: return _vc[k]
    rng=R(seed); w,h=lo; pts=[(rng.uniform(0,w),rng.uniform(0,h),rng.random(),rng.uniform(-1,1),rng.uniform(-1,1)) for _ in range(n)]
    D=[];V=[];TX=[];TY=[]
    for y in range(h):
        for x in range(w):
            a=b=1e9; ia=ib=None
            for p in pts:
                q=(x-p[0])**2+(y-p[1])**2
                if q<a: b=a;ib=ia;a=q;ia=p
                elif q<b: b=q;ib=p
            D.append((b-a)/(2*math.hypot(ia[0]-ib[0],ia[1]-ib[1])+1e-3)); V.append(ia[2]);TX.append(ia[3]*.5+.5);TY.append(ia[4]*.5+.5)
    def mk(vals,scale=1.0,res=BIC):
        im=Image.new('F',lo); im.putdata([v*scale for v in vals]); return im.resize(S,res)
    wr=R(seed+1); 
    def wf(im): 
        return warp(im,R(seed+1),10,14)
    dist=T(wf(mk(D)))
    _vc[k]=(dist,T(wf(mk(V,1.0,NEAR))),T(wf(mk(TX,1.0,NEAR))),T(wf(mk(TY,1.0,NEAR))))
    return _vc[k]
def boneT(seed=2,dark=1.0):
    rgb,det=phT('shell_60.jpg',(.1,.05,.85,.5),seed=seed,amp=18,cells=7,hp=12,gain=3)
    return cmul(grade(rgb,(.10,.06,.035),(.46,.37,.23),(.92,.86,.68),contrast=1.5,keep=.04),dark),det
def tiltL(L,deg,pivot):
    """rotate a whole painted layer about a point in paint coords (a chain has snapped)"""
    if not deg: return L
    im=to_pil(L).rotate(deg,BIC,center=pivot); return from_pil(im)
def rotP(p,deg,pivot):
    a=math.radians(-deg); dx,dy=p[0]-pivot[0],p[1]-pivot[1]
    return (pivot[0]+dx*math.cos(a)-dy*math.sin(a),pivot[1]+dx*math.sin(a)+dy*math.cos(a))
def rigged(body,A,B,st,tilt=-9):
    """hang a body from two chains. A left, B right, in game px. st.snap: B has gone, the body swings on A"""
    pa,pb=P(*A),P(*B); cv=canvas(S)
    if st.get('snap'):
        deg=tilt; body=tiltL(body,deg,pa); pb2=rotP(pb,deg,pa)
        L1,m1=chainL((pa[0],0),pa,seed=3); cv=over(L1,cv)
        L2,m2=chainL((pb[0]+2,0),(pb[0]+6,int(pb[1]*.42)),seed=7); cv=over(L2,cv)
        cv=over(body,cv)
        L3,m3=chainL(pb2,(pb2[0]+16,pb2[1]+70),seed=8); cv=over(cast(L3,m3*0,1,0),cv)
        return cv
    L1,m1=chainL((pa[0]-3,0),pa,seed=3); L2,m2=chainL((pb[0]+3,0),pb,seed=7)
    cv=over(L1,cv); cv=over(L2,cv); return over(body,cv)
def hookthrow(cv,st,tip=(24,-36)):
    """hook tell: chain drawn back from the sim's hook origin (+10,-8), barbed hook up and cocked"""
    if not st.get('hook'): return cv
    hc,hmm=chainL(P(10,-8),P(*tip),seed=11); cv=cast(cv,hmm,4,.7,3,4); cv=over(hc,cv)
    hk,_=hookL(P(*tip),P(tip[0]+9,tip[1]-10),seed=12,w=11); return over(hk,cv)

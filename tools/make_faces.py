import cv2, numpy as np, math
from PIL import Image, ImageDraw, ImageFilter
SRC=np.array(Image.open('/workspace/cut_full.png').convert('RGBA'))
X0,Y0,X1,Y1=378,58,452,112      # crop in original px
U=8                               # work upscale
OUT=4                             # output upscale
crop=Image.fromarray(SRC[Y0:Y1,X0:X1]).resize(((X1-X0)*U,(Y1-Y0)*U),Image.LANCZOS)
base=np.array(crop.convert('RGB'))
W,H=crop.size
def P(x,y): return ((x-X0)*U,(y-Y0)*U)
ANG=math.atan2(74-78,430-397)  # head tilt
def rot(cx,cy,dx,dy):
    c,s=math.cos(ANG),math.sin(ANG); return (cx+dx*c-dy*s, cy+dx*s+dy*c)
LE=(397.5,78.0); RE=(429.5,74.0); MO=(416.5,95.2)
def inpaint(img,regions):
    m=np.zeros((H,W),np.uint8)
    for (cx,cy,rx,ry) in regions:
        x,y=P(cx,cy); cv2.ellipse(m,(int(x),int(y)),(int(rx*U),int(ry*U)),math.degrees(ANG),0,360,255,-1)
    m=cv2.dilate(m,np.ones((5,5),np.uint8))
    small=cv2.resize(img,(W//4,H//4),interpolation=cv2.INTER_AREA); ms=cv2.resize(m,(W//4,H//4))
    r=cv2.inpaint(small,ms,6,cv2.INPAINT_TELEA); r=cv2.resize(r,(W,H),interpolation=cv2.INTER_CUBIC)
    r=cv2.GaussianBlur(r,(0,0),3)
    mf=cv2.GaussianBlur(m.astype(np.float32)/255,(0,0),4)[...,None]
    return (img*(1-mf)+r*mf).astype(np.uint8), m
class Layer:
    def __init__(s): s.S=2; s.im=Image.new('RGBA',(W*s.S,H*s.S),(0,0,0,0)); s.d=ImageDraw.Draw(s.im)
    def pts(s,ps): return [((x-X0)*U*s.S,(y-Y0)*U*s.S) for x,y in ps]
    def poly(s,ps,fill): s.d.polygon(s.pts(ps),fill=fill)
    def line(s,ps,fill,w): s.d.line(s.pts(ps),fill=fill,width=int(w*U*s.S),joint='curve')
    def ell(s,cx,cy,rx,ry,fill):
        # rotated ellipse as polygon
        ps=[rot(cx,cy,rx*math.cos(t),ry*math.sin(t)) for t in np.linspace(0,2*math.pi,48)]; s.poly(ps,fill)
    def get(s,blur=1.2):
        return s.im.resize((W,H),Image.LANCZOS).filter(ImageFilter.GaussianBlur(blur))
def comp(img,layer):
    b=Image.fromarray(img).convert('RGBA'); b.alpha_composite(layer); return np.array(b.convert('RGB'))
def arc(cx,cy,w,h,t0,t1,n=20,flip=1):
    # parabola-like arc points around (cx,cy) in head frame
    return [rot(cx,cy,w*u, -flip*h*(1-u*u)) for u in np.linspace(t0,t1,n)]
LIP=(140,72,70,255); LIPD=(95,30,32,255); MOUTH=(72,22,28,255); TEETH=(222,214,210,255); TONG=(170,70,80,255)
LASH=(28,18,20,255)
def mouth_open(L,cx,cy,w,h,teeth_top=True,teeth_bot=False,frown=0.0):
    # outer lip shape
    top=[rot(cx,cy,w*u, -h*0.55*(1-u*u)+frown*h*u*u*0.0 + frown*h*(1-u*u)*-0.0) for u in np.linspace(-1,1,24)]
    bot=[rot(cx,cy,w*u, h*(1-u*u)**0.8 - frown*h*0.6*(1-(1-u*u))) for u in np.linspace(1,-1,24)]
    L.poly([rot(cx,cy,(w+1.2)*u, -(h*0.55+1.0)*(1-u*u)-0.3) for u in np.linspace(-1,1,24)]+[rot(cx,cy,(w+1.2)*u,(h+1.2)*(1-u*u)**0.8+0.3) for u in np.linspace(1,-1,24)],LIP)
    L.poly(top+bot,MOUTH)
    if teeth_top: L.poly([rot(cx,cy,w*0.8*u, -h*0.5*(1-u*u)) for u in np.linspace(-1,1,16)]+[rot(cx,cy,w*0.75*u, -h*0.5*(1-u*u)+h*0.26) for u in np.linspace(1,-1,16)],TEETH)
    if teeth_bot: L.poly([rot(cx,cy,w*0.7*u, h*(1-u*u)**0.8) for u in np.linspace(-1,1,16)]+[rot(cx,cy,w*0.6*u, h*(1-u*u)**0.8-h*0.28) for u in np.linspace(1,-1,16)],TEETH)
    else: L.ell(cx,cy+h*0.55,w*0.45,h*0.28,TONG)
def make(expr,talk=False,blink=False):
    img=base.copy(); regs=[]
    eyes_edit = expr in ('irritated','angry','pain','joy') or blink
    mouth_edit = expr!='smile' or talk
    if eyes_edit: regs+= [(LE[0],LE[1]-0.3,10.5,4.2),(RE[0],RE[1]-0.3,10.5,4.2)]
    if mouth_edit: regs+= [(MO[0]-0.5,MO[1]+0.2,13.5,5.8)]
    m=np.zeros((H,W),np.uint8)
    if regs: img,m=inpaint(img,regs)
    L=Layer()
    if expr=='angry':
        # dark horror shade over upper face
        sh=np.zeros((H,W),np.float32); yy=np.arange(H)[:,None]/H
        sh=np.clip(1-(yy-0.05)/0.45,0,1)*0.45; img=(img*(1-sh[...,None])+np.array([25,0,10])*sh[...,None]).astype(np.uint8)
    for e,side in ((LE,-1),(RE,1)):
        cx,cy=e
        if blink and expr in ('smile','irritated'):
            L.line(arc(cx,cy+0.8,7.5,1.6,-1,1,flip=-1),LASH,0.9)
            L.line([rot(cx,cy+0.8,-7.5*side,0),rot(cx,cy+0.8,-9.5*side,-0.8)],LASH,0.5)
        elif expr=='irritated':
            # half-lidded, inward-down slanted lid, iris below
            L.ell(cx,cy+0.6,6.2,2.0,(212,198,198,255))
            L.ell(cx+0.8*side*-1,cy+0.9,2.6,2.0,(70,25,30,255)); L.ell(cx+0.8*side*-1,cy+0.9,1.2,1.0,(15,5,8,255))
            lid=[rot(cx,cy,-7.5,-1.6*side),rot(cx,cy,7.5,1.6*side),rot(cx,cy,7.5,-3),rot(cx,cy,-7.5,-3)]
            L.poly(lid,(0,0,0,0)); 
            L.line([rot(cx,cy,-7.8,0.2-1.4*side*-1 if False else (-1.2 if side<0 else 0.9)),rot(cx,cy,7.8,(0.9 if side<0 else -1.2))],LASH,1.1)
            # anger brow peeking under bangs
            L.line([rot(cx,cy-4.2,-6,(-1.6 if side<0 else 1.4)),rot(cx,cy-4.2,6,(1.4 if side<0 else -1.6))],(40,25,25,230),1.0)
        elif expr=='angry':
            L.poly([rot(cx,cy,-8,(-1.8 if side<0 else 1.2)),rot(cx,cy,8,(1.2 if side<0 else -1.8)),rot(cx,cy,6,2.2),rot(cx,cy,-6,2.2)],(210,190,190,255))
            L.ell(cx-0.5*side,cy+0.6,2.2,2.2,(220,20,30,255)); L.ell(cx-0.5*side,cy+0.6,0.9,0.9,(255,190,170,255))
            L.line([rot(cx,cy,-8.6,(-1.8 if side<0 else 1.2)),rot(cx,cy,8.6,(1.2 if side<0 else -1.8))],LASH,1.3)
            L.line([rot(cx,cy-4.0,-6,(-2.2 if side<0 else 2.0)),rot(cx,cy-4.0,6,(2.0 if side<0 else -2.2))],(30,15,15,240),1.2)
        elif expr=='pain':
            # squeezed > < eyes
            k=-side
            L.line([rot(cx,cy,-5*k,-2.6),rot(cx,cy,3.5*k,0.2),rot(cx,cy,-5*k,2.4)],LASH,1.0)
            L.ell(cx,cy+5.5,5.5,2.2,(225,120,130,80))
        elif expr=='joy':
            L.line(arc(cx,cy+1.2,6.5,2.6,-1,1,flip=1),LASH,1.0)
            L.ell(cx,cy+5.8,5.5,2.0,(225,130,140,80))
    cx,cy=MO
    if expr=='smile' and talk: mouth_open(L,cx,cy,7.0,3.0)
    elif expr=='irritated':
        if talk: mouth_open(L,cx,cy+0.5,6.5,2.6,teeth_top=True)
        else:
            L.line([rot(cx,cy+0.6,-7,1.6),rot(cx,cy+0.6,-3,-0.4),rot(cx,cy+0.6,3,-0.4),rot(cx,cy+0.6,7,1.6)],LIPD,1.0)
            L.line([rot(cx,cy+0.6,-4.5,1.4),rot(cx,cy+0.6,4.5,1.4)],(165,85,85,200),0.9)
            L.ell(cx-15,cy-5,4,2,(225,115,125,70)); L.ell(cx+14,cy-8,4,2,(225,115,125,70))
    elif expr=='angry':
        mouth_open(L,cx,cy+0.8,8.5,3.6 if not talk else 5.0,teeth_top=True)
    elif expr=='pain':
        mouth_open(L,cx,cy+0.8,4.5 if not talk else 5.5,3.0 if not talk else 4.2,teeth_top=False)
    elif expr=='joy':
        mouth_open(L,cx,cy,8.0,3.6 if not talk else 4.8,teeth_top=True)
    out=comp(img,L.get(1.5 if expr!='angry' else 1.3))
    # alpha: only where edited (+ angry shade over face ellipse)
    a=np.zeros((H,W),np.float32)
    def addell(cx,cy,rx,ry):
        x,y=P(cx,cy); cv2.ellipse(a,(int(x),int(y)),(int(rx*U),int(ry*U)),math.degrees(ANG),0,360,1.0,-1)
    if eyes_edit: addell(LE[0],LE[1]-1.5,13,8); addell(RE[0],RE[1]-1.5,13,8)
    if mouth_edit: addell(MO[0],MO[1],16,10)
    if expr in ('irritated','pain','joy'): addell(MO[0]-15,MO[1]-6,8,5); addell(MO[0]+14,MO[1]-9,8,5)
    if expr=='angry': addell(414,84,30,26)
    a=cv2.GaussianBlur(a,(0,0),3*U/2)
    a=np.clip(a*1.6,0,1)*(SRC[Y0:Y1,X0:X1,3].repeat(U,0).repeat(U,1)[:H,:W]/255.0)
    rgba=np.dstack([out,(a*255).astype(np.uint8)])
    return Image.fromarray(rgba).resize(((X1-X0)*OUT,(Y1-Y0)*OUT),Image.LANCZOS)
import os; os.makedirs('/workspace/hasshaku-game/assets/img',exist_ok=True)
names=[]
for e in ['smile','irritated','angry','pain','joy']:
    for t in (False,True):
        n=f'face_{e}{"_talk" if t else ""}'; make(e,t).save(f'/workspace/hasshaku-game/assets/img/{n}.png'); names.append(n)
make('smile',blink=True).save('/workspace/hasshaku-game/assets/img/face_blink.png'); names.append('face_blink')
make('irritated',blink=True).save('/workspace/hasshaku-game/assets/img/face_irritated_blink.png'); names.append('face_irritated_blink')
# preview sheet (composited over original crop)
orig=Image.fromarray(SRC[Y0:Y1,X0:X1]).resize(((X1-X0)*OUT,(Y1-Y0)*OUT),Image.LANCZOS)
sheet=Image.new('RGB',(orig.width*4,orig.height*3),(255,0,255))
for i,n in enumerate(names):
    c=orig.copy(); c.alpha_composite(Image.open(f'/workspace/hasshaku-game/assets/img/{n}.png'))
    sheet.paste(c.convert('RGB'),((i%4)*orig.width,(i//4)*orig.height))
sheet.save('/workspace/hsw/faces_sheet.png'); print(names, (X0,Y0,X1,Y1))

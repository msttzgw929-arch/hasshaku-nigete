# Remove the original belly from the lower-body layer (body.png) so it can never peek out
# behind the animated/scaled belly layer. The hidden area is replaced by a plausible dress
# continuation (waist flaring to the skirt), built from real skirt fabric pixels.
import numpy as np, cv2
from PIL import Image
SRC='/workspace/cut_full.png' if __import__('os').path.exists('/workspace/cut_full.png') else '/tmp/body_orig.png'
full=np.array(Image.open(SRC).convert('RGBA')).astype(np.float32)
H,W=full.shape[:2]
u2=np.array(Image.open('/workspace/cut_u2net.png'))[:,:,3]
m=(u2>12).astype(np.uint8)*255
m=cv2.dilate(m,np.ones((15,15),np.uint8))
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
m=m.astype(np.float32)/255
m=cv2.GaussianBlur(m,(0,0),2.5)
Y0,Y1=290.0,995.0
t=np.clip((yy-Y0)/(Y1-Y0),0,1)
s=1-(1-t)**1.7
hw=62+(362-62)*s; cx=424+7*t
band=((yy>=272)&(yy<=1090)).astype(np.float32)*np.clip((1090-yy)/60,0,1)*np.clip((hw+8-np.abs(xx-cx))/6,0,1)
m=np.maximum(m*(yy>=272),band)
m=cv2.GaussianBlur(m,(0,0),2.0)
inside=np.clip((hw-np.abs(xx-cx))/3.0+0.5,0,1)*(yy>=Y0-14)
# fabric from the visible skirt: map each hidden pixel to a skirt pixel at the same relative x
ys=np.clip(1095+t*120,0,H-1)
skirt_hw=np.interp(ys,[1000,1250],[367,414]); skirt_cx=np.interp(ys,[1000,1250],[431,425])
xs=np.clip(skirt_cx+(xx-cx)/np.maximum(hw,1)*skirt_hw*0.9,0,W-1)
fab=cv2.remap(full[:,:,:3],xs.astype(np.float32),ys.astype(np.float32),cv2.INTER_LINEAR)
shade=(0.80+0.20*t)[...,None]*(1-0.25*(np.abs(xx-cx)/np.maximum(hw,1))**2)[...,None]
fab=fab*shade
out=full.copy()
out[:,:,:3]=full[:,:,:3]*(1-m[...,None])+fab*m[...,None]
out[:,:,3]=full[:,:,3]*(1-m)+255*inside*m
out[:,:,3]=np.minimum(out[:,:,3],np.maximum(full[:,:,3],255*inside))
Image.fromarray(np.clip(out,0,255).astype(np.uint8)).save('/workspace/hasshaku-game/assets/img/body.png',optimize=True)
prev=Image.fromarray(np.clip(out,0,255).astype(np.uint8)); bg=Image.new('RGBA',prev.size,(255,0,255,255)); bg.alpha_composite(prev); bg.convert('RGB').resize((424,627)).save('/workspace/hsw/body_nobelly.jpg')

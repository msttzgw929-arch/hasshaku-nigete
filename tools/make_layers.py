import numpy as np, cv2, json
from PIL import Image
full=np.array(Image.open('/workspace/cut_full.png').convert('RGBA')).astype(np.float32)
H,W=full.shape[:2]
u2=np.array(Image.open('/workspace/cut_u2net.png'))[:,:,3].astype(np.float32)/255
u2=cv2.GaussianBlur(u2,(0,0),1.2)
yy=np.arange(H)[:,None].astype(np.float32)
def ss(a,b,x): t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)
out='/workspace/hasshaku-game/assets/img/'
# body (whole)
Image.fromarray(full.astype(np.uint8)).save(out+'body.png',optimize=True)
# belly
ba=np.minimum(u2,full[:,:,3]/255)*ss(262,298,yy)
bx0,by0,bx1,by1=60,240,790,950
b=full.copy(); b[:,:,3]=ba*255
Image.fromarray(b[by0:by1,bx0:bx1].astype(np.uint8)).save(out+'belly.png',optimize=True)
# upper (head/chest/arms) drawn above belly
ua=full[:,:,3]/255*(1-ss(286,318,yy))
ux0,uy0,ux1,uy1=0,0,W,330
u=full.copy(); u[:,:,3]=ua*255
Image.fromarray(u[uy0:uy1,ux0:ux1].astype(np.uint8)).save(out+'upper.png',optimize=True)
meta=dict(W=W,H=H,belly=[bx0,by0,bx1,by1],upper=[ux0,uy0,ux1,uy1],face=[378,58,452,112],bellyPivot=[422,268],bellyBottom=935,bellyHalfW=340)
json.dump(meta,open(out+'meta.json','w'))
print(meta)

import cv2,numpy as np
from PIL import Image
src=cv2.imread('/home/box/agent-data/agents/0806a8bf-fbc4-4d3a-8b7f-7cfb195d889f/attachments/b8c0a8ca5326e50abfc5d5628eacb41ab4fc6c7bcaab10230465871d841130ca.jpg')
H,W=src.shape[:2]; s=W/692
a=np.array(Image.open('cut_isnet-general-use.png'))[:,:,3]
m=np.full((H,W),cv2.GC_BGD,np.uint8)
# probable fg: generous trapezoid skirt + body region
poly=np.array([[70,560],[620,560],[692,1024],[0,1024]],np.float32)*s
cv2.fillPoly(m,[poly.astype(np.int32)],cv2.GC_PR_FGD)
body=np.array([[150,0],[520,0],[620,560],[70,560]],np.float32)*s
cv2.fillPoly(m,[body.astype(np.int32)],cv2.GC_PR_BGD)
m[a>40]=cv2.GC_PR_FGD
m[a>200]=cv2.GC_FGD
# sure skirt core
core=np.array([[200,800],[500,800],[600,1024],[100,1024]],np.float32)*s
cv2.fillPoly(m,[core.astype(np.int32)],cv2.GC_FGD)
bgd=np.zeros((1,65),np.float64); fgd=np.zeros((1,65),np.float64)
cv2.grabCut(src,m,None,bgd,fgd,6,cv2.GC_INIT_WITH_MASK)
fg=np.where((m==1)|(m==3),255,0).astype(np.uint8)
# keep largest component
n,lab,st,_=cv2.connectedComponentsWithStats(fg)
big=1+np.argmax(st[1:,4]); fg=np.where(lab==big,255,0).astype(np.uint8)
fg=cv2.morphologyEx(fg,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
# use isnet soft alpha where it's confident, else grabcut blurred
soft=cv2.GaussianBlur(fg,(5,5),0)
alpha=np.maximum(soft.astype(np.float32)*(1), 0)
alpha=np.where(a>200, np.maximum(a,soft), soft).astype(np.uint8)
rgba=np.dstack([cv2.cvtColor(src,cv2.COLOR_BGR2RGB),alpha])
Image.fromarray(rgba).save('cut_full.png')
im=Image.fromarray(rgba); bg=Image.new('RGBA',im.size,(255,0,255,255)); bg.alpha_composite(im); bg.convert('RGB').resize((424,627)).save('prev_full.jpg')

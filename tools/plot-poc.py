# Plot builder proof of concept: composes a 2x2 lot from existing part sprites,
# depth-sorts parts by world position, bakes day + night into one image.
from PIL import Image
import random
A='/workspace/city-builder/public/assets/'
TW,TH=128,64  # 2x tile
def iso(i,j): return ((i-j)*TW/2, (i+j)*TH/2)  # top corner of tile (i,j)
def load(p,s=1.0):
    im=Image.open(A+p).convert('RGBA')
    return im if s==1 else im.resize((int(im.width*s),int(im.height*s)),Image.LANCZOS)
def bake(seed,night=False):
    rnd=random.Random(seed); W,H=2,2
    canvas=Image.new('RGBA',(TW*2+40,TH*2+220),(0,0,0,0)); ox,oy=canvas.width//2,200
    parts=[]
    for i in range(W):
        for j in range(H):
            parts.append((-1,'terrain/grass_%s@2x.png'%rnd.choice('abcde'),i,j,1.0,'tile'))
    # template: house at back cell, driveway car front-right, trees on free cells
    house=rnd.choice(['buildings/bld_R_1_a','buildings/bld_R_1_b','buildings/bld_R_1_c'])
    parts.append((0,house+'@2x.png',0.15,0.15,0.75,'foot'))
    if night: parts.append((0,house+'_night@2x.png',0.15,0.15,0.75,'foot'))
    car=rnd.choice('abc'); parts.append((0,'vehicles/veh_sedan_%s_SE@2x.png'%car,1.55,0.55,0.66,'center'))
    for _ in range(rnd.randint(2,4)):
        parts.append((0,'terrain/forest_%s@2x.png'%rnd.choice('abcd'),rnd.uniform(0.2,1.3),rnd.uniform(1.2,1.6),0.35,'foot'))
    # depth sort: tiles first, then by i+j of the part's footprint base
    parts.sort(key=lambda p:(p[0],p[2]+p[3]))
    base_layers=[p for p in parts if p[5]=='base']
    for layer,f,i,j,s,mode in parts:
        if mode=='base': continue
        im=load(f,s); x,y=iso(i,j)
        if mode=='tile': px,py=ox+x-TW/2,oy+y
        elif mode=='center': px,py=ox+x-im.width/2,oy+y+TH/2-im.height/2
        else: px,py=ox+x-im.width/2+TW*s/2-TW*s/2, oy+y+TH*s-im.height  # foot anchor
        canvas.alpha_composite(im,(int(px),int(py)))
    if night:
        from PIL import ImageEnhance
        canvas=ImageEnhance.Brightness(canvas).enhance(0.45)
    return canvas
row=[bake(s) for s in (1,2,3)]+[bake(1,True)]
out=Image.new('RGBA',(sum(r.width for r in row),row[0].height),(40,48,56,255)); x=0
for r in row: out.alpha_composite(r,(x,0)); x+=r.width
out.save('/workspace/city-builder/screenshots/plot-poc.png'); print(out.size)

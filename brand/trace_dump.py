import numpy as np, potrace
from PIL import Image, ImageFilter
SRC='logo-official.jpg'; S=4
im = Image.open(SRC).convert('RGB')
x0,y0,x1,y1 = 268,196,678,694          # bbox + margin
crop = im.crop((x0,y0,x1,y1))
big = crop.resize((crop.width*S, crop.height*S), Image.LANCZOS)
a = np.asarray(big).astype(np.int32)
r,g,b = a[...,0],a[...,1],a[...,2]
lum = np.maximum(r, g)               # gold is red/green-heavy; black bg ~0
m = Image.fromarray(np.clip(lum,0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))
mask = np.asarray(m) > 70
# gap row between mark and wordmark
rows = mask.sum(1); H = mask.shape[0]
gap = None
for y in range(int(H*0.70), int(H*0.85)):
    if rows[y] == 0: gap = y; break
print('size', mask.shape, 'gap', gap)

def path_d(bits, oy=0):
    bm = potrace.Bitmap(bits)
    pl = bm.trace(turdsize=12, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=1.0, opticurve=True, opttolerance=0.25)
    out=[]
    f=lambda p: f"{p.x/S:.2f} {(p.y+oy)/S:.2f}"
    for c in pl:
        out.append('M'+f(c.start_point))
        for seg in c.segments:
            if seg.is_corner: out.append('L'+f(seg.c)+' L'+f(seg.end_point))
            else: out.append('C'+f(seg.c1)+' '+f(seg.c2)+' '+f(seg.end_point))
        out.append('Z')
    return ''.join(out)


def curves(bits):
    bm = potrace.Bitmap(bits)
    return bm.trace(turdsize=12, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=1.0, opticurve=True, opttolerance=0.25)
SPLIT = (568 - y0) * S   # أعلى نقاط الشين في الصورة الأصلية
f=lambda p: f"{p.x/S:.2f} {p.y/S:.2f}"
mark=[]; word=[]; CUR=[]
for c in curves(~mask):
    ys=[c.start_point.y]+[seg.end_point.y for seg in c.segments]
    d=['M'+f(c.start_point)]
    for seg in c.segments:
        d.append(('L'+f(seg.c)+' L'+f(seg.end_point)) if seg.is_corner else ('C'+f(seg.c1)+' '+f(seg.c2)+' '+f(seg.end_point)))
    d.append('Z')
    xs=[c.start_point.x]+[seg.end_point.x for seg in c.segments]
    cy=(min(ys)+max(ys))/2; cx=(min(xs)+max(xs))/2
    if min(ys) >= (540-y0)*S and cx >= (560-x0)*S: cy = SPLIT  # نقطة الشين العليا
    (word if cy >= SPLIT else mark).append(''.join(d))
    if cy < SPLIT: CUR.append((round(min(xs)/S),round(min(ys)/S),round(max(xs)/S),round(max(ys)/S),''.join(d)))
    print('curve', round(min(ys)/S+y0), round(max(ys)/S+y0), 'word' if cy >= SPLIT else 'mark')
open('mark.d','w').write(''.join(mark)); open('word.d','w').write(''.join(word))
print('viewBox', crop.width, crop.height, 'mark curves', len(mark), 'word curves', len(word))

import json; json.dump(CUR, open('curves.json','w'))
for i,c in enumerate(CUR): print(i, c[:4], len(c[4]))

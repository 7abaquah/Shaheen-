import re
mark=open('mark.d').read(); word=open('word.d').read()
def bbox(d):
    n=list(map(float,re.findall(r'-?\d+\.?\d*',d))); xs=n[0::2]; ys=n[1::2]
    return min(xs),min(ys),max(xs),max(ys)
GRAD='''<linearGradient id="shnGold" x1="0.05" y1="0" x2="0.95" y2="1">
      <stop offset="0" stop-color="#F7B649"/><stop offset="0.42" stop-color="#EFA22C"/>
      <stop offset="0.5" stop-color="#F8BA4E"/><stop offset="0.58" stop-color="#E99C27"/>
      <stop offset="1" stop-color="#B9741A"/></linearGradient>'''
def svg(d, vb, fill='url(#shnGold)', bg=None, title='شاهين'):
    x0,y0,w,h=vb
    defs = f'<defs>{GRAD}</defs>' if fill.startswith('url') else ''
    bgr = f'<rect x="{x0}" y="{y0}" width="{w}" height="{h}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.1f} {y0:.1f} {w:.1f} {h:.1f}" role="img" aria-label="{title}"><title>{title}</title>{defs}{bgr}<path fill="{fill}" fill-rule="evenodd" d="{d}"/></svg>'
pad=10
full=(0,0,410,498)
mx=bbox(mark); wx=bbox(word)
mvb=(mx[0]-pad,mx[1]-pad,mx[2]-mx[0]+2*pad,mx[3]-mx[1]+2*pad)
wvb=(wx[0]-pad,wx[1]-pad,wx[2]-wx[0]+2*pad,wx[3]-wx[1]+2*pad)
both=mark+word
files={
 'shaheen-logo.svg': svg(both, full),
 'shaheen-logo-on-black.svg': svg(both, full, bg='#000000'),
 'shaheen-logo-gold-flat.svg': svg(both, full, fill='#F0A028'),
 'shaheen-logo-black.svg': svg(both, full, fill='#0A0702'),
 'shaheen-logo-white.svg': svg(both, full, fill='#FFFFFF'),
 'shaheen-mark.svg': svg(mark, mvb, title='صقر شاهين'),
 'shaheen-mark-flat.svg': svg(mark, mvb, fill='#F0A028', title='صقر شاهين'),
 'shaheen-wordmark.svg': svg(word, wvb, title='شاهين'),
}
for k,v in files.items(): open('out/'+k,'w').write(v)
print('mark vb', [round(x,1) for x in mvb], 'word vb', [round(x,1) for x in wvb])
print({k: len(v)//1024 for k,v in files.items()})

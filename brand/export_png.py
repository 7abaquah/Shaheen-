import asyncio
from playwright.async_api import async_playwright
O='/home/claude/brand/out/'
mark=open(O+'shaheen-mark.svg').read(); logo=open(O+'shaheen-logo.svg').read()
fit=lambda s: s.replace('<svg ', '<svg style="width:100%;height:100%" ', 1)
jobs=[('icon-512.png',512,mark,'#000',14),('icon-192.png',192,mark,'#000',14),('apple-touch-icon.png',180,mark,'#000',16),
 ('maskable-512.png',512,mark,'#000',24),('favicon-64.png',64,mark,'#000',8),
 ('shaheen-logo-1024-black.png',1024,logo,'#000',10),('shaheen-logo-1024-transparent.png',1024,logo,'transparent',6)]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        for name,size,svg,bg,pad in jobs:
            pg = await b.new_page(viewport={'width':size,'height':size})
            inner = 100 - 2*pad
            html = ('<body style="margin:0;background:%s;width:%dpx;height:%dpx;display:grid;place-items:center">'
                    '<div style="width:%d%%;height:%d%%">%s</div></body>') % (bg, size, size, inner, inner, fit(svg))
            await pg.set_content(html)
            await pg.screenshot(path=O+name, omit_background=(bg=='transparent'))
            await pg.close()
        await b.close()
asyncio.run(main())

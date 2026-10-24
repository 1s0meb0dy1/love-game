"""Перегенерация иконок приложения (нужен Pillow: pip install pillow). Результат: public/icons/*.png, оптимизирован палитрой."""
from PIL import Image, ImageDraw
import os
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
def bez(p0, c1, c2, p1, n=40):
    return [((1-t)**3*p0[0]+3*(1-t)**2*t*c1[0]+3*(1-t)*t*t*c2[0]+t**3*p1[0], (1-t)**3*p0[1]+3*(1-t)**2*t*c1[1]+3*(1-t)*t*t*c2[1]+t**3*p1[1]) for t in [i/n for i in range(1, n+1)]]
def heart():
    pts = [(0, 9.35), (-1.45, 8.03)]; cur = (-1.45, 8.03)
    for c1, c2, p1 in [((-6.6,3.36),(-10,0.28),(-10,-3.5)),((-10,-6.58),(-7.58,-9),(-4.5,-9)),((-2.76,-9),(-1.09,-8.19),(0,-6.91)),((1.09,-8.19),(2.76,-9),(4.5,-9)),((7.58,-9),(10,-6.58),(10,-3.5)),((10,0.28),(6.6,3.36),(1.45,8.04))]:
        pts += bez(cur, c1, c2, p1); cur = p1
    return pts
def make(size, k0, name, colors=64):
    S = size*3; img = Image.new('RGB', (S, S)); px = img.load(); a = (0xf4, 0x3f, 0x5e); b = (0xbe, 0x12, 0x3c)
    for y in range(S):
        for x in range(S):
            t = (x+y)/(2*(S-1)); px[x, y] = tuple(int(a[i]+(b[i]-a[i])*t) for i in range(3))
    k = (S/20)*k0; ImageDraw.Draw(img).polygon([(S/2+x*k, S/2+y*k) for x, y in heart()], fill=(255, 255, 255))
    img.resize((size, size), Image.LANCZOS).quantize(colors, method=Image.MEDIANCUT, dither=Image.NONE).save(os.path.join(OUT, name), optimize=True)
for s, k, n, c in [(192,.52,'icon-192.png',64),(512,.52,'icon-512.png',64),(512,.40,'maskable-512.png',64),(180,.52,'apple-touch-icon.png',64),(64,.60,'favicon.png',32)]: make(s, k, n, c)

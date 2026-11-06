import sys, json, os
from PIL import Image, ImageDraw
H=os.path.dirname(os.path.abspath(__file__)); C=json.load(open(H+'/.cache/crops.json'))
sheet=sys.argv[1]; out=sys.argv[2]
items=[c for c in C if c['sheet']==sheet]
cols=int(sys.argv[3]) if len(sys.argv)>3 else 6
tw=300; th=230
rows=(len(items)+cols-1)//cols
img=Image.new('RGB',(cols*tw,rows*th),'#888')
d=ImageDraw.Draw(img)
for i,c in enumerate(items):
    im=Image.open(H+'/.cache/crops/%s.png'%c['name']).convert('RGB'); im.thumbnail((tw-8,th-24))
    x=(i%cols)*tw;y=(i//cols)*th
    img.paste(im,(x+4,y+20)); d.text((x+6,y+4),str(c['pos'])+' '+str(c['box']),fill='#fff')
img.save(out)

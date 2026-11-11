"""Manually restyle Dee's lettering and graphic frame; retain the photographs."""
from pathlib import Path
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('public/store/bfk-dee-cover-v1.webp')
output = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('public/store/bkf-dee-cover-v2.webp')
im = Image.open(source).convert('RGB')
w, h = im.size
assert (w, h) == (1122, 1402)
original = np.asarray(im).copy()
# Only the header and the thin graphic border bands are eligible for recoloring.
region = Image.new('L', im.size, 0)
rd = ImageDraw.Draw(region)
rd.rectangle((0, 0, w, 194), fill=255)
rd.rectangle((0, 0, 30, h), fill=255)
rd.rectangle((1090, 0, w, h), fill=255)
rd.rectangle((0, 1366, w, h), fill=255)
rd.rectangle((25, 197, 819, 1370), outline=255, width=13)
for bounds in [(827,199,1097,410),(827,416,1097,616),(827,624,1097,825),(827,832,1097,997),(827,1003,1097,1172),(827,1180,1097,1350)]:
    rd.rounded_rectangle(bounds, radius=24, outline=255, width=14)
# Warm, saturated graphic highlights become neutral chrome; photographs excluded.
hsv = np.asarray(im.convert('HSV'))
a = np.asarray(im).astype(float)
mask = (np.asarray(region)>0) & (hsv[:,:,0] >= 7) & (hsv[:,:,0] <= 48) & (hsv[:,:,1] > 35)
luma = .2126*a[:,:,0]+.7152*a[:,:,1]+.0722*a[:,:,2]
chrome = np.stack([luma*.93+10, luma*.96+11, luma+15], axis=-1).clip(0,255)
a[mask] = chrome[mask]
im = Image.fromarray(a.astype('uint8'))
d = ImageDraw.Draw(im)
# Replace the original rounded outer frame with an angular double-line frame.
d.rectangle((0,0,29,h), fill='#100a10')
d.rectangle((1092,0,w,h), fill='#100a10')
d.rectangle((0,0,w,21), fill='#100a10')
d.rectangle((0,1373,w,h), fill='#100a10')
frame=[(40,12),(1080,12),(1110,42),(1110,1360),(1080,1390),(40,1390),(12,1360),(12,42)]
d.line(frame+[frame[0]], fill='#bac2cf', width=3, joint='curve')
inset=[(45,21),(1075,21),(1101,47),(1101,1355),(1075,1381),(45,1381),(21,1355),(21,47)]
d.line(inset+[inset[0]], fill='#9c3158', width=3)
# Burgundy inner accents deliberately replace the old gold collection identity.
d.rounded_rectangle((29,200,816,1366), radius=22, outline='#8b274b', width=3)
for bounds in [(831,203,1093,406),(831,420,1093,612),(831,628,1093,821),(831,836,1093,993),(831,1007,1093,1168),(831,1184,1093,1346)]:
    d.rounded_rectangle(bounds, radius=20, outline='#aab4c3', width=2)

font_path='/usr/share/fonts/opentype/urw-base35/NimbusSans-BoldItalic.otf'
label_path='/usr/share/fonts/opentype/urw-base35/NimbusSans-Regular.otf'

def gradient_text(text, box, size, fontfile=font_path):
    x0,y0,x1,y1=box
    font=ImageFont.truetype(fontfile,size)
    while font.getbbox(text)[2]-font.getbbox(text)[0] > x1-x0-12:
        size-=1; font=ImageFont.truetype(fontfile,size)
    bbox=font.getbbox(text)
    tw,th=bbox[2]-bbox[0],bbox[3]-bbox[1]
    x=x0+(x1-x0-tw)//2-bbox[0]
    y=y0+(y1-y0-th)//2-bbox[1]
    alpha=Image.new('L',im.size,0)
    ImageDraw.Draw(alpha).text((x,y),text,font=font,fill=255,stroke_width=1)
    pixels=np.zeros((h,w,3),dtype=np.uint8)
    stops=[(0,'#fbf7ff'),(.37,'#dce2ed'),(.48,'#77818f'),(.56,'#f2f5fc'),(.82,'#b8a0b0'),(1,'#eef0f7')]
    colors=[tuple(bytes.fromhex(c[1:])) for _,c in stops]
    for yy in range(h):
        t=max(0,min(1,(yy-y0)/max(1,y1-y0)))
        for i in range(len(stops)-1):
            if stops[i][0]<=t<=stops[i+1][0]:
                k=(t-stops[i][0])/(stops[i+1][0]-stops[i][0]);pixels[yy,:,:]=[int(colors[i][j]*(1-k)+colors[i+1][j]*k) for j in range(3)];break
    shadow=Image.new('RGB',im.size,'#72203d')
    im.paste(shadow,(0,0),alpha.filter(ImageFilter.GaussianBlur(4)))
    im.paste(Image.fromarray(pixels),(0,0),alpha)

# Reset only the graphic header, then retain the original logo through a luminance mask.
logo = im.crop((40,32,307,144))
logo_mask = logo.convert('L').point(lambda v: max(0, min(255, (v-35)*2)))
d.rectangle((30,22,1091,194), fill='#100c13')
im.paste(logo,(40,32),logo_mask)
gradient_text('BKF Dee',(326,27,1066,145),123)
d=ImageDraw.Draw(im)
subfont=ImageFont.truetype(label_path,25)
subtitle='O U T F I T   P A C K'
subbox=d.textbbox((0,0),subtitle,font=subfont)
d.text((700-(subbox[2]-subbox[0])/2,157),subtitle,font=subfont,fill='#e3d7e0')
d.line((318,174,476,174),fill='#963052',width=2)
d.line((926,174,1073,174),fill='#b7bfcc',width=2)
d=ImageDraw.Draw(im)
plate=[(32,972),(425,972),(455,1002),(455,1198),(425,1220),(32,1220)]
d.polygon(plate,fill='#1b0e18')
d.line(plate+[plate[0]],fill='#bfc6d1',width=2)
d.line([(54,982),(417,982),(444,1008)],fill='#9c3158',width=3)
gradient_text('BKF DEE',(55,1018,443,1125),83)
d=ImageDraw.Draw(im)
label=ImageFont.truetype(label_path,24)
text='O U T F I T   P A C K'; bb=d.textbbox((0,0),text,font=label)
d.text((245-(bb[2]-bb[0])/2,1160),text,font=label,fill='#e7dce6')
d.line((80,1142,419,1142),fill='#9c3158',width=3)
# Guard the face and central full-body photograph against accidental edits.
final=np.asarray(im)
assert np.array_equal(original[230:760,70:440],final[230:760,70:440]), 'Portrait changed'
assert np.array_equal(original[240:950,500:780],final[240:950,500:780]), 'Standing photo changed'
output.parent.mkdir(parents=True,exist_ok=True)
im.save(output,'WEBP',lossless=True,method=6)
print(f'Saved {output}: {w}x{h}, {output.stat().st_size} bytes; portrait and standing photo unchanged')

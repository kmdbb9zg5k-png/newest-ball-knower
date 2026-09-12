"""Validate uploaded prototype artwork against the original approved-input checksums."""
import base64, hashlib, json
from pathlib import Path
from PIL import Image
root=Path('public/solo-characters/v1')
manifest=json.loads((root/'manifest.json').read_text())
# Repair the known transcription typo in the prior uncommitted upload, never substitute a different image.
p=root/'faces.webp'
s=base64.b64encode(p.read_bytes()).decode()
s=s.replace('OBhwUe/FwcYLei8O','OBhwUe/FwYGLei8O')
p.write_bytes(base64.b64decode(s))
errors=[]
for name,item in manifest['files'].items():
    data=(root/name).read_bytes()
    actual=hashlib.sha256(data).hexdigest()
    print(name, len(data), actual, flush=True)
    if len(data)!=item['bytes'] or actual!=item['sha256']:
        errors.append(name+' checksum mismatch')
    try:
        image=Image.open(root/name);image.load();print('decoded',image.size,flush=True)
    except Exception as error:
        errors.append(name+' decode failed: '+str(error))
if errors: raise SystemExit('; '.join(errors))

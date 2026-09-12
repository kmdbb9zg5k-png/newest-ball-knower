"""Read-only integrity and decoder check for the checked-in Solo artwork."""
import hashlib, json
from pathlib import Path
from PIL import Image
root=Path('public/solo-characters/v1')
manifest=json.loads((root/'manifest.json').read_text())
for name,item in manifest['files'].items():
    data=(root/name).read_bytes()
    actual=hashlib.sha256(data).hexdigest()
    assert len(data)==item['bytes'] and actual==item['sha256'], name+' checksum mismatch'
    image=Image.open(root/name);image.load()
    print(name, len(data), actual, image.size, flush=True)

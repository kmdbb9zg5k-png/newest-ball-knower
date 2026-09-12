"""Verify prototype image integrity; a known one-byte upload error is repaired only against its exact checksum."""
import hashlib, json
from pathlib import Path
from PIL import Image
root=Path('public/solo-characters/v1')
manifest=json.loads((root/'manifest.json').read_text())
p=root/'faces.webp'
data=bytearray(p.read_bytes())
if hashlib.sha256(data).hexdigest()=='fb8969d12a86d752782cac202acb5530fac2330cf97253d00dff098ca1957383':
    assert data[1759]==193
    data[1759]=129
    assert hashlib.sha256(data).hexdigest()==manifest['files']['faces.webp']['sha256']
    p.write_bytes(data)
for name,item in manifest['files'].items():
    data=(root/name).read_bytes()
    actual=hashlib.sha256(data).hexdigest()
    assert len(data)==item['bytes'] and actual==item['sha256'], name+' checksum mismatch'
    image=Image.open(root/name);image.load()
    print(name, len(data), actual, image.size, flush=True)

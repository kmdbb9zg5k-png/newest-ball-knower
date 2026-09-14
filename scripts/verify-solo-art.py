"""Read-only integrity, dimensions, and decoder check for reviewed local v4 art."""
import hashlib
import json
from pathlib import Path
from PIL import Image

art_root=Path('public/solo-characters/v2')
expected={
    'avatar.webp':(96,96),'row.webp':(160,200),'card.webp':(384,480),
    'portrait.webp':(640,800),'full-body.webp':(768,1152),
}
manifests=sorted(art_root.rglob('manifest.json'))
assert len(manifests)==23, f'Expected 19 reviewed league identities and four My Player presets, found {len(manifests)}'
for manifest_path in manifests:
    root=manifest_path.parent
    manifest=json.loads(manifest_path.read_text())
    assert manifest['artVersion']==4 and manifest['visualReview']=='approved', root
    assert manifest['sourcePortrait'][0] >= 512 and manifest['sourcePortrait'][1] >= 640, root
    assert manifest['sourceFullBody'][0] >= 768 and manifest['sourceFullBody'][1] >= 1536, root
    for name,size in expected.items():
        item=manifest['files'][name]
        data=(root/name).read_bytes()
        actual=hashlib.sha256(data).hexdigest()
        assert len(data)==item['bytes'] and actual==item['sha256'], str(root/name)+' checksum mismatch'
        image=Image.open(root/name);image.load()
        assert image.size==size, f'{root/name}: expected {size}, found {image.size}'
    assert not list(root.glob('source-*')), f'High-resolution source leaked into public bundle: {root}'
    print(root.relative_to(art_root), 'approved', flush=True)

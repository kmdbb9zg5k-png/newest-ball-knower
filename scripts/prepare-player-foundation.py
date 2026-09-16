"""Retrieve specifically reviewed CC0 art inputs for offline player-model work.
This is a development-only intake tool, not an app/runtime dependency. It never
executes third-party code, downloads a mutable branch, or uses account secrets.
"""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

REVISION='a8bc2d54ff0ac92e78ff71431b1023eda42bf482'
BASE=f'https://raw.githubusercontent.com/makehumancommunity/makehuman/{REVISION}/'
FILES={
 'makehuman/data/3dobjs/base.obj':'d26635e9326e3cca30778fd7b9c00062b03cce09',
 'makehuman/data/targets/macrodetails/caucasian-male-young.target':'c3b82f92c5ced85599199cd184b0faf3b3fc6881',
 'makehuman/data/targets/macrodetails/african-male-young.target':'dd5743e48700267d76596f575bf17b4b5cc3b3e0',
 'LICENSE.md':'5d1a49d31ebdaa46b06c52eae2c005c678a63ffa',
 'LICENSE.ASSETS.md':'f3ede1fc3318f8d794e2cb51924186c62f02f71a',
}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,default=Path('artifacts/player-foundation'))
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    report={'source':'MakeHuman core graphical assets only','revision':REVISION,'license':'CC0-1.0 (not MakeHuman application code)','runtimeIntegrated':False,'files':[]}
    for path,expected in FILES.items():
        url=BASE+path
        with urlopen(Request(url,headers={'User-Agent':'Ball-Knower-art-intake'}),timeout=30) as response:
            data=response.read(4_000_001)
        if len(data)>4_000_000: raise ValueError(f'Asset exceeds intake limit: {path}')
        got=hashlib.sha1(f'blob {len(data)}\0'.encode()+data).hexdigest()
        if got!=expected: raise ValueError(f'Pinned asset hash mismatch: {path}')
        text=data.decode('utf-8')
        if path.endswith(('.obj','.target')) and 'released as CC0' not in text[:2000]:
            raise ValueError(f'Explicit asset license header missing: {path}')
        (args.output/Path(path).name).write_bytes(data)
        report['files'].append({'path':path,'url':url,'gitBlob':got,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
    obj=(args.output/'base.obj').read_text()
    report['vertices']=sum(line.startswith('v ') for line in obj.splitlines())
    report['faces']=sum(line.startswith('f ') for line in obj.splitlines())
    report['groups']=[line[2:] for line in obj.splitlines() if line.startswith('g ')]
    (args.output/'provenance.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()

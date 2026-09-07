"""Read public Commons metadata for existing image entries; never grants rights itself."""
import datetime,json,re,sys,urllib.request,urllib.parse
from pathlib import Path
out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
text=Path('licensedPlayerPortraits.ts').read_text()
urls=re.findall(r"sourceUrl:\s*'([^']+)'",text)
titles=[urllib.parse.unquote(u.split('/wiki/')[1]).replace('_',' ') for u in urls]
params={'action':'query','format':'json','prop':'imageinfo','iiprop':'url|extmetadata|sha1','titles':'|'.join(titles),'redirects':'1'}
url='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params)
request=urllib.request.Request(url,headers={'User-Agent':'BallKnower-LicenseAudit/1.0 (BallKnowerOfficial@gmail.com)'})
result={'requestedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceUrls':urls,'requestUrl':url}
try:
    with urllib.request.urlopen(request,timeout=35) as response:
        result['status']=response.status;result['metadata']=json.load(response)
except Exception as error:result['error']=str(error)
(out/'commons-metadata.json').write_text(json.dumps(result,indent=2))
print('Photo metadata entries requested:',len(urls),'status:',result.get('status'),result.get('error'))

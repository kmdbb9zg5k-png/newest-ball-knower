"""Build reproducible, independent football inputs. Never reads legacy ratings/artwork.

Usage: python scripts/build-independent-football-data.py SOURCE_DIR
SOURCE_DIR holds the explicit nflverse CSV releases and their retrieval manifest.
The identity crosswalk contains only pre-existing IDs/names/team/position for save compatibility.
"""
import csv
import hashlib
import json
import math
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1])
SEASON = 2026
VALID_TEAMS = set('ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LV LAC LAR MIA MIN NE NO NYG NYJ PHI PIT SF SEA TB TEN WAS'.split())
TEAM_ALIASES = {'LA': 'LAR', 'JAC': 'JAX', 'WSH': 'WAS'}
STAT_KEYS = ['games','attempts','completions','passing_yards','passing_tds','passing_interceptions','passing_epa','passing_first_downs','carries','rushing_yards','rushing_tds','rushing_first_downs','rushing_fumbles_lost','targets','receptions','receiving_yards','receiving_tds','receiving_first_downs','receiving_fumbles_lost','sack_fumbles_lost','def_tackles_solo','def_tackle_assists','def_tackles_for_loss','def_sacks','def_qb_hits','def_interceptions','def_pass_defended','def_fumbles_forced','fg_made','fg_att','fg_missed','pat_made','pat_missed','pt_att','pt_net_yards','fantasy_points','fantasy_points_ppr','passing_2pt_conversions','rushing_2pt_conversions','receiving_2pt_conversions']

def norm(s):
    return re.sub(r'[^a-z0-9]', '', re.sub(r'\b(jr|sr|ii|iii|iv|v)\b', '', unicodedata.normalize('NFKD', s).lower()))

def num(v, default=0):
    try:
        result = float(v)
        return result if math.isfinite(result) else default
    except (ValueError,TypeError):
        return default

def team(s): return TEAM_ALIASES.get(s,s)
def family(pos):
    if pos in ['T','G','C','OL','OT','OG','LT','RT','LG','RG']:return 'OL'
    if pos in ['DB','CB','FS','SS','S']:return 'DB'
    if pos in ['DE','DL','DT','NT','LDE','RDE','EDGE','LB','OLB','MLB','ILB']:return 'DEF'
    if pos in ['FB','RB']:return 'RB'
    return pos

def csv_rows(file):
    with (SOURCE/file).open(encoding='utf-8-sig',newline='') as stream:return list(csv.DictReader(stream))

rosters=csv_rows('roster_2026.csv')
assert rosters and all(int(r['season'])==SEASON for r in rosters)
stats=csv_rows('stats_player_reg_2025.csv')
assert stats and all(r['season']=='2025' and r['season_type']=='REG' for r in stats)
# The collected depth CSV can include a bounded prefix of its long snapshot history.
# We use ONLY a complete latest snapshot, never a partially read older snapshot.
depth_all=csv_rows('depth_charts_2026.csv')
latest=max(r['dt'] for r in depth_all if r.get('dt'))
depth=[r for r in depth_all if r.get('dt')==latest]
assert len(depth)>1800 and {team(r['team']) for r in depth}==VALID_TEAMS
for ab in VALID_TEAMS:
    dr=[r for r in depth if team(r['team'])==ab]
    assert len(dr)>=45,('incomplete latest depth chart',ab)
    assert any(r['pos_abb']=='QB' and num(r['pos_rank'])==1 for r in dr),('missing starting QB',ab)

legacy=json.loads((ROOT/'data/legacy-player-identities.json').read_text())
assert len(legacy)>2000 and len({r['id'] for r in legacy})==len(legacy)
legacy_by=defaultdict(list)
for r in legacy:legacy_by[norm(r['name'])].append(r)
assert len({r['player_id'] for r in stats}) == len(stats), 'Season stats must be unique per player'
stats_by={r['player_id']:r for r in stats if r['player_id']}
history=csv_rows('roster_2025.csv')+csv_rows('roster_2024.csv')
historical_teams=defaultdict(set)
for h in history:
    if h['gsis_id']:historical_teams[h['gsis_id']].add(team(h['team']))
roster_by_gsis={r['gsis_id']:r for r in rosters if r['gsis_id']}
roster_by_espn={r['espn_id']:r for r in rosters if r['espn_id']}
depth_by=defaultdict(list)
for d in depth:
    linked=roster_by_espn.get(d['espn_id'],{})
    key=linked.get('gsis_id') or d['gsis_id'] or ('espn:'+d['espn_id'] if d['espn_id'] else '')
    if key:depth_by[key].append(d)
# A few documented public-name variants not expressible using roster first/football names.
# Every accepted legacy match still needs a compatible position and a unique candidate.
ALIASES={'Cameron Heyward':['Cam Heyward'],'Andru Phillips':['Dru Phillips'],
 'Josh Palmer':['Joshua Palmer'],'Andy Borregales':['Andres Borregales'],
 'Francisco Mauigoa':['Kiko Mauigoa'],'Nicholas Singleton':['Nick Singleton'],
 'Tedarrell Slaton':['T.J. Slaton'],'Julius Brents':['JuJu Brents'],
 'Cameron Sample':['Cam Sample'],'Oli Udoh':['Olisaemeka Udoh']}

source_rows={}
for r in rosters:
    key=r['gsis_id'] or ('espn:'+r['espn_id'] if r['espn_id'] else '')
    if not key or team(r['team']) not in VALID_TEAMS:continue
    source_rows[key]=dict(r)
# Latest depth also covers players temporarily absent from a season roster export.
for key,ds in depth_by.items():
    if key in source_rows:continue
    d=ds[0]
    sr=stats_by.get(d['gsis_id'],{})
    source_rows[key]={'gsis_id':d['gsis_id'],'espn_id':d['espn_id'],'full_name':d['player_name'],
       'team':d['team'],'depth_chart_position':d['pos_abb'],'position':sr.get('position',d['pos_abb']),
       'status':'DEPTH','first_name':'','last_name':'','football_name':'','draft_number':'','years_exp':''}

# Resolve duplicate public names against BOTH current and historical factual teams.
# One-to-one assignment is decided before iteration, not by whichever row appears first.
candidates=defaultdict(list)
for key,r in source_rows.items():
    ds=depth_by.get(key,[])
    variants={r['full_name'],' '.join([r.get('football_name',''),r.get('last_name','')]).strip(),
              ' '.join([r.get('first_name',''),r.get('last_name','')]).strip(),*ALIASES.get(r['full_name'],[])}
    variants.update(d['player_name'] for d in ds)
    for old in {v['id']:v for alias in variants if alias for v in legacy_by.get(norm(alias),[]) if family(v['position'])==family(r['depth_chart_position'] or r['position'])}.values():
        current_teams={team(r['team']),*(team(d['team']) for d in ds)}
        score=3 if old['team'] in current_teams else 2 if old['team'] in historical_teams.get(r['gsis_id'],set()) else 1
        candidates[old['id']].append((score,key))
assigned={}
for pid,rows in candidates.items():
    best=max(score for score,key in rows)
    winners=[key for score,key in rows if score==best]
    if len(winners)==1: assigned[pid]=winners[0]

used_legacy=set(); output=[]; starter_names={}; identity_matches=[]
for key,r in sorted(source_rows.items()):
    if not r['full_name'] or r['depth_chart_position']=='LS':continue  # App has no long-snapper slot.
    ds=[d for d in depth_by.get(key,[]) if d['pos_abb'] not in ['LS','H','KR','PR']]
    depth_teams={team(d['team']) for d in ds}
    if len(depth_teams)>1:raise ValueError(('ambiguous current depth team',key))
    ab=next(iter(depth_teams)) if depth_teams else team(r['team'])
    name=r['full_name']; rawpos=r['depth_chart_position'] or r['position']
    variants={name,' '.join([r.get('football_name',''),r.get('last_name','')]).strip(),
              ' '.join([r.get('first_name',''),r.get('last_name','')]).strip(),*ALIASES.get(name,[])}
    variants.update(d['player_name'] for d in ds)
    matches={v['id']:v for alias in variants if alias for v in legacy_by.get(norm(alias),[])
             if family(v['position'])==family(rawpos) and assigned.get(v['id'])==key}
    # Preserve IDs across transfers. If names collide, a matching team only
    # resolves them when it leaves exactly one candidate. Never nearest-name match.
    if len(matches)>1:matches={k:v for k,v in matches.items() if v['team']==ab}
    if len(matches)>1:raise ValueError(('ambiguous legacy player',name,list(matches)))
    old=next(iter(matches.values()),None)
    if old and old['id'] in used_legacy:raise ValueError(('duplicate identity match',old['id'],name))
    if old:used_legacy.add(old['id'])
    # Keep existing split positions where compatible, avoiding breaking lineup slots.
    mapped={'T':'OT','G':'OG','OL':'OT','OLB':'LB','ILB':'LB','MLB':'LB',
            'DL':'DT','LDE':'EDGE','RDE':'EDGE','DE':'EDGE','DB':'CB','SS':'SS','FS':'FS'}
    pos=old['position'] if old else mapped.get(rawpos,rawpos)
    if pos not in 'QB RB FB WR TE OT LT RT OG LG RG C EDGE DE DT NT LB CB FS SS S K P'.split():continue
    rank=min([int(num(d['pos_rank'],9)) for d in ds] or [9])
    active=r['status'] in ['ACT','DEV','RES','DEPTH'] or bool(ds)
    if r.get('status_description_abbr')=='R02':active=False
    if r['status']=='RET' and not ds:active=False
    pid=old['id'] if old else 'bk-'+key.replace(':','-')
    sr=stats_by.get(r['gsis_id'],{})
    reduced={k:round(num(sr.get(k)),4) for k in STAT_KEYS if sr.get(k) not in [None,''] and num(sr.get(k))!=0}
    row={'id':pid,'gsisId':r['gsis_id'] or None,'providerId':r['espn_id'] or None,
         'name':old['name'] if old else name,'sourceName':name,'team':ab,'position':pos,
         'active':active,'depth':rank if rank<9 else None,'experience':num(r.get('years_exp'),None),
         'draftPick':num(r.get('draft_number'),None),'rosterStatus':r['status'],'stats':reduced}
    output.append(row)
    if old:identity_matches.append({'id':pid,'sourceId':key,'name':name})
    if pos=='QB' and rank==1:starter_names[ab]=row['name']
# Preserve every old ID in an explicit non-draftable archive. Never retain old
# OVR, salary or attribute values in this identity-only data source.
for r in legacy:
    if r['id'] in used_legacy:continue
    output.append({**r,'sourceName':r['name'],'gsisId':None,'providerId':None,'active':False,
                   'depth':None,'experience':None,'draftPick':None,'rosterStatus':'LEGACY_ARCHIVE','stats':{}})
assert len({r['id'] for r in output})==len(output)
assert all(r['id'] in {a['id'] for a in output} for r in legacy)
assert set(starter_names)==VALID_TEAMS,('missing starters',VALID_TEAMS-set(starter_names))
active=[r for r in output if r['active']]
assert len(active)>2000
(ROOT/'docs/rights').mkdir(parents=True,exist_ok=True)
(ROOT/'data/independent-football-inputs.json').write_text(json.dumps(output,separators=(',',':'))+'\n')
(ROOT/'data/current-qb-starters.json').write_text(json.dumps(starter_names,indent=2)+'\n')
manifest=json.loads((SOURCE/'manifest.json').read_text())
evidence={'version':1,'rosterSeason':SEASON,'statsSeason':2025,'depthSnapshot':latest,
 'inputs':[{k:r[k] for k in ['file','source','retrievedAt','sha256','bytes'] if k in r}
           for r in manifest if r['file'].endswith('.csv') or r['file']=='LICENSE.md'],
 'license':'CC BY 4.0','licenseUrl':'https://creativecommons.org/licenses/by/4.0/',
 'attribution':'nflverse contributors; normalized and modified by Ball Knower.',
 'limitations':['No third-party artwork is imported. Data licensing does not clear publicity or trademark uses.',
               'Depth input is a bounded history prefix; only its complete latest 32-team snapshot was selected.',
               'Unmatched legacy identities are retained only for saved-data lookup, not new drafts.'],
 'activePlayers':len(active),'knownPlayers':len(output),'preservedLegacyIds':len(legacy),
 'matchedLegacyIds':len(used_legacy),'archivedUnmatchedLegacyIds':len(legacy)-len(used_legacy),
 'historicalIdentitySources':json.loads((SOURCE/'historical-manifest.json').read_text()),
 'inputSha256':hashlib.sha256((ROOT/'data/independent-football-inputs.json').read_bytes()).hexdigest()}
(ROOT/'docs/rights/nflverse-data-evidence.json').write_text(json.dumps(evidence,indent=2)+'\n')
(ROOT/'docs/rights/NFLVERSE_LICENSE.md').write_text((SOURCE/'LICENSE.md').read_text())
print(json.dumps({k:v for k,v in evidence.items() if k not in ['inputs','limitations']},indent=2))

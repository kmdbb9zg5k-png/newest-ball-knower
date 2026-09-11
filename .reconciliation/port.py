from pathlib import Path
import json, re, hashlib, os, shutil
root=Path(os.environ['BK_ROOT'])
old187=Path(os.environ['BK_OLD187'])
old188=Path(os.environ['BK_OLD188'])
payload=Path(__file__).parent/'files'
def replace_once(text, old, new):
    assert text.count(old)==1, (old[:150],text.count(old))
    return text.replace(old,new,1)
def blob_sha(path):
    data=path.read_bytes()
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
# Only files proven unchanged from the older work's base are replaced in full.
assert blob_sha(root/'fantasyDraftReport.ts').startswith('20626681')
assert blob_sha(root/'fantasyLiveScoring.ts')=='1117a14943c5d90e203279108a35cae617c3d4c0'
assert blob_sha(root/'scripts/fantasy-live-scoring-reliability-check.ts')=='2769f140fcf9256d4df5676b673d023af4e8899b'
for source in payload.rglob('*'):
    if source.is_file():
        target=root/source.relative_to(payload)
        assert not target.exists(), f'New payload would overwrite {target}'
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(source,target)

engine=(old187/'fantasyDraftReport.ts').read_text()
engine=replace_once(engine,'const MIN_MEANINGFUL_BENCH_SPREAD = 12;', 'const MIN_MEANINGFUL_BENCH_SPREAD = 12;\nconst MIN_MEANINGFUL_ROSTER_SPREAD = 12;')
engine=replace_once(engine,'  const games = Math.max(1, Math.round(regularSeasonGames));','  const games = Number.isFinite(regularSeasonGames) ? clamp(Math.round(regularSeasonGames), 1, 18) : 14;')
engine=replace_once(engine,'  const scale = Math.max(1, deviation * 1.35);','  const meaningfulDeviation = Math.max(MIN_MEANINGFUL_ROSTER_SPREAD, Math.abs(mean) * 0.01, deviation);\n  const scale = meaningfulDeviation * 1.35;')
engine=replace_once(engine,'86 + (deviation > 0.001 ? (snapshot.strength - mean) / deviation : 0) * 6.5','86 + ((snapshot.strength - mean) / meaningfulDeviation) * 6.5')
engine=replace_once(engine, '    previousValue = value;\n    previousRank = rank;', '    if (rank !== previousRank || previousValue === null) previousValue = value;\n    previousRank = rank;')
engine=replace_once(engine, "`${coveragePercent}% of this roster's drafted slots and ${starterCoveragePercent}% of its occupied starter/FLEX slots have projection data; coverage across league drafted slots is ${leagueCoveragePercent}% overall and ${leagueStarterCoveragePercent}% across occupied starter/FLEX slots. Missing comparison data lowers confidence in exact league-relative ranks, the grade, and projected record.`", "`${coveragePercent}% of this roster has projection data; occupied starter/FLEX projection coverage is ${starterCoveragePercent}%. For league comparisons, coverage is ${leagueCoveragePercent}% overall and ${leagueStarterCoveragePercent}% across occupied starter/FLEX slots. Missing comparison data lowers confidence in exact ranks, the grade, and projected record.`")
engine=replace_once(engine,"        benchScore >= 83\n          ? `${benchQuality} bench depth supports the starting lineup.`\n          : 'Roster strength is balanced without one dominant position group.',", "        snapshot.coverage === 0\n          ? 'Projection data is unavailable; positional strengths cannot be assessed.'\n          : benchScore >= 83\n            ? `${benchQuality} bench depth supports the starting lineup.`\n            : 'No position group separates from the league on available projections.',")
(root/'fantasyDraftReport.ts').write_text(engine)
(root/'scripts/fantasy-draft-report-edge-check.ts').write_text((old187/'scripts/fantasy-draft-report-edge-check.ts').read_text())
(root/'docs/tasks/2026-09-02-fantasy-draft-report-depth.md').write_text((old187/'docs/tasks/2026-09-02-fantasy-draft-report-depth.md').read_text())

# Surgical edits preserve current avatars, navigation, recovery and roster handoff.
ui=(root/'LeagueLiveDraftRoom.tsx').read_text()
ui="import { FantasyDraftAnalysis } from './FantasyDraftAnalysis';\n"+ui
ui=replace_once(ui,'{myGrade.explanation}</p></div>','{myGrade.explanation}</p><FantasyDraftAnalysis report={myGrade}/></div>')
ui=replace_once(ui,'{report.explanation}</p></div></div><div className="mt-2 grid grid-cols-3','{report.explanation}</p></div></div><FantasyDraftAnalysis report={report}/><div className="mt-2 grid grid-cols-4')
ui=replace_once(ui,'{report.valueScore}</b></div></div></div>', '{report.valueScore}</b></div><div><div className="text-[7px] font-black uppercase text-zinc-600">Bench</div><b className="text-[10px]">{report.benchScore}</b></div></div></div>')
(root/'LeagueLiveDraftRoom.tsx').write_text(ui)

scoring=(old188/'fantasyLiveScoring.ts').read_text()
scoring=replace_once(scoring,"    if (value !== undefined && value !== null && value !== '') return numeric(value);\n  }\n  return undefined;", "    if (typeof value !== 'number' && typeof value !== 'string') continue;\n    if (typeof value === 'string' && !value.trim()) continue;\n    const parsed = Number(value);\n    if (Number.isFinite(parsed)) return parsed;\n  }\n  return undefined;")
scoring=replace_once(scoring,'return madeValue===undefined&&missedValue===undefined?undefined:(madeValue||0)+(missedValue||0);','return madeValue===undefined||missedValue===undefined?undefined:madeValue+missedValue;')
scoring=replace_once(scoring,'passing.passCompletions,passing.completions,passing.cmp,raw.passCompletions,raw.completions','passing.passCompletions,passing.passingCompletions,passing.completions,passing.cmp,raw.passCompletions,raw.passingCompletions,raw.completions')
needle='  const xpMissedSource=kicking.xpMissed??kicking.extraPointsMissed??raw.xpMissed??raw.extraPointsMissed;'
scoring=replace_once(scoring,needle,needle+"\n  const fieldGoalsAttempted=optionalFirstNumber(kicking.fgAttempts,kicking.fgAtt,kicking.fieldGoalsAttempted,raw.fgAttempts,raw.fieldGoalsAttempted)??attemptedFromKnownParts(fgMadeSource,fgMissedSource);\n  const extraPointsAttempted=optionalFirstNumber(kicking.xpAttempts,kicking.xpAtt,kicking.extraPointsAttempted,raw.xpAttempts,raw.extraPointsAttempted)??attemptedFromKnownParts(xpMadeSource,xpMissedSource);")
scoring=replace_once(scoring,'...(attemptedFromKnownParts(fgMadeSource,fgMissedSource)===undefined?{}:{fieldGoalsAttempted:attemptedFromKnownParts(fgMadeSource,fgMissedSource)})','...(fieldGoalsAttempted===undefined?{}:{fieldGoalsAttempted})')
scoring=replace_once(scoring,'...(attemptedFromKnownParts(xpMadeSource,xpMissedSource)===undefined?{}:{extraPointsAttempted:attemptedFromKnownParts(xpMadeSource,xpMissedSource)})','...(extraPointsAttempted===undefined?{}:{extraPointsAttempted})')
(root/'fantasyLiveScoring.ts').write_text(scoring)
api=(root/'api/fantasy-live-scoring.ts').read_text()
typeblock=scoring[scoring.index('export type FantasyStatLine'):scoring.index('export type DefenseStatLine')].replace('export type','type')
a=api.index('type FantasyStatLine'); b=api.index('type DefenseStatLine')
api=api[:a]+typeblock+api[b:]
helper=scoring[scoring.index('const optionalFirstNumber'):scoring.index('export function normalizeScoringFormat')]
a=api.index('function normalizeTank01PlayerStats'); b=api.index('function normalizeTank01DefenseStats')
fn=scoring[scoring.index('export function normalizeTank01PlayerStats'):scoring.index('export function normalizeTank01DefenseStats')].replace('export function','function').replace('sum+numeric(value)','sum+coreNumeric(value)')
api=api[:a]+helper+fn+api[b:]
(root/'api/fantasy-live-scoring.ts').write_text(api)
(root/'scripts/fantasy-live-scoring-reliability-check.ts').write_text((old188/'scripts/fantasy-live-scoring-reliability-check.ts').read_text())
(root/'docs/tasks/2026-09-02-fantasy-player-data-completeness.md').write_text((old188/'docs/tasks/2026-09-02-fantasy-player-data-completeness.md').read_text())

detail=(root/'FantasyPlayerDetail.tsx').read_text()
detail="import { canonicalGameLogStats, gameLogColumns, GAME_LOG_STAT_KEYS as DEFAULT_STAT_KEYS, GAME_LOG_STAT_LABELS as STAT_LABELS } from './fantasyGameLogStats';\n"+detail
a=detail.index('const STAT_LABELS:'); b=detail.index('const statLabel',a)
detail=detail[:a]+detail[b:]
a=detail.index('const DEFAULT_STAT_KEYS:'); b=detail.index('const formatStat',a)
detail=detail[:a]+detail[b:]
detail=replace_once(detail,'() => weeks.filter(row => row.season === season).sort((a, b) => a.week - b.week),\n    [weeks, season],',"() => weeks.filter(row => row.season === season).map(row => ({ ...row, stats: canonicalGameLogStats(row.stats, player?.position || row.position) })).sort((a, b) => a.week - b.week),\n    [weeks, season, player?.position],")
a=detail.index('  const gameLogStatKeys = useMemo('); b=detail.index('  const seasonStats = useMemo(',a)
detail=detail[:a]+"  const gameLogStatKeys = useMemo(\n    () => gameLogColumns(player?.position || '', visible.map(week => week.stats)),\n    [visible, player?.position],\n  );\n"+detail[b:]
detail=replace_once(detail,"    return [...totals.entries()]\n      .filter(([, value]) => value !== 0)\n      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))\n      .slice(0, 12);", "    return gameLogColumns(player?.position || '', finals.map(week => week.stats))\n      .filter(key => totals.has(key))\n      .map(key => [key, totals.get(key)!] as [string, number]);")
detail=replace_once(detail,'  }, [finals]);','  }, [finals, player?.position]);')
detail=replace_once(detail,'const columns = statKeys.length ? statKeys : (DEFAULT_STAT_KEYS[position] || []).slice(0, 6);','const columns = statKeys.length ? statKeys : (DEFAULT_STAT_KEYS[position] || []);')
detail=replace_once(detail,'{formatKickoff(week.kickoffAt)}</div>}','{[formatKickoff(week.kickoffAt), week.status].filter(Boolean).join(\' · \')}</div>}')
(root/'FantasyPlayerDetail.tsx').write_text(detail)

package=json.loads((root/'package.json').read_text())
scripts=package['scripts']
scripts['check:transaction-worker']='node --import tsx scripts/transaction-worker-reliability-check.ts'
scripts['check:fantasy-draft-report']='node --import tsx scripts/fantasy-draft-report-edge-check.ts && node --import tsx scripts/fantasy-draft-report-depth-check.ts'
scripts['check:fantasy-player-data-completeness']='node --import tsx scripts/fantasy-player-data-completeness-check.ts'
scripts['check:fantasy-reconciliation-browser']='node scripts/fantasy-reconciliation-browser-check.mjs'
scripts['check:hardening-core']=scripts['check:hardening-core'].replace('npm run check:fantasy-transactions &&','npm run check:fantasy-transactions && npm run check:transaction-worker &&').replace('npm run check:fantasy-live-scoring &&','npm run check:fantasy-live-scoring && npm run check:fantasy-player-data-completeness &&').replace('npm run check:fantasy-ui &&','npm run check:fantasy-ui && npm run check:fantasy-draft-report &&')
(root/'package.json').write_text(json.dumps(package,indent=2)+'\n')
workflow=(root/'.github/workflows/hardening.yml').read_text()
workflow=replace_once(workflow,'      - name: Fantasy transactions\n', '      - name: Transaction worker timeout and replay regression\n        run: npm run check:transaction-worker\n      - name: Canonical player game-log completeness\n        run: npm run check:fantasy-player-data-completeness\n      - name: Detailed draft report regression\n        run: npm run check:fantasy-draft-report\n      - name: Fantasy transactions\n')
workflow=replace_once(workflow,'      - name: Upload mobile screenshots\n', '      - name: Exercise reconciled draft reports and all player game logs\n        run: npm run check:fantasy-reconciliation-browser\n      - name: Upload reconciliation screenshots\n        if: always()\n        uses: actions/upload-artifact@v4\n        with:\n          name: fantasy-reconciliation-ui\n          path: artifacts/fantasy-reconciliation\n          if-no-files-found: ignore\n          retention-days: 7\n      - name: Upload mobile screenshots\n')
(root/'.github/workflows/hardening.yml').write_text(workflow)
print('Reconciled targeted draft report and game-log changes without replacing newer UI or existing scoring/identity flows.')

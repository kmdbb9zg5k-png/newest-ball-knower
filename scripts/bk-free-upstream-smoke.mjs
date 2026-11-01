/** Verify upstream release downloads, not just sample fixtures. No credentials. */
const sources={
 games:'https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv',
 players:'https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_2026.csv',
 injuries:'https://github.com/nflverse/nflverse-data/releases/download/injuries/injuries_2026.csv'
};
for(const [kind,url] of Object.entries(sources)){
 const response=await fetch(url,{signal:AbortSignal.timeout(25000),headers:{Accept:'text/csv'}});
 if(!response.ok)throw new Error(kind+' returned HTTP '+response.status);
 const body=await response.text();
 if(!body.includes('2026')||!body.includes(','))throw new Error(kind+' missing expected CSV data');
 console.log(kind+' source reachable ('+body.length+' bytes)');
}

from pathlib import Path
r=Path.cwd()
def replace(file,old,new):
 p=r/file;s=p.read_text();assert s.count(old)==1,(file,s.count(old),old[:100]);p.write_text(s.replace(old,new))
p=r/'solo/appearance.ts';s=p.read_text();assert 'export function sameAppearance(' not in s
s+='''
/** Shared identity for save detection and render invalidation, including tattoo-only edits. */
export function appearanceRenderKey(look: Appearance): string {
  return JSON.stringify(Object.keys(look).sort().map(key => [key, look[key as keyof Appearance]]));
}
export function sameAppearance(first: Appearance, second: Appearance): boolean {
  return appearanceRenderKey(first) === appearanceRenderKey(second);
}
''';p.write_text(s)
replace('solo/SoloPlayerProfile.tsx','saveAppearance,SleeveStyle,','saveAppearance,sameAppearance,TattooCoverage,TattooStyle,SleeveStyle,')
p=r/'solo/SoloPlayerProfile.tsx';s=p.read_text();a=s.index('const sameLook=');b=s.index('\n',a);s=s[:a]+'const sameLook=sameAppearance;'+s[b:];p.write_text(s)
replace('solo/SoloPlayerProfile.tsx','            <fieldset><legend>Arm gear</legend>','''            <fieldset><legend>Tattoo coverage</legend><div className="bk-solo-choice-stack">{(['none','minimal','upper-arm','forearm','half-sleeve','full-sleeve','both-arms'] as TattooCoverage[]).map(tattooCoverage=><button key={tattooCoverage} type="button" aria-pressed={draft.tattooCoverage===tattooCoverage} onClick={()=>setDraft(value=>({...value,tattooCoverage}))}>{tattooCoverage.replaceAll('-',' ')}</button>)}</div></fieldset>
            <fieldset><legend>Tattoo style</legend><div className="bk-solo-choice-stack">{(['blackwork','geometric','script','traditional','mixed'] as TattooStyle[]).map(tattooStyle=><button key={tattooStyle} type="button" aria-pressed={draft.tattooStyle===tattooStyle} onClick={()=>setDraft(value=>({...value,tattooStyle}))}>{tattooStyle}</button>)}</div></fieldset>
            <fieldset><legend>Arm gear</legend>''')
replace('solo/SoloPresentation.tsx','CREATOR_EASTER_EGG_ID,readAppearance,','CREATOR_EASTER_EGG_ID,appearanceRenderKey,readAppearance,')
replace('solo/SoloPresentation.tsx','look.face,look.hair,look.facialHair,look.eyeBlack,look.build,look.number,look.sleeves,look.gloves,variant,helmet,retry','appearanceRenderKey(look),variant,helmet,retry')
replace('solo/SoloPresentation.tsx','return()=>{records.current.delete(owner);};','return()=>{records.current.delete(owner);setRevision(n=>n+1);};')
replace('solo/SoloPresentation.tsx',"  const [failed,setFailed]=useState(false);\n  if(player.id===CREATOR_EASTER_EGG_ID&&face===undefined){","  const [failed,setFailed]=useState(false);\n  useEffect(()=>setFailed(false),[player.id,selected]);\n  if(player.id===CREATOR_EASTER_EGG_ID&&face===undefined){")
replace('solo/SoloPresentation.tsx',"style={{backgroundImage:`url(${ELI_FACE})`,backgroundSize:'cover',backgroundPosition:'50% 24%',backgroundRepeat:'no-repeat'}}/>;",'''>{!failed?<img src={ELI_FACE} alt="" loading="lazy" decoding="async" width="192" height="240" onError={()=>setFailed(true)} style={{left:0,top:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:'50% 24%'}}/>:<span className="bk-solo-art-fallback">BK</span>}</span>;''')
(r/'solo/presentationPlayer.ts').write_text('''import type { Player } from '../types';
import { SOLO_TEAM_THEMES } from '../soloUniverse';

/** A view-only copy. Keep the player ID, ratings, salary and appearance stable after a trade. */
export function playerOnSoloTeam(player: Player, teamAbbr?: string): Player {
  if (!teamAbbr || teamAbbr === player.team) return player;
  const team = SOLO_TEAM_THEMES.find(item => item.abbr === teamAbbr);
  if (!team) return player; // Invalid legacy team codes must not introduce real-team art.
  return {
    ...player,
    team: team.abbr,
    teamId: team.abbr,
    teamAbbreviation: team.abbr,
    teamName: team.name,
    teamCity: team.name.split(' ').slice(0, -1).join(' '),
  };
}
''')
replace('PlayerAgentMode.tsx',"import {SoloPlayerIdentity,SoloPlayerLink,SoloPortrait,SoloQuickView} from './solo/SoloPresentation';","import {SoloPlayerIdentity,SoloPlayerLink,SoloPortrait,SoloQuickView} from './solo/SoloPresentation';\nimport {playerOnSoloTeam} from './solo/presentationPlayer';")
replace('PlayerAgentMode.tsx','''        .filter((x): x is { client: Client; player: Player } =>
          Boolean(x.player),
        ),''','''        .filter((x): x is { client: Client; player: Player } =>
          Boolean(x.player),
        )
        .map(({client,player}) => ({client,player:playerOnSoloTeam(player,client.currentTeam)})),''')
(r/'solo/tattooMask.ts').write_text('''/** Restrict procedural ink to visible skin using the existing material and body alpha masks. */
export function maskTattooInk(
  ink: Uint8ClampedArray,
  regions: Uint8ClampedArray,
  body: Uint8ClampedArray,
): void {
  if (ink.length % 4 || ink.length !== regions.length || ink.length !== body.length) {
    throw new Error('Tattoo layer and material masks must have identical RGBA dimensions.');
  }
  for (let offset = 0; offset < ink.length; offset += 4) {
    // Match the renderer's material precedence: red=jersey, green=pants, blue=skin.
    const exposedSkin = regions[offset] <= 127 && regions[offset + 1] <= 127
      && regions[offset + 2] > 127 && regions[offset + 3] > 0;
    ink[offset + 3] = exposedSkin
      ? Math.round(ink[offset + 3] * body[offset + 3] / 255 * regions[offset + 3] / 255)
      : 0;
  }
}
''')
p=r/'solo/characterRenderer.ts';s=p.read_text();s="import { maskTattooInk } from './tattooMask';\n"+s;s=s.replace('function drawTattoos(','function drawTattooDesign(',1)
assert s.count('function drawGear(')==1
s=s.replace('function drawGear(','''function drawTattoos(ctx:CanvasRenderingContext2D,look:Appearance,regions:Uint8ClampedArray,body:Uint8ClampedArray){
  if(look.tattooCoverage==='none')return;
  const layer=document.createElement('canvas');layer.width=256;layer.height=768;
  const ink=layer.getContext('2d',{willReadFrequently:true});
  if(!ink)return;
  drawTattooDesign(ink,look);
  const pixels=ink.getImageData(0,0,layer.width,layer.height);
  maskTattooInk(pixels.data,regions,body);
  ink.putImageData(pixels,0,0);
  ctx.save();ctx.globalCompositeOperation='multiply';ctx.drawImage(layer,0,0);ctx.restore();
  layer.width=0;layer.height=0;
}
function drawGear(''',1)
assert 'drawTattoos(ctx,look);' in s;s=s.replace('drawTattoos(ctx,look);','drawTattoos(ctx,look,mask,pixels.data);')
a=s.index('function drawHairAndFaceDetails');b=s.index('\nfunction rand',a);s=s[:a]+s[b+1:];assert 'drawHairAndFaceDetails(ctx,look)' in s;s=s.replace(';drawHairAndFaceDetails(ctx,look)','');p.write_text(s)
p=r/'solo/SoloPresentation.tsx';s=p.read_text().replace("import './soloAppearanceV2.css';\n",'');s=s.replace('    <i className="bk-solo-portrait-hair"/><i className="bk-solo-portrait-beard"/><i className="bk-solo-portrait-eye-black"/>\n','');p.write_text(s)
p=r/'solo/SoloPlayerProfile.tsx';s=p.read_text();a=s.index('            <fieldset><legend>Hair</legend>');b=s.index('            <fieldset><legend>Body build</legend>',a);s=s[:a]+'''            <p className="bk-solo-muted">Hair, facial hair and eye black are included in each portrait style. Saved individual style settings are preserved for the detailed artwork update.</p>
'''+s[b:];s=s.replace('Appearance,BodyBuild,EYE_BLACK_COUNT,FACE_COUNT,FACIAL_HAIR_COUNT,GloveStyle,HAIR_COUNT,','Appearance,BodyBuild,FACE_COUNT,GloveStyle,');p.write_text(s)
p=r/'PlayerAgentMode.tsx';s=p.read_text();a=s.index('export const isAgentTradeWindowOpen');b=s.index('\nconst MAJOR_CITIES',a);func=s[a:b];s=s[:a]+s[b:];s=s.replace('const TRADE_DEADLINE_WEEK = 9;\n','');s=s.replace('type SeasonPhase = "preseason" | "regular" | "postseason" | "offseason";\n','');s="import {agentTradeWindowMessage,canResolveAgentTradeRequest,isAgentTradeWindowOpen,TRADE_DEADLINE_WEEK,type SeasonPhase} from './agentTradeRules';\nexport {agentTradeWindowMessage,canResolveAgentTradeRequest,isAgentTradeWindowOpen} from './agentTradeRules';\n"+s;p.write_text(s)
(r/'agentTradeRules.ts').write_text('''/** Shared production trade rules. Kept independent of React and browser styles. */
export const TRADE_DEADLINE_WEEK = 9;
export type SeasonPhase = "preseason" | "regular" | "postseason" | "offseason";

'''+func.rstrip()+'\n')
p=r/'scripts/phase1-correctness-check.ts';s=p.read_text();a=s.index('const TRADE_DEADLINE_WEEK = 9;');b=s.index('const teams =',a);s=s[:a]+"import {agentTradeWindowMessage,canResolveAgentTradeRequest,isAgentTradeWindowOpen,TRADE_DEADLINE_WEEK} from '../agentTradeRules';\n\n"+s[b:];a=s.index('assert.match(agentSource, /const TRADE_DEADLINE_WEEK');b=s.index('assert.match(readFileSync',a);s=s[:a]+'''assert.equal(TRADE_DEADLINE_WEEK,9,'Agent trade deadline must remain Week 9.');
assert.match(agentSource,/from ['"]\\.\\/agentTradeRules['"]/,'The UI must consume the tested production rules.');
'''+s[b:];p.write_text(s)
p=r/'MyPlayerStory.tsx';s=p.read_text();a=s.index('export const calculateCombineResults');b=s.index('\nconst Combine =',a);func=s[a:b];func=func.replace("Pick<MyPlayerProfile, 'name' | 'position' | 'heightInches' | 'weightLbs' | 'bodyBuild' | 'armSize' | 'legSize'>",'CombineProfile');s=s[:a]+s[b:];s="import {calculateCombineResults} from './myPlayerCombine';\nexport {calculateCombineResults} from './myPlayerCombine';\n"+s;p.write_text(s)
(r/'myPlayerCombine.ts').write_text('''import type {Position} from './types';
export type CombineProfile={name:string;position:Position;heightInches:number;weightLbs:number;bodyBuild:number;armSize:number;legSize:number};
function hash(value:string){let result=2166136261;for(let index=0;index<value.length;index++){result^=value.charCodeAt(index);result=Math.imul(result,16777619);}return result>>>0;}

'''+func.rstrip()+'\n')
p=r/'scripts/solo-fictional-universe-check.ts';s=p.read_text();a=s.index('const hash = ');b=s.index('assert.equal(SOLO_UNIVERSE_VERSION',a);s=s[:a]+"import {calculateCombineResults} from '../myPlayerCombine';\n\n"+s[b:];p.write_text(s)

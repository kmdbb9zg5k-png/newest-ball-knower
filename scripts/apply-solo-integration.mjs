// One-time reviewed migration. Applies only to the dedicated Solo presentation branch.
import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const files=['SoloMode.tsx','SoloFranchiseHub.tsx','FranchiseInteractionCenter.tsx','FranchiseSeason.tsx','RealTeamFranchise.tsx','FantasyFranchise.tsx','PlayerAgentMode.tsx','OwnerBusinessMode.tsx'];
const config=ts.readConfigFile('tsconfig.json',ts.sys.readFile),parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,'.');
const program=ts.createProgram(parsed.fileNames,parsed.options),checker=program.getTypeChecker();
const tag=n=>ts.isJsxElement(n)?n.openingElement.tagName.getText():ts.isJsxSelfClosingElement(n)?n.tagName.getText():'';
const isElement=n=>ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n);
const attrs=n=>ts.isJsxElement(n)?n.openingElement.attributes.properties:n.attributes.properties;
const attr=(n,key)=>Array.from(attrs(n)).find(a=>ts.isJsxAttribute(a)&&a.name.getText()===key);
const ancestor=(n,fn)=>{for(let p=n.parent;p;p=p.parent)if(fn(p))return p;return null;};
const isPlayer=n=>{const t=checker.getTypeAtLocation(n);return !(t.flags&ts.TypeFlags.Any)&&['id','name','team','position','ovr','salary','attributes'].every(k=>t.getProperty(k));};
const summary=[];
for(const file of files){const source=program.getSourceFile(file),original=source.getFullText(),edits=[],imports=new Set(),buttons=new Map();
 if(original.includes("from './solo/SoloPresentation'")){summary.push({file,alreadyIntegrated:true});continue;}
 const add=(start,end,text)=>edits.push({start,end,text});const replace=(n,text)=>add(n.getStart(source),n.getEnd(),text);
 function visit(n){
  if(ts.isVariableDeclaration(n)&&n.name.getText()==='SoloMode'&&file==='SoloMode.tsx'){
   add(n.initializer.getStart(source),n.initializer.getStart(source),`withSoloPresentation<${n.type.typeArguments[0].getText()}>(`);add(n.initializer.getEnd(),n.initializer.getEnd(),')');imports.add('withSoloPresentation');
  }
  if(file==='SoloMode.tsx'&&ts.isVariableDeclaration(n)&&n.name.getText()==='PlayerPhoto'){
   replace(n.initializer,'({player}:{player:Player})=><SoloPortrait player={player} className="bk-solo-cap-portrait"/>');imports.add('SoloPortrait');return;
  }
  if(file==='OwnerBusinessMode.tsx'&&ts.isVariableDeclaration(n)&&n.name.getText()==='Face'){
   replace(n.initializer,"({p}:{p:Staff})=><SoloPortrait player={{id:'solo-staff:'+p.id,name:p.name,position:p.role,team:'BK'}} className=\"bk-solo-staff-portrait\"/>");imports.add('SoloPortrait');return;
  }
  if(isElement(n)&&tag(n)==='img'){
   const src=attr(n,'src'),e=src?.initializer&&ts.isJsxExpression(src.initializer)?src.initializer.expression:null;
   if(e&&ts.isCallExpression(e)&&e.expression.getText()==='playerPortraitFallbackUrl'&&isPlayer(e.arguments[0])){
    replace(n,`<SoloPortrait player={${e.arguments[0].getText()}}/>`);imports.add('SoloPortrait');return;
   }
  }
  if(file==='SoloFranchiseHub.tsx'&&ts.isJsxElement(n)&&tag(n)==='button'&&attr(n,'className')?.initializer?.getText()==='"bk-mode-card"'){
   const text=n.getText(),seed=text.includes('setAgentOpen')?"'agent'":text.includes('setOwnerOpen')?"'owner'":'mode.id';add(n.openingElement.getEnd(),n.openingElement.getEnd(),`<SoloModeArtwork seed={${seed}}/>`);imports.add('SoloModeArtwork');
  }
  if(ts.isJsxExpression(n)&&n.expression&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='name'&&isPlayer(n.expression.expression)){
   if(ts.isJsxAttribute(n.parent)||ancestor(n,p=>isElement(p)&&['option','title','svg'].includes(tag(p))))return;
   const value=n.expression.expression.getText();
   const photo=ancestor(n,p=>isElement(p)&&p.getText().length<3500&&(p.getText().includes(`<PlayerPhoto player={${value}}`)||p.getText().includes(`playerPortraitFallbackUrl(${value})`)));
   const portrait=photo?' showPortrait={false}':'';
   const modal=ancestor(n,p=>isElement(p)&&['ModalPortal','Dialog','AlertDialog'].includes(tag(p)));
   const button=ancestor(n,p=>isElement(p)&&['button','motion.button','a','label'].includes(tag(p)));
   if(button||modal){replace(n,`<SoloPlayerIdentity player={${value}}${portrait}/>`);imports.add('SoloPlayerIdentity');
    if(button&&!modal&&tag(button)==='button'&&!ancestor(button,p=>isElement(p)&&['button','a','label'].includes(tag(p))))buttons.set(button,value);
   }else{replace(n,`<SoloPlayerLink player={${value}}${file==='FranchiseInteractionCenter.tsx'&&value==='player'?' development={development}':''}${portrait}/>`);imports.add('SoloPlayerLink');}
   return;
  }
  ts.forEachChild(n,visit);
 }
 visit(source);
 for(const [b,value] of buttons){const key=attr(b,'key')?.initializer?.getText();add(b.getStart(source),b.getStart(source),`<div className="bk-solo-selection"${key?` key=${key}`:''}>`);add(b.getEnd(),b.getEnd(),`<SoloQuickView player={${value}}/></div>`);imports.add('SoloQuickView');}
 if(file==='SoloMode.tsx'){const target="const [interactions,setInteractions]=useState<FranchiseInteractionState>(()=>createFranchiseInteractions([],1));",idx=original.indexOf(target);assert(idx>=0);add(idx+target.length,idx+target.length,'\n useSoloRecords(roster,weeks,interactions);');imports.add('useSoloRecords');}
 if(file==='FranchiseSeason.tsx'){const target='const activeRoster = seasonRoster;',idx=original.indexOf(target);assert(idx>=0);add(idx+target.length,idx+target.length,'\n  useSoloRecords(activeRoster,weeks,interactionState,year);');imports.add('useSoloRecords');}
 const spans=edits.filter(e=>e.end>e.start).sort((a,b)=>a.start-b.start);for(let i=1;i<spans.length;i++)assert(spans[i].start>=spans[i-1].end,file);
 let next=original;for(const e of edits.sort((a,b)=>b.start-a.start||b.end-a.end))next=next.slice(0,e.start)+e.text+next.slice(e.end);
 if(imports.size)next=`import {${[...imports].sort().join(',')}} from './solo/SoloPresentation';\n`+next;
 fs.writeFileSync(file,next);summary.push({file,edits:edits.length,imports:[...imports]});
}
function edit(file,fn){fs.writeFileSync(file,fn(fs.readFileSync(file,'utf8')));}
edit('FantasyFranchise.tsx',s=>s.replace('SoloPlayerLink,','SoloPlayerLink,SoloPortrait,').replace("  const portrait = playerPortraitFallbackUrl(player);\n",'').replace('<div className="h-12 w-12 overflow-hidden rounded-full bg-white/5">{portrait ? <img src={portrait} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}</div>','<SoloPortrait player={player}/>').replace('<SoloPlayerIdentity player={player}/>','<SoloPlayerIdentity player={player} showPortrait={false}/>'));
edit('solo/SoloPresentation.tsx',s=>s.replace('<Profile record={selectedRecord}','<Profile key={selectedRecord.player.id} record={selectedRecord}'));
edit('solo/characterRenderer.ts',s=>s.replace('const faceX=(look.face%3)*128,faceY=Math.floor(look.face/3)*160;','const cellWidth=faces.naturalWidth/3,cellHeight=faces.naturalHeight/3;\n  const faceX=(look.face%3)*cellWidth,faceY=Math.floor(look.face/3)*cellHeight;').replace('ctx.drawImage(faces,faceX,faceY,128,160,75,0,116,165);','ctx.drawImage(faces,faceX,faceY,cellWidth,cellHeight,75,0,116,165);'));
fs.mkdirSync('docs/qa',{recursive:true});fs.writeFileSync('docs/qa/solo-integration.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));

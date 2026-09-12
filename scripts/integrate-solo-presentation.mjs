/** One-time, type-aware migration. It does not run in the application or change gameplay. */
import ts from 'typescript';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const APPLY=process.argv.includes('--apply');
const files=['SoloMode.tsx','SoloFranchiseHub.tsx','FranchiseInteractionCenter.tsx','FranchiseSeason.tsx','RealTeamFranchise.tsx','FantasyFranchise.tsx','PlayerAgentMode.tsx','OwnerBusinessMode.tsx','MyPlayerStory.tsx'];
const configPath=ts.findConfigFile('.',ts.sys.fileExists,'tsconfig.json');assert.ok(configPath);
const config=ts.readConfigFile(configPath,ts.sys.readFile);assert.ok(!config.error);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,'.');
const program=ts.createProgram(parsed.fileNames,parsed.options);const checker=program.getTypeChecker();
const results=[];
const tagName=node=>ts.isJsxElement(node)?node.openingElement.tagName.getText():ts.isJsxSelfClosingElement(node)?node.tagName.getText():'';
const attributes=node=>ts.isJsxElement(node)?node.openingElement.attributes.properties:node.attributes.properties;
const attr=(node,name)=>Array.from(attributes(node)).find(item=>ts.isJsxAttribute(item)&&item.name.getText()===name);
const ancestor=(node,test)=>{for(let current=node.parent;current;current=current.parent)if(test(current))return current;return null;};
const isElement=node=>ts.isJsxElement(node)||ts.isJsxSelfClosingElement(node);
const isPlayer=node=>{
 const type=checker.getTypeAtLocation(node);
 return !(type.flags&ts.TypeFlags.Any)&&['id','name','team','position','ovr','salary','attributes'].every(name=>type.getProperty(name));
};
for(const file of files){
 const source=program.getSourceFile(file);assert.ok(source,`Missing ${file}`);
 const original=source.getFullText();
 if(original.includes("from './solo/SoloPresentation'")){results.push({file,status:'already integrated'});continue;}
 const edits=[];const imports=new Set();const pairedButtons=new Map();let links=0,portraits=0,staticNames=0;
 const add=(start,end,text)=>edits.push({start,end,text});
 const replace=(node,text)=>add(node.getStart(source),node.getEnd(),text);
 function visit(node){
  if(ts.isVariableDeclaration(node)&&node.name.getText()==='SoloMode'&&file==='SoloMode.tsx'){
   assert.ok(node.initializer&&ts.isArrowFunction(node.initializer));
   const props=ts.isTypeReferenceNode(node.type)&&node.type.typeArguments?.[0]?.getText();assert.ok(props);
   add(node.initializer.getStart(source),node.initializer.getStart(source),`withSoloPresentation<${props}>(`);
   add(node.initializer.getEnd(),node.initializer.getEnd(),')');imports.add('withSoloPresentation');
  }
  if(file==='SoloMode.tsx'&&ts.isVariableDeclaration(node)&&node.name.getText()==='PlayerPhoto'){
   replace(node.initializer,`({player}:{player:Player})=><SoloPortrait player={player} className="bk-solo-cap-portrait"/>`);imports.add('SoloPortrait');portraits++;return;
  }
  if(file==='OwnerBusinessMode.tsx'&&ts.isVariableDeclaration(node)&&node.name.getText()==='Face'){
   replace(node.initializer,`({p}:{p:Staff})=><SoloPortrait player={{id:'solo-staff:'+p.id,name:p.name,position:p.role,team:'BK'}} className="bk-solo-staff-portrait"/>`);imports.add('SoloPortrait');portraits++;return;
  }
  if(file==='MyPlayerStory.tsx'&&ts.isVariableDeclaration(node)&&node.name.getText()==='PresetFace'){
   replace(node.initializer,`({face,small=false}:{face:typeof FACE_PRESETS[number];small?:boolean})=><SoloPortrait player={{id:'my-player-preset:'+face.id,name:face.name,position:'WR',team:'BK'}} face={({mason:2,nico:0,malik:4,darius:1} as Record<string,number>)[face.id]??0} className={small?'bk-solo-created-face-small':'bk-solo-created-face'}/>`);imports.add('SoloPortrait');portraits++;return;
  }
  if(isElement(node)&&tagName(node)==='img'){
   const src=attr(node,'src');const expression=src?.initializer&&ts.isJsxExpression(src.initializer)?src.initializer.expression:null;
   if(expression&&ts.isCallExpression(expression)&&expression.expression.getText()==='playerPortraitFallbackUrl'&&expression.arguments[0]&&isPlayer(expression.arguments[0])){
    const className=attr(node,'className')?.initializer?.getText();
    replace(node,`<SoloPortrait player={${expression.arguments[0].getText()}}${className?` className=${className}`:''}/>`);imports.add('SoloPortrait');portraits++;return;
   }
  }
  if(file==='SoloFranchiseHub.tsx'&&ts.isJsxElement(node)&&tagName(node)==='button'&&attr(node,'className')?.initializer?.getText()==='"bk-mode-card"'){
   const text=node.getText();const seed=text.includes('setAgentOpen')?"'agent'":text.includes('setOwnerOpen')?"'owner'":'mode.id';
   add(node.openingElement.getEnd(),node.openingElement.getEnd(),`<SoloModeArtwork seed={${seed}}/>`);imports.add('SoloModeArtwork');
  }
  if(ts.isJsxExpression(node)&&node.expression&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='name'&&isPlayer(node.expression.expression)){
   if(ts.isJsxAttribute(node.parent)||ancestor(node,parent=>isElement(parent)&&['option','title','svg'].includes(tagName(parent))))return;
   const value=node.expression.expression.getText();
   const existingPhoto=ancestor(node,parent=>isElement(parent)&&(/<PlayerPhoto\b|playerPortraitFallbackUrl\(/.test(parent.getText()))&&parent.getText().includes(value+'.name'));
   const portraitProp=existingPhoto?' showPortrait={false}':'';
   const modal=ancestor(node,parent=>isElement(parent)&&['ModalPortal','Dialog','AlertDialog'].includes(tagName(parent)));
   const button=ancestor(node,parent=>isElement(parent)&&['button','motion.button','a','label'].includes(tagName(parent)));
   if(modal||button){
    replace(node,`<SoloPlayerIdentity player={${value}}${portraitProp}/>`);imports.add('SoloPlayerIdentity');staticNames++;
    if(button&&!modal&&tagName(button)==='button'&&!ancestor(button,parent=>isElement(parent)&&['button','a','label'].includes(tagName(parent))))pairedButtons.set(button,value);
   }else{
    const development=file==='FranchiseInteractionCenter.tsx'&&value==='player'?' development={development}':'';
    replace(node,`<SoloPlayerLink player={${value}}${development}${portraitProp}/>`);imports.add('SoloPlayerLink');links++;
   }
   return;
  }
  ts.forEachChild(node,visit);
 }
 visit(source);
 for(const [button,value] of pairedButtons){
  const key=attr(button,'key')?.initializer?.getText();
  add(button.getStart(source),button.getStart(source),`<div className="bk-solo-selection"${key?` key=${key}`:''}>`);
  add(button.getEnd(),button.getEnd(),`<SoloQuickView player={${value}}/></div>`);imports.add('SoloQuickView');
 }
 if(file==='SoloMode.tsx'){
  const target="const [interactions,setInteractions]=useState<FranchiseInteractionState>(()=>createFranchiseInteractions([],1));";
  const at=original.indexOf(target);assert.ok(at>=0,'Cap development hook moved; inspect before integrating');
  add(at+target.length,at+target.length,'\n useSoloRecords(roster,weeks,interactions);');imports.add('useSoloRecords');
 }
 if(file==='FranchiseSeason.tsx'){
  const target='const activeRoster = seasonRoster;';const at=original.indexOf(target);assert.ok(at>=0,'Season roster hook moved; inspect before integrating');
  add(at+target.length,at+target.length,'\n  useSoloRecords(activeRoster,weeks,interactionState,year);');imports.add('useSoloRecords');
 }
 // Inner replacements and the zero-length container insertions may share boundaries, not interiors.
 const spans=edits.filter(edit=>edit.end>edit.start).sort((a,b)=>a.start-b.start);
 for(let index=1;index<spans.length;index++)assert.ok(spans[index].start>=spans[index-1].end,`Overlapping source edits in ${file}`);
 let next=original;
 for(const edit of edits.sort((a,b)=>b.start-a.start||b.end-a.end))next=next.slice(0,edit.start)+edit.text+next.slice(edit.end);
 if(imports.size)next=`import {${[...imports].sort().join(',')}} from './solo/SoloPresentation';\n`+next;
 const syntax=ts.transpileModule(next,{compilerOptions:parsed.options,fileName:file,reportDiagnostics:true});
 assert.deepEqual((syntax.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[],`Invalid TSX generated for ${file}`);
 if(APPLY&&next!==original)fs.writeFileSync(file,next);
 results.push({file,links,portraits,staticNames,quickViews:pairedButtons.size,changed:next!==original});
}
assert.ok(results.some(row=>row.file==='FranchiseInteractionCenter.tsx'&&(row.links>0||row.status==='already integrated')),'Upgrade cards must open profiles');
fs.mkdirSync('docs/qa',{recursive:true});
if(APPLY)fs.writeFileSync('docs/qa/solo-presentation-integration.json',JSON.stringify({mode:'type-aware presentation integration',files:results},null,2)+'\n');
console.log(JSON.stringify({applied:APPLY,files:results},null,2));

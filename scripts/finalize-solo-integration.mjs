import fs from 'node:fs';
const presentation='solo/SoloPresentation.tsx';
fs.writeFileSync(presentation,fs.readFileSync(presentation,'utf8').replace("import './soloPresentation.css';\n",''));
// Shared components are imported by Node regression tests. Keep CSS at the existing browser entry.
const entry=fs.readFileSync('main.tsx','utf8');
if(!entry.includes("import './solo/soloPresentation.css';"))fs.writeFileSync('main.tsx',"import './solo/soloPresentation.css';\n"+entry);

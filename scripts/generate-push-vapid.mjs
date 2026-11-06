import {mkdirSync,writeFileSync,chmodSync,existsSync,realpathSync} from 'node:fs';
import {isAbsolute,join,resolve,dirname} from 'node:path';
import {spawnSync} from 'node:child_process';
import webPush from 'web-push';

const [directory,subject]=process.argv.slice(2);
if(!directory||!isAbsolute(directory)||!subject){console.error('Usage: node scripts/generate-push-vapid.mjs /absolute/private/output-directory https://your-real-contact.example');process.exit(1);}
let contact;
try{contact=new URL(subject);}catch{console.error('A real external HTTPS or mailto contact is required.');process.exit(1);}
if(!['https:','mailto:'].includes(contact.protocol)||/[\r\n]/.test(subject)||!subject.includes('.')||contact.hostname==='localhost'){console.error('A real external HTTPS or mailto contact is required.');process.exit(1);}
// Refuse every Git checkout, including sibling worktrees and symlinked paths.
let ancestor=resolve(directory);while(!existsSync(ancestor)&&dirname(ancestor)!==ancestor)ancestor=dirname(ancestor);
const git=spawnSync('git',['-C',realpathSync(ancestor),'rev-parse','--is-inside-work-tree'],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
if(git.status===0&&git.stdout.trim()==='true'){console.error('Choose a private output directory outside Git worktrees.');process.exit(1);}
mkdirSync(directory,{recursive:true,mode:0o700});
chmodSync(directory,0o700);
const keys=webPush.generateVAPIDKeys();
for(const [name,value] of [['VAPID_PUBLIC_KEY',keys.publicKey],['VAPID_PRIVATE_KEY',keys.privateKey],['VAPID_SUBJECT',subject]]){
  const path=join(directory,name);writeFileSync(path,value,{mode:0o600,flag:'wx'});chmodSync(path,0o600);console.log(path);
}

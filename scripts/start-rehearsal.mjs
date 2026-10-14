import fs from 'node:fs';
import {spawn} from 'node:child_process';
const base='http://127.0.0.1:3001';
async function main(){
 if(!fs.existsSync('.next/BUILD_ID'))throw Error('Production build missing. Run npm install and npm run build first.');
 const tags=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(4000)}).then(r=>r.json()).catch(()=>{throw Error('Start Ollama first.');});
 for(const model of ['qwen2.5:7b','bge-m3'])if(!tags.models?.some(m=>m.name===model||m.name===model+':latest'))throw Error('Required installed rehearsal model missing: '+model);
 const existing=await fetch(base+'/api/health',{signal:AbortSignal.timeout(2000)}).then(r=>r.json()).catch(()=>null);
 if(existing){if(existing.generation!=='qwen2.5:7b'||!existing.strictModel)throw Error('Port 3001 belongs to another configuration. Do not stop it automatically.');console.log('Rehearsal already running: '+base);return;}
 console.log('Synthetic rehearsal documents, not official committee documents. Open '+base);
 const env={...process.env,COMPETITION_MODEL:'qwen2.5:7b',COMPETITION_EMBEDDING_MODEL:'bge-m3',COMPETITION_DOCS_DIR:'./demo-packs/challenge-ten',COMPETITION_INDEX_DIR:'./data/challenge-ten',COMPETITION_PORT:'3001'};
 const child=spawn(process.execPath,['scripts/competition.mjs'],{env,stdio:'inherit',windowsHide:true});
 child.on('error',e=>{console.error(e.message);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code||0;});
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

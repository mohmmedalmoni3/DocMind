import fs from 'node:fs';
import {spawn} from 'node:child_process';
if(fs.existsSync('.env'))process.loadEnvFile('.env');
const model=process.env.COMPETITION_MODEL;
if(!model){console.error('Set COMPETITION_MODEL to the exact model name provided by the committee. No model is selected automatically.');process.exit(1);}
const env={...process.env,OLLAMA_MODEL:model,OLLAMA_STRICT_MODEL:'true',SERVICE_ROUTING:'true',SERVICE_CONTEXT:process.env.SERVICE_CONTEXT||'chunks',OLLAMA_CONTEXT_SIZE:process.env.COMPETITION_CONTEXT_SIZE||'4096',EMBEDDING_MODEL:process.env.COMPETITION_EMBEDDING_MODEL||'bge-m3',DOCS_DIR:process.env.COMPETITION_DOCS_DIR||'./competition-docs',INDEX_DIR:process.env.COMPETITION_INDEX_DIR||'./data/competition',NEXT_TELEMETRY_DISABLED:'1'};
fs.mkdirSync(env.DOCS_DIR,{recursive:true});
const args=process.argv.includes('--ingest')?['--import','tsx','scripts/ingest.ts']:['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',process.env.COMPETITION_PORT||'3002'];
const child=spawn(process.execPath,args,{env,stdio:'inherit',windowsHide:true});
child.on('error',e=>{console.error(e.message);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code||0;});

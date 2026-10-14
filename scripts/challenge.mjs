import fs from 'node:fs';
import {spawn} from 'node:child_process';
if(fs.existsSync('.env'))process.loadEnvFile('.env');
const model=process.env.COMPETITION_MODEL;
if(!model){console.error('Set COMPETITION_MODEL explicitly; the committee model is not known yet.');process.exit(1);}
const mode=process.env.SERVICE_CONTEXT==='whole'?'whole':'chunks';
const env={...process.env,OLLAMA_MODEL:model,OLLAMA_STRICT_MODEL:'true',SERVICE_ROUTING:'true',SERVICE_CONTEXT:mode,OLLAMA_CONTEXT_SIZE:'4096',EMBEDDING_MODEL:process.env.COMPETITION_EMBEDDING_MODEL||'bge-m3',DOCS_DIR:'./demo-packs/challenge-ten',INDEX_DIR:'./data/challenge-ten'};
const child=spawn(process.execPath,['--require','./scripts/local-only-guard.cjs','--import','tsx','scripts/benchmark-challenge.ts',process.env.CHALLENGE_REPORT||`challenge-${mode}.json`],{env,stdio:'inherit',windowsHide:true});
child.on('error',e=>{console.error(e.message);process.exitCode=1;});child.on('exit',code=>{process.exitCode=code||0;});

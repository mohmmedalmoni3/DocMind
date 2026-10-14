import fs from 'node:fs';
import {spawn} from 'node:child_process';
if(fs.existsSync('.env'))process.loadEnvFile('.env');
const mode=process.argv[2] || 'start';
const fast=process.argv.includes('--fast');
const env={...process.env,
  DOCS_DIR:'./demo-packs/government-ar', INDEX_DIR:'./data/government-bge',
  EMBEDDING_MODEL:'bge-m3', OLLAMA_MODEL:fast?'qwen2.5:3b':'qwen2.5:7b',
  OLLAMA_CONTEXT_SIZE:'4096', NEXT_TELEMETRY_DISABLED:'1',
};
async function run(args){
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,args,{env,stdio:'inherit',windowsHide:true});
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Command exited ${code}`)));
  });
}
try{
  console.log(`Fictional Arabic government demo | ${env.OLLAMA_MODEL} | ${env.EMBEDDING_MODEL}`);
  if(mode==='benchmark')await run(['--require','./scripts/local-only-guard.cjs','--import','tsx','scripts/benchmark-government.ts',process.env.GOV_REPORT || 'government-current.json']);
  else{
    await run(['--import','tsx','scripts/ingest.ts']);
    await run(['--require','./scripts/local-only-guard.cjs','node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',process.env.GOV_PORT || '3001']);
  }
}catch(e){console.error(e.message);process.exitCode=1;}

import fs from 'node:fs/promises';
const base='http://127.0.0.1:3000';const rows=[];
const health=await(await fetch(base+'/api/health')).json();
if(!health.ready||health.embedding.name!=='bge-m3')throw Error('Updated Arabic index is not ready');
for(const [question,expected] of [['شقد الساعات','20'],['شقد ساعات الجلسة اليومية؟','2']]){
 const start=performance.now();const response=await fetch(base+'/api/chat',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({question,history:[],style:'brief'}),signal:AbortSignal.timeout(240000)});
 const raw=await response.text();if(!response.ok)throw Error(raw);
 const events=raw.split('\n').filter(l=>l.startsWith('data: ')).map(l=>JSON.parse(l.slice(6)));
 let text='';for(const e of events){if(e.type==='token')text+=e.text;if(e.type==='replace')text=e.text;}
 const done=events.find(e=>e.type==='done');const numbers=(text.replace(/\[\d+\]/g,'').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660)).match(/\d+/g)||[]);
 const pass=!!done?.grounded&&numbers.includes(expected)&&!events.some(e=>e.type==='error');
 rows.push({question,expected,text,pass,done,wallMs:Math.round(performance.now()-start),sources:events.find(e=>e.type==='sources')});console.log(JSON.stringify(rows.at(-1)));
}
await fs.writeFile('data/dialect-http-smoke.json',JSON.stringify({at:new Date().toISOString(),health,rows},null,2));if(rows.some(r=>!r.pass))process.exitCode=1;

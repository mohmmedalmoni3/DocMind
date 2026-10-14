import fs from 'node:fs/promises';
import { governmentCases, checkGovernmentPassages } from '../lib/government-evaluation';
async function main() {
const input = process.argv[2] || 'government-quality-final.json';
const report = JSON.parse(await fs.readFile(input, 'utf8'));
report.reviewedAt = new Date().toISOString();
report.reviewNote = 'Rescored saved answers with passage-level fixture checks; no new inference or timing. Original run preserved.';
for (const row of report.results) {
  const test = governmentCases.find(t=>t.id===row.id);
  row.originalPass = row.pass;
  row.passageCheck = !!test && checkGovernmentPassages(test,row.answer || '',row.sources || []);
  row.pass = row.factCheck && row.sourceCheck && row.scopeCheck && row.numericCheck && row.passageCheck;
  if (row.id==='excluded-work' && !row.passageCheck) row.reviewNote = 'Answer is factually correct but [2] refers to fees. Supporting exclusion is in [1]. Do not report this as fully grounded.';
}
report.summary.passed = report.results.filter((r:{pass:boolean})=>r.pass).length;
await fs.writeFile(process.argv[3] || 'government-quality-reviewed.json',JSON.stringify(report,null,2));
console.log(report.summary);
}
main().catch(error=>{console.error(error);process.exitCode=1;});

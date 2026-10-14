import { answer } from "../lib/rag";
const question = process.argv.slice(2).join(" ");
if (!question) {
  console.error('Usage: npm run ask -- "Your question"');
  process.exitCode = 1;
} else
  answer(question, [], (e) => {
    if (e.type === "token") process.stdout.write(e.text);
    if (e.type === "replace") console.log("\nCorrected answer:", e.text);
    if (e.type === "done") console.log(`\n\n${e.ms}ms`);
  }).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });

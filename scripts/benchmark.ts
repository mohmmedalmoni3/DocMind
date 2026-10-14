import fs from "node:fs/promises";
import { answer } from "../lib/rag";
import { evaluationCases, checkEvaluation } from "../lib/evaluation";
import { readIndex } from "../lib/index-store";
import { config } from "../lib/config";
async function main() {
  const library = await readIndex();
  let measuredModel = config.model;
  const results = [];
  const replay = [];
  for (const c of evaluationCases) {
    const start = performance.now();
    let firstTokenMs: number | undefined;
    const steps: unknown[] = [];
    let replacements = 0;
    const r = await answer(
      c.question,
      c.history || [],
      (e) => {
        if (e.type === "replace") replacements++;
        if (e.type === "token" && firstTokenMs === undefined)
          firstTokenMs = Math.round(performance.now() - start);
        if (e.type === "step" && e.step.status === "done") steps.push(e.step);
      },
      {
        file: c.scope,
        compareFiles: c.compareFiles,
        bypassCache: !process.argv.includes("--replay"),
      },
    );
    const { pass, correct, citation } = checkEvaluation(c, r);
    measuredModel = r.model;
    const row = {
      question: c.question,
      text: r.text,
      pass,
      correct,
      citation,
      category: c.category || "Fact",
      method: r.method,
      sourceReferences: r.sources.map((s) => ({
        citation: s.citation,
        file: s.file,
        page: s.page,
        section: s.section,
      })),
      firstTokenMs,
      ms: Math.round(performance.now() - start),
      replacements,
      steps,
    };
    results.push(row);
    console.log(JSON.stringify(row));
    if (process.argv.includes("--replay") && c.file) {
      const rs = performance.now();
      let cached = false;
      const rr = await answer(
        c.question,
        c.history || [],
        (e) => {
          if (e.type === "done") cached = !!e.cached;
        },
        { file: c.scope, compareFiles: c.compareFiles },
      );
      replay.push({
        question: c.question,
        ms: Math.round(performance.now() - rs),
        cached,
        identical: rr.text === r.text,
      });
    }
  }
  await fs.writeFile(
    process.argv[2] || "performance.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        suiteVersion: 3,
        model: measuredModel,
        indexRevision: library.updatedAt,
        indexRevisionAtEnd: (await readIndex()).updatedAt,
        documents: library.documents.map((d) => ({
          name: d.name,
          hash: d.hash,
        })),
        results,
        replay,
      },
      null,
      2,
    ),
  );
  if (results.some((r) => !r.pass)) process.exitCode = 1;
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

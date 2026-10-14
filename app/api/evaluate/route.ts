import { evaluationCases, checkEvaluation } from "@/lib/evaluation";
import { answer } from "@/lib/rag";
import { sameOrigin, errorResponse, sse } from "@/lib/http";
import fs from "node:fs/promises";
import path from "node:path";
import { readIndex } from "@/lib/index-store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  try {
    const report = JSON.parse(
      await fs.readFile(
        path.join(process.cwd(), "performance-hackathon-final.json"),
        "utf8",
      ),
    );
    if (
      report.suiteVersion !== 3 ||
      !Array.isArray(report.results) ||
      report.results.length !== evaluationCases.length ||
      report.results.some(
        (r: { question: string }, i: number) =>
          r.question !== evaluationCases[i].question,
      )
    )
      return Response.json({ available: false });
    const index = await readIndex();
    return Response.json(
      {
        available: true,
        at: report.at,
        model: report.model,
        stale:
          report.indexRevision !== index.updatedAt ||
          report.indexRevisionAtEnd !== report.indexRevision,
        documents: report.documents?.length || 0,
        results: report.results.map(
          (r: {
            question: string;
            text: string;
            pass: boolean;
            correct: boolean;
            citation: boolean;
            ms: number;
            firstTokenMs?: number;
            method?: string;
            category?: string;
          }) => ({ ...r, answer: r.text }),
        ),
        score: Math.round(
          (report.results.filter((r: { pass: boolean }) => r.pass).length /
            report.results.length) *
            100,
        ),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ available: false });
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    return sse(request, async (emit, signal) => {
      let passed = 0;
      for (let i = 0; i < evaluationCases.length; i++) {
        const test = evaluationCases[i];
        emit({
          type: "progress",
          current: i,
          total: evaluationCases.length,
          question: test.question,
        });
        const start = performance.now();
        let firstTokenMs: number | undefined;
        const result = await answer(
          test.question,
          test.history || [],
          (e) => {
            if (e.type === "token")
              firstTokenMs ??= Math.round(performance.now() - start);
          },
          {
            signal,
            bypassCache: true,
            file: test.scope,
            compareFiles: test.compareFiles,
          },
        );
        const { correct, citation, pass } = checkEvaluation(test, result);
        if (pass) passed++;
        emit({
          type: "result",
          ...test,
          answer: result.text,
          pass,
          correct,
          citation,
          firstTokenMs,
          method: result.method,
          sources: result.sources.map((s) => ({
            file: s.file,
            citation: s.citation,
            page: s.page,
          })),
          ms: Math.round(performance.now() - start),
        });
      }
      emit({
        type: "complete",
        passed,
        total: evaluationCases.length,
        score: Math.round((passed / evaluationCases.length) * 100),
      });
    });
  } catch (e) {
    return errorResponse(e);
  }
}

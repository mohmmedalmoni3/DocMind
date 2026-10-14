import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { shouldRewrite } from "../lib/query-policy";
import { evidenceItems } from "../lib/pdf-evidence";
import { config } from "../lib/config";
import { emptyIndex, readIndex, writeIndex } from "../lib/index-store";
import { answer } from "../lib/rag";
import { GET as getSource } from "../app/api/source/route";
import { focusEvidence } from "../lib/evidence-focus";
import { checkEvaluation } from "../lib/evaluation";
import { directFact } from "../lib/direct-fact";
import type { Source } from "../lib/types";
import {
  directComparison,
  comparisonCitationsStayScoped,
} from "../lib/direct-comparison";
import { evidenceBrief } from "../lib/evidence-brief";

test("rewrite routing avoids named/scoped standalone calls but preserves ambiguous bilingual follow-ups", () => {
  const history = [{ role: "user" as const, content: "Tell me about Atlas." }];
  assert.equal(
    shouldRewrite("What is the Atlas beta budget?", history, [
      "01-Project-Atlas.md",
    ]),
    false,
  );
  assert.equal(
    shouldRewrite("How many teams are invited?", history, [
      "01-Project-Atlas.md",
    ]),
    true,
  );
  assert.equal(
    shouldRewrite("What about its budget?", history, [], true),
    true,
  );
  assert.equal(
    shouldRewrite("ما الميزانية الإجمالية؟", history, [], true),
    false,
  );
  assert.equal(shouldRewrite("وكم مدتها؟", history, [], true), true);
  assert.equal(
    shouldRewrite("كم مدة دورة هندسة الأوامر؟", history, [
      "دورة هندسة الأوامر.pdf",
    ]),
    false,
  );
});
test("decision brief preserves budget/approval qualifiers, labels suggestions and rejects unsupported topics", () => {
  const source: Source = {
    id: "b",
    file: "b.md",
    citation: 2,
    page: null,
    section: "Budget",
    similarity: 0.8,
    score: 1,
    keyword: 1,
    text: "The beta program has a total budget of $48,000. The budget owner is Priya Shah. Expenses over $2,000 require approval from Maya Chen.",
  };
  const card = evidenceBrief(
    "Create a decision brief for the Atlas beta budget and expense approval requirements.",
    [source],
  )!;
  assert.ok(
    card.includes("Expenses over $2,000 require approval from Maya Chen. [2]"),
  );
  assert.ok(card.includes("$48,000"));
  assert.ok(card.includes("**Suggestion:**"));
  assert.ok(card.includes("does not establish that all decision criteria"));
  assert.equal(
    evidenceBrief("Create a decision brief for revenue in 2023.", [source]),
    null,
  );
});
test("direct facts quote explicit evidence but reject period mismatches, conflicts, generic subjects and inference", () => {
  const source: Source = {
    id: "a",
    file: "a.md",
    page: 1,
    section: "Budget",
    text: "Atlas beta has a total budget of $48,000.",
    citation: 1,
    similarity: 0.8,
    keyword: 2,
    score: 1,
  };
  const labels = new Map([
    ["a.md", "Project Atlas"],
    ["b.md", "Project Orion"],
  ]);
  assert.equal(
    directFact("What is the total Atlas beta budget?", [source], labels)?.text,
    "> Atlas beta has a total budget of $48,000. [1]",
  );
  assert.equal(
    directFact("What is the total Orion budget?", [source], labels, true),
    null,
  );
  assert.equal(
    directFact(
      "What is the total Project Atlas budget?",
      [
        {
          ...source,
          file: "b.md",
          text: "Project Orion has a total budget of $24,000.",
        },
      ],
      labels,
      true,
    ),
    null,
  );
  assert.equal(
    directFact(
      "What is the total Atlas beta budget in 2023?",
      [source],
      labels,
    ),
    null,
  );
  assert.equal(
    directFact(
      "What was the total Atlas beta budget last year?",
      [source],
      labels,
    ),
    null,
  );
  assert.equal(
    directFact(
      "What is the total Atlas beta budget and is it sufficient?",
      [source],
      labels,
    ),
    null,
  );
  assert.equal(
    directFact("What is the total project budget?", [source], labels),
    null,
  );
  assert.equal(
    directFact(
      "What is the total Atlas beta budget?",
      [
        {
          ...source,
          file: "b.md",
          text: "Orion has a total budget of $24,000.",
        },
      ],
      labels,
    ),
    null,
  );
  assert.equal(
    directFact(
      "What is the total Atlas beta budget?",
      [
        source,
        {
          ...source,
          id: "other",
          citation: 2,
          text: "Atlas beta has a total budget of $52,000.",
        },
      ],
      labels,
    ),
    null,
  );
  const ar = {
    ...source,
    text: "20 ساعة إجمالي ساعات التدريب 10 أيام من الأحد إلى الخميس 2 ساعة مدة الجلسة اليومية طبيعة الدورة تطبيق عملي",
  };
  assert.equal(
    directFact(
      "كم مدة دورة هندسة مدنية؟",
      [ar],
      new Map([["a.md", "دورة هندسة الأوامر"]]),
      true,
    ),
    null,
  );
  assert.ok(
    directFact(
      "كم مدة دورة هندسة الأوامر وكم عدد ساعات التدريب؟",
      [ar],
      new Map([["a.md", "دورة هندسة الأوامر"]]),
      true,
    )?.text.includes("10 أيام"),
  );
  assert.ok(
    directFact(
      "من المسؤولة عن إطلاق مشروع أطلس؟",
      [{ ...source, text: "المسؤولة عن الإطلاق هي مايا تشين." }],
      new Map([["a.md", "أطلس دليل المشروع"]]),
    )?.text.includes("مايا تشين"),
  );
});
test("direct comparison separates requested fields, scopes citations and distinguishes period changes", () => {
  const make = (file: string, citation: number, text: string): Source => ({
    id: file,
    file,
    citation,
    text,
    page: null,
    section: "Policy",
    similarity: 0.8,
    keyword: 1,
    score: 1,
  });
  const sources = [
    make(
      "a.md",
      1,
      "Orion March 2026 training has an approved total budget of $18,000. Its training duration is 8 days.",
    ),
    make(
      "b.md",
      2,
      "Orion March 2026 training has an approved total budget of $24,000. Its training duration is 10 days.",
    ),
  ];
  const labels = new Map([
    ["a.md", "Project Orion Operations"],
    ["b.md", "Project Orion Finance"],
  ]);
  const table = directComparison(
    "Compare Orion training budget and duration",
    sources,
    ["a.md", "b.md"],
    labels,
  )!;
  assert.match(table, /Potential conflict for the same period/);
  assert.match(table, /18,000/);
  assert.match(table, /24,000/);
  assert.ok(comparisonCitationsStayScoped(table, sources, ["a.md", "b.md"]));
  assert.equal(
    comparisonCitationsStayScoped(
      "| Topic | Budget [2] | Budget [1] |",
      sources,
      ["a.md", "b.md"],
    ),
    false,
  );
  const changed = [
    sources[0],
    { ...sources[1], text: sources[1].text.replace("March", "April") },
  ];
  assert.equal(
    directComparison(
      "Compare Orion training budget",
      [
        sources[0],
        {
          ...sources[1],
          text:
            sources[1].text +
            " This revision supersedes the operations policy.",
        },
      ],
      ["a.md", "b.md"],
      labels,
    ),
    null,
  );
  assert.match(
    directComparison(
      "Compare Orion training budget",
      changed,
      ["a.md", "b.md"],
      labels,
    )!,
    /period\/scope review/,
  );
  const roles = [
    make("a.md", 1, "The launch owner is Maya Chen."),
    make("b.md", 2, "The release owner is Omar Haddad."),
  ];
  const roleTable = directComparison(
    "Compare Orion launch owner and release owner",
    roles,
    ["a.md", "b.md"],
    labels,
  )!;
  assert.ok(
    roleTable
      .split("\n")
      .find((line) => line.includes("Product launch owner"))
      ?.includes("Not found in retrieved passages"),
  );
  assert.ok(!roleTable.includes("Potential conflict"));
});
test("PDF evidence highlights contiguous source text, tolerates Arabic normalization, rejects scattered keywords", () => {
  assert.deepEqual(
    evidenceItems(
      ["Unrelated title", "Budget is ", "$48,000.", "Footer"],
      "Budget is $48,000.",
    ),
    { indices: [1, 2], exact: true },
  );
  assert.deepEqual(
    evidenceItems(
      ["إجمالي ساعات ", "التدريب ٢٠ ساعة"],
      "اجمالي ساعات التدريب ٢٠ ساعة",
    ),
    { indices: [0, 1], exact: true },
  );
  assert.deepEqual(
    evidenceItems(
      ["Budget", "unrelated explanation", "48,000"],
      "Budget is $48,000.",
    ),
    { indices: [], exact: false },
  );
});
test("evidence focus preserves the selected facts as extracts and scoring accepts equivalent digit notation", () => {
  const noise =
    "Unrelated background describes internal branding and onboarding. ".repeat(
      12,
    );
  const facts =
    "Atlas beta budget is $48,000. Maya Chen approves expenses over $2,000.";
  const input = noise + "\n" + facts + "\n" + noise;
  const focused = focusEvidence(
    input,
    "What is the Atlas beta budget and what expenses need Maya Chen approval?",
  );
  assert.ok(focused.includes("Atlas beta budget is $48,000."));
  assert.ok(focused.includes("Maya Chen approves expenses over $2,000."));
  assert.ok(focused.length < input.length);
  assert.ok(!focused.includes("$52,000"));
  assert.equal(focusEvidence(input, "Who coordinates spending?"), input);
  assert.ok(
    checkEvaluation(
      {
        question: "Budget",
        expected: "48,000",
        terms: ["48000"],
        file: "a.md",
      },
      {
        text: "٤٨٬٠٠٠ [1]",
        sources: [
          { file: "a.md", citation: 1, text: "Budget is 48,000 dollars." },
        ],
      },
    ).pass,
  );
});
test("index snapshot handles atomic/external replacement and original source rejects traversal", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "docmind-snapshot-"));
  const originalData = config.data,
    originalDocs = config.docs;
  config.data = dir;
  config.docs = dir;
  t.after(async () => {
    config.data = originalData;
    config.docs = originalDocs;
    await fs.rm(dir, { recursive: true, force: true });
  });
  const index = emptyIndex();
  index.updatedAt = "a";
  await writeIndex(index);
  const first = await readIndex();
  assert.equal(first, await readIndex());
  index.updatedAt = "b";
  await fs.writeFile(path.join(dir, "replacement.json"), JSON.stringify(index));
  await fs.rename(
    path.join(dir, "replacement.json"),
    path.join(dir, "index.json"),
  );
  assert.equal((await readIndex()).updatedAt, "b");
  assert.notEqual(first, await readIndex());
  const bad = await getSource(
    new Request("http://localhost/api/source?file=../secret.pdf"),
  );
  assert.equal(bad.status, 404);
  await fs.writeFile(path.join(dir, "demo.pdf"), "%PDF-1.4 test");
  index.documents = [
    {
      name: "demo.pdf",
      hash: "x",
      bytes: 13,
      pages: 1,
      chunks: 1,
      indexedAt: "b",
    },
  ];
  await writeIndex(index);
  const good = await getSource(
    new Request("http://localhost/api/source?file=demo.pdf"),
  );
  assert.equal(good.status, 200);
  assert.match(await good.text(), /^%PDF/);
});
test("comparison retrieves both scopes in one generation; styles isolate answer reuse", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "docmind-comparison-")),
    original = config.data;
  config.data = dir;
  t.after(async () => {
    config.data = original;
    await fs.rm(dir, { recursive: true, force: true });
  });
  let chats = 0,
    prompt = "";
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/tags"))
        return Response.json({ models: [{ name: config.model }] });
      if (url.endsWith("/api/embed"))
        return Response.json({ embeddings: [[1, 0]] });
      chats++;
      const body = JSON.parse(String(init?.body));
      prompt = body.messages
        .map((m: { content: string }) => m.content)
        .join("\n");
      return new Response(
        JSON.stringify({
          message: { content: "Atlas budget differs: 42 [1] and 52 [2]." },
          done: true,
          done_reason: "stop",
        }) + "\n",
      );
    },
  );
  const index = emptyIndex();
  index.updatedAt = "compare-v1";
  index.chunks = ["a.md", "b.md", "outside.md"].map((file, i) => ({
    id: file,
    file,
    page: null,
    section: "Budget",
    text: `Atlas beta budget is ${i === 0 ? 42 : 52}.`,
    embedding: [1, 0],
  }));
  await writeIndex(index);
  const r = await answer("Compare Atlas beta budget", [], () => {}, {
    compareFiles: ["a.md", "b.md"],
  });
  assert.equal(chats, 1);
  assert.deepEqual(
    r.sources.map((s) => s.file),
    ["a.md", "b.md"],
  );
  assert.match(
    prompt,
    /Different roles or missing information are not contradictions/,
  );
  await answer("Compare Atlas beta budget", [], () => {}, {
    compareFiles: ["a.md", "b.md"],
  });
  assert.equal(chats, 1);
  await answer("Compare Atlas beta budget", [], () => {}, {
    compareFiles: ["a.md", "b.md"],
    style: "decision",
  });
  assert.equal(chats, 2);
  await assert.rejects(
    answer("Compare", [], () => {}, { compareFiles: ["a.md", "a.md"] }),
    /different indexed/,
  );
  const summary = await answer(
    "Summarize the selected passages",
    [],
    () => {},
    { summary: true, style: "decision" },
  );
  assert.equal(summary.method, "generated");
  assert.equal(
    summary.sources.length,
    3,
    "identical text from different files must retain its own provenance",
  );
  assert.match(
    prompt,
    /Summarize the selected passages in at most five short bullets/,
  );
});

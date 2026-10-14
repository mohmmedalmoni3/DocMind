import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInvestigation,
  investigationFindings,
} from "../lib/investigation";
import { compareVersions, wordChanges } from "../lib/version-diff";
import type { Index } from "../lib/types";
function library(files: Record<string, string>): Index {
  return {
    version: 3,
    fingerprint: "test",
    embeddingModel: "test",
    updatedAt: "test",
    documents: Object.keys(files).map((name) => ({
      name,
      hash: files[name],
      chunks: 1,
      bytes: 1,
      pages: 1,
      indexedAt: "test",
    })),
    chunks: Object.entries(files).map(([file, text], i) => ({
      id: String(i),
      file,
      text,
      section: "Policy",
      page: i + 1,
      embedding: [1, 0],
    })),
  };
}
const ops =
  "# Project Orion\n\nProject Orion's March 2026 training program has a total budget of $18,000.\nIts training duration is 8 days.\nThe launch owner is Lina Salem.";
const finance =
  "# Project Orion\n\nProject Orion's March 2026 training program has a total budget of $24,000.\nIts training duration is 10 days.\nThe release owner is Omar Haddad.";
test("investigator finds explicit same-period budget and duration differences with exact source metadata", () => {
  const index = library({
    "ops.md": ops,
    "finance.md": finance,
    "unrelated.md": finance.replaceAll("Orion", "Vega"),
  });
  const snapshot = buildInvestigation(index);
  const findings = investigationFindings(snapshot, ["ops.md", "finance.md"]);
  assert.equal(findings.length, 2);
  assert.ok(findings.every((finding) => finding.kind === "potential-conflict"));
  assert.ok(
    findings.every((finding) =>
      finding.facts.every((fact) =>
        index.chunks.some(
          (chunk) =>
            chunk.id === fact.chunkId && chunk.text.includes(fact.quote),
        ),
      ),
    ),
  );
  assert.deepEqual(
    findings[0].facts.map((fact) => fact.page),
    [1, 2],
  );
  assert.equal(investigationFindings(snapshot, ["ops.md"]).length, 0);
  assert.equal(
    investigationFindings(snapshot, ["ops.md", "unrelated.md"]).length,
    0,
  );
});
test("unknown periods, different units and revisions require review, roles are not conflated", () => {
  for (const [changed, kind] of [
    [finance.replace("March 2026", "April 2026"), "scope-review"],
    [finance.replace("March 2026", ""), "scope-review"],
    [finance + "\nThis revision replaces the old policy.", "revision-review"],
  ] as const) {
    const index = library({ "ops.md": ops, "other.md": changed });
    assert.ok(
      investigationFindings(buildInvestigation(index), [
        "ops.md",
        "other.md",
      ]).every((finding) => finding.kind === kind),
    );
  }
  const units = library({
    "ops.md": ops,
    "other.md": finance.replace("10 days", "192 hours"),
  });
  assert.equal(
    investigationFindings(buildInvestigation(units), [
      "ops.md",
      "other.md",
    ]).find((finding) => finding.field === "مدة التدريب")?.kind,
    "scope-review",
  );
});
test("unchanged document analysis is reused while edits rebuild evidence and version passages", () => {
  const first = library({ "ops.md": ops });
  const prior = buildInvestigation(first);
  const again = buildInvestigation(first, prior);
  assert.equal(again.documents[0].facts, prior.documents[0].facts);
  assert.equal(again.documents[0].passages, prior.documents[0].passages);
  const edited = library({ "ops.md": finance });
  assert.notEqual(
    buildInvestigation(edited, prior).documents[0].facts,
    prior.documents[0].facts,
  );
});
test("multiple explicit projects in one document do not assign ambiguous facts to the first project", () => {
  const index = library({
    "multi.md":
      ops +
      "\nProject Vega is a second project.\nIts training duration is 6 days.",
    "other.md": finance,
  });
  const facts = buildInvestigation(index).documents[0].facts;
  assert.ok(!facts.some((fact) => fact.quote.includes("6 days")));
});
test("version comparison identifies numeric changes, additions and removals and highlights only changed words", () => {
  const index = library({
    "old.md":
      "# Policy\n\nThe total budget is $12,000.\nEmail approvals are required.\nTraining uses the local handbook.",
    "new.md":
      "# Policy\n\nThe total budget is $15,000.\nTraining uses the local handbook.\nA security review is required before launch.",
  });
  index.investigation = buildInvestigation(index);
  const result = compareVersions(index, "old.md", "new.md");
  assert.deepEqual(result.counts, { added: 1, removed: 1, changed: 1 });
  const change = result.changes.find((row) => row.kind === "changed")!;
  assert.equal(
    change
      .beforeWords!.filter((word) => word.changed)
      .map((word) => word.text)
      .join(""),
    "$12,000.",
  );
  assert.equal(
    change
      .afterWords!.filter((word) => word.changed)
      .map((word) => word.text)
      .join(""),
    "$15,000.",
  );
  assert.equal(change.before?.page, 1);
  assert.equal(change.after?.page, 2);
  result.changes.length = 0;
  assert.equal(
    compareVersions(index, "old.md", "new.md").changes.length,
    3,
    "cached reports are isolated from caller mutation",
  );
});
test("identical copies, reordered passages and formatting differences are not invented changes", () => {
  const index = library({
    "a.md": "# Notes\n\nRetention is 10 days.\nBudget is $48,000.",
    "b.md": "# Notes\n\nBudget is $48,000.\nRetention is 10 days.",
  });
  assert.equal(compareVersions(index, "a.md", "b.md").changes.length, 0);
  assert.throws(() => compareVersions(index, "a.md", "a.md"));
  assert.throws(() => compareVersions(index, "a.md", "missing.md"));
  assert.equal(
    wordChanges("عشر ساعات", "عشر ساعات").afterWords.some(
      (word) => word.changed,
    ),
    false,
  );
});
test("Arabic explicit budgets use normalized digits and retain literal source quotes", () => {
  const index = library({
    "قديم.md":
      "# مشروع النور\n\nمشروع النور مارس ٢٠٢٦.\nالميزانية الإجمالية هي ١٨٬٠٠٠ دولار.",
    "جديد.md":
      "# مشروع النور\n\nمشروع النور مارس 2026.\nالميزانية الإجمالية هي 24000 دولار.",
  });
  const findings = investigationFindings(
    buildInvestigation(index),
    Object.keys({ "قديم.md": 1, "جديد.md": 1 }),
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].kind, "potential-conflict");
  assert.ok(findings[0].facts[0].quote.includes("١٨٬٠٠٠"));
});

import test from "node:test";
import assert from "node:assert/strict";
import { candidatesFor } from "../lib/rag";
import { resolveDocumentScope } from "../lib/document-scope";
import { rank } from "../lib/retrieval";
import type { Index } from "../lib/types";
const index: Index = {
  version: 3,
  fingerprint: "test",
  embeddingModel: "test",
  updatedAt: "test",
  documents: ["budget.md", "biology.md", "private.md"].map((name) => ({
    name,
    hash: name,
    chunks: 1,
    bytes: 1,
    pages: 1,
    indexedAt: "test",
  })),
  chunks: [
    {
      id: "a",
      file: "budget.md",
      text: "The total budget is $48,000.",
      embedding: [1, 0],
    },
    {
      id: "b",
      file: "biology.md",
      text: "Mitochondria produce energy through cellular respiration.",
      embedding: [0, 1],
    },
    {
      id: "c",
      file: "private.md",
      text: "The total budget is $99,000. Mitochondria notes.",
      embedding: [0.7, 0.7],
    },
  ].map((c) => ({ ...c, page: null, section: c.file })),
};
test("one conversation searches two unrelated attachments without leaking library sources", () => {
  const scope = resolveDocumentScope(index, [
    "biology.md",
    "budget.md",
    "budget.md",
  ]);
  const candidates = candidatesFor(index, undefined, scope);
  assert.deepEqual(
    candidates.map((c) => c.file),
    ["budget.md", "biology.md"],
  );
  assert.equal(
    rank(candidates, [1, 0], "total budget", 1)[0].file,
    "budget.md",
  );
  assert.equal(
    rank(candidates, [0, 1], "mitochondria cellular respiration", 1)[0].file,
    "biology.md",
  );
  assert.equal(
    candidatesFor(index, undefined, [...scope!].reverse()),
    candidates,
  );
});
test("explicit missing or empty attachments fail closed, single-file focus stays within attachments", () => {
  assert.throws(() => resolveDocumentScope(index, []));
  assert.throws(() => resolveDocumentScope(index, ["deleted.pdf"]));
  assert.throws(() =>
    resolveDocumentScope(index, ["biology.md"], "private.md"),
  );
  assert.deepEqual(
    resolveDocumentScope(index, ["budget.md", "biology.md"], "biology.md"),
    ["biology.md"],
  );
  assert.equal(candidatesFor(index, "biology.md").length, 1);
});
test("same-content attachments retain their explicitly chosen filenames", () => {
  const duplicate: Index = {
    ...index,
    documents: index.documents.map((d) => ({ ...d, hash: "same" })),
  };
  assert.equal(
    candidatesFor(duplicate, undefined, ["biology.md"]).at(0)?.file,
    "biology.md",
  );
});

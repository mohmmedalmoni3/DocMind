import test from "node:test";
import assert from "node:assert/strict";
import { chunkPages, tokenEstimate } from "../lib/chunking";
import { cosine, rank, terms } from "../lib/retrieval";
import { validCitations, refusal } from "../lib/rag";
import type { Chunk } from "../lib/types";
test("cosine catches incompatible indexes and zero vectors", () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([0, 0], [1, 0]), 0);
  assert.throws(() => cosine([1], [1, 2]));
});
test("paragraph chunking preserves page and heading, bounds size, covers text", () => {
  const content =
    "# Budget\n\n" +
    Array.from(
      { length: 160 },
      (_, i) => `Amount${i} is allocated for research.`,
    ).join("\n\n");
  const chunks = chunkPages([{ text: content, page: 7 }], "budget.md", 100, 20);
  assert.ok(chunks.length > 5);
  assert.ok(
    chunks.every(
      (c) =>
        c.page === 7 && c.section === "Budget" && tokenEstimate(c.text) <= 100,
    ),
  );
  assert.ok(chunks.some((c) => c.text.includes("Amount159")));
  assert.equal(new Set(chunks.map((c) => c.id)).size, chunks.length);
});
test("Arabic normalization matches diacritics and alef variants", () => {
  assert.deepEqual(terms("إطْلاق"), terms("اطلاق"));
});
test("hybrid ranking recovers exact rare keywords even with weaker cosine", () => {
  const chunks: Chunk[] = [
    {
      id: "a",
      file: "a",
      page: null,
      section: "",
      text: "The budget is forty dollars",
      embedding: [1, 0],
    },
    {
      id: "b",
      file: "b",
      page: null,
      section: "",
      text: "ZEPHYR launch November 18",
      embedding: [0.8, 0.2],
    },
    {
      id: "c",
      file: "c",
      page: null,
      section: "",
      text: "General notes about meetings",
      embedding: [0.9, 0.1],
    },
  ];
  assert.equal(rank(chunks, [1, 0], "ZEPHYR", 1)[0].id, "b");
});
test("citations must reference real retrieved passages; Arabic abstention", () => {
  const s = rank(
    [
      {
        id: "1",
        file: "a",
        page: null,
        section: "",
        text: "budget",
        embedding: [1],
      },
    ],
    [1],
    "budget",
  );
  assert.ok(validCitations("The budget [1]", s));
  assert.ok(!validCitations("Unknown [9]", s));
  assert.ok(!validCitations("No citation", s));
  assert.match(refusal("ما الميزانية؟"), /لم أجد/);
});

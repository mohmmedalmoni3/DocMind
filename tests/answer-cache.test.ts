import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { config } from "../lib/config";
import { emptyIndex, writeIndex } from "../lib/index-store";
import { answer } from "../lib/rag";
import type { RagEvent } from "../lib/types";

test("answer replay preserves sources and invalidates for revisions, scope, history; eval bypasses cache", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "docmind-cache-"));
  const original = config.data;
  config.data = dir;
  t.after(async () => {
    config.data = original;
    await fs.rm(dir, { recursive: true, force: true });
  });
  let chats = 0;
  let truncated = false;
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
      if (!body.stream)
        return Response.json({
          message: { content: "What is the budget?" },
          done: true,
        });
      return new Response(
        JSON.stringify({
          message: { content: "The budget is 42 [1]." },
          done: true,
          done_reason: truncated ? "length" : "stop",
        }) + "\n",
      );
    },
  );
  const index = emptyIndex();
  index.updatedAt = "v1";
  index.chunks = ["a.md", "b.md"].map((file, i) => ({
    id: String(i),
    file,
    page: null,
    section: "Budget",
    text: "The budget is 42.",
    embedding: [1, 0],
  }));
  await writeIndex(index);
  const events: RagEvent[] = [];
  const ask = () => answer("What is the budget?", [], (e) => events.push(e));
  const first = await ask();
  const evidenceAt = events.findIndex((e) => e.type === "sources");
  assert.ok(evidenceAt >= 0 && evidenceAt < events.findIndex((e) => e.type === "token"));
  assert.ok(events.some((e) => e.type === "sources" && typeof e.evidenceMs === "number"));
  assert.equal(chats, 1);
  const second = await ask();
  assert.equal(chats, 1);
  assert.deepEqual(first, second);
  assert.ok(events.some((e) => e.type === "done" && e.cached));
  await answer("What is the budget?", [], () => {}, { bypassCache: true });
  assert.equal(chats, 2);
  await answer("What is the budget?", [], () => {}, { file: "b.md" });
  assert.equal(chats, 3);
  await answer(
    "What is the budget?",
    [{ role: "user", content: "Earlier question" }],
    () => {},
  );
  assert.equal(chats, 5);
  index.updatedAt = "v2";
  index.chunks[0].id = "new";
  await writeIndex(index);
  await ask();
  assert.equal(chats, 6);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    answer("What is the budget?", [], () => {}, { signal: controller.signal }),
  );
  assert.equal(chats, 6);
  truncated = true;
  await assert.rejects(
    answer("A different question", [], () => {}),
    /answer limit/,
  );
  truncated = false;
  await answer("A different question", [], () => {});
  assert.equal(chats, 8);
  const scoped = await answer("What is the budget?", [], () => {}, {
    files: ["b.md"],
  });
  assert.ok(scoped.sources.every((source) => source.file === "b.md"));
  const both = await answer("What is the budget?", [], () => {}, {
    files: ["a.md", "b.md"],
  });
  assert.deepEqual(
    new Set(both.sources.map((source) => source.file)),
    new Set(["a.md", "b.md"]),
  );
  const beforeReplay = chats;
  await answer("What is the budget?", [], () => {}, {
    files: ["b.md", "a.md"],
  });
  assert.equal(
    chats,
    beforeReplay,
    "attachment ordering must not invalidate answer reuse",
  );
  await assert.rejects(
    answer("What is the budget?", [], () => {}, { files: ["missing.md"] }),
    /not indexed/,
  );
  await assert.rejects(
    answer("Compare budgets", [], () => {}, {
      files: ["a.md"],
      compareFiles: ["a.md", "b.md"],
    }),
    /must be attached/,
  );
});

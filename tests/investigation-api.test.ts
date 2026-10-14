import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { config } from "../lib/config";
import { emptyIndex, writeIndex } from "../lib/index-store";
import { buildInvestigation } from "../lib/investigation";
import { POST as scan } from "../app/api/investigate/route";
import { POST as versions } from "../app/api/versions/route";
test("saved investigation and version APIs work without model calls, enforce scope and reject cross-origin requests", async (t) => {
  const dir = await fs.mkdtemp(
    path.join(os.tmpdir(), "docmind-investigation-api-"),
  );
  const original = config.data;
  config.data = dir;
  t.after(async () => {
    config.data = original;
    await fs.rm(dir, { recursive: true, force: true });
  });
  let networkCalls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    networkCalls++;
    throw new Error("No network/model needed");
  });
  const index = emptyIndex();
  index.documents = ["old.md", "new.md", "other.md"].map((name, i) => ({
    name,
    hash: String(i),
    chunks: 1,
    bytes: 1,
    pages: 1,
    indexedAt: "test",
  }));
  index.chunks = index.documents.map((document, i) => ({
    id: String(i),
    file: document.name,
    page: i + 1,
    section: "Budget",
    embedding: [1],
    text: `# Project Vega\nProject Vega's March 2026 total budget is $${i === 0 ? "12000" : "15000"}.`,
  }));
  index.investigation = buildInvestigation(index);
  await writeIndex(index);
  const request = (body: unknown, origin = "http://localhost") =>
    new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json", origin },
      body: JSON.stringify(body),
    });
  const reportResponse = await scan(request({ files: ["old.md", "new.md"] }));
  assert.equal(reportResponse.status, 200);
  const report = await reportResponse.json();
  assert.equal(report.findings.length, 1);
  assert.deepEqual(
    new Set(
      report.findings[0].facts.map(
        (fact: { source: { file: string } }) => fact.source.file,
      ),
    ),
    new Set(["old.md", "new.md"]),
  );
  const diffResponse = await versions(
    request({ before: "old.md", after: "new.md", files: ["old.md", "new.md"] }),
  );
  assert.equal(diffResponse.status, 200);
  const diff = await diffResponse.json();
  assert.equal(diff.counts.changed, 1);
  assert.equal(diff.changes[0].after.source.file, "new.md");
  assert.equal(
    (
      await versions(
        request({
          before: "old.md",
          after: "other.md",
          files: ["old.md", "new.md"],
        }),
      )
    ).status,
    400,
  );
  assert.equal((await scan(request({ files: ["missing.md"] }))).status, 400);
  assert.equal(
    (await scan(request({ files: ["old.md"] }, "https://untrusted.example")))
      .status,
    400,
  );
  assert.equal(networkCalls, 0);
  delete index.investigation;
  await writeIndex(index);
  const missing = await scan(request({ files: ["old.md"] }));
  assert.equal(missing.status, 409);
  assert.equal((await missing.json()).needsIndex, true);
});

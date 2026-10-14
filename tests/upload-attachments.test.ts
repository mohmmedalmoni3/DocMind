import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { config } from "../lib/config";
import { POST } from "../app/api/documents/route";
import { readIndex } from "../lib/index-store";

test("multi-file upload returns indexed attachment names and preserves same-name originals", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "docmind-attachments-"));
  const original = { docs: config.docs, data: config.data };
  config.docs = path.join(dir, "docs");
  config.data = path.join(dir, "index");
  t.after(async () => {
    Object.assign(config, original);
    await fs.rm(dir, { recursive: true, force: true });
  });
  t.mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    return Response.json({ embeddings: body.input.map(() => [1, 0]) });
  });
  const upload = async (names: string[]) => {
    const form = new FormData();
    for (const name of names)
      form.append("files", new File([name === "budget.md"
        ? "# Budget\n\nThe total budget is $48,000."
        : "# Biology\n\nMitochondria produce cellular energy."], name));
    const response = await POST(new Request("http://localhost/api/documents", { method: "POST", body: form }));
    assert.equal(response.status, 200);
    const events = (await response.text()).split("\n\n").filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)));
    assert.ok(!events.some((event) => event.type === "error"));
    return events.find((event) => event.type === "complete");
  };
  const first = await upload(["budget.md", "biology.md"]);
  assert.deepEqual(first.uploadedFiles, ["budget.md", "biology.md"]);
  const again = await upload(["budget.md"]);
  assert.deepEqual(again.uploadedFiles, ["budget-1.md"]);
  const index = await readIndex();
  assert.deepEqual(new Set(index.documents.map((document) => document.name)),
    new Set(["budget.md", "budget-1.md", "biology.md"]));
  assert.equal(await fs.readFile(path.join(config.docs, "budget.md"), "utf8"),
    "# Budget\n\nThe total budget is $48,000.");
});

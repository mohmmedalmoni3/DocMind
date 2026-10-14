import test from "node:test";
import assert from "node:assert/strict";
import { consume } from "../lib/client";
test("SSE preserves UTF-8 across byte boundaries and handles final unterminated event", async () => {
  const bytes = new TextEncoder().encode(
    'data: {"type":"token","text":"أطلس"}\n\n: keepalive\n\ndata: {"type":"done"}',
  );
  const response = new Response(
    new ReadableStream({
      start(c) {
        for (const byte of bytes) c.enqueue(new Uint8Array([byte]));
        c.close();
      },
    }),
  );
  const events: unknown[] = [];
  await consume(response, (e) => events.push(e));
  assert.deepEqual(events, [{ type: "token", text: "أطلس" }, { type: "done" }]);
});
test("SSE does not silently accept a truncated answer", async () => {
  await assert.rejects(
    () =>
      consume(
        new Response('data: {"type":"token","text":"partial"}\n\n'),
        () => {},
      ),
    /before completion/,
  );
});

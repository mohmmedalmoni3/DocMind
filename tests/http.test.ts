import test from "node:test";
import assert from "node:assert/strict";
import { sameOrigin } from "../lib/http";
test("origin validation uses the original Host when Next normalizes URL", () => {
  assert.doesNotThrow(() =>
    sameOrigin(
      new Request("http://localhost:3000/api/chat", {
        headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
      }),
    ),
  );
  assert.throws(() =>
    sameOrigin(
      new Request("http://localhost:3000/api/chat", {
        headers: { host: "127.0.0.1:3000", origin: "https://evil.example" },
      }),
    ),
  );
  assert.throws(() =>
    sameOrigin(
      new Request("http://evil.example/api/chat", {
        headers: { host: "evil.example" },
      }),
    ),
  );
});

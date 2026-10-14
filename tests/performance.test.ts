import test from "node:test";
import assert from "node:assert/strict";
import { LocalCache, cacheKey } from "../lib/cache";
import { contextSize } from "../lib/ollama";

test("local cache expires entries, evicts least-used entries, and isolates mutations", (t) => {
  t.mock.method(Date, "now", () => 1000);
  const cache = new LocalCache<{ text: string }>(2, 100);
  cache.set("a", { text: "original" });
  cache.set("b", { text: "second" });
  cache.get("a")!.text = "mutated";
  assert.equal(cache.get("a")?.text, "original");
  cache.set("c", { text: "third" });
  assert.equal(cache.get("b"), undefined);
  t.mock.method(Date, "now", () => 1101);
  assert.equal(cache.get("a"), undefined);
});

test("cache keys distinguish document revisions, scopes, conversations and models", () => {
  const base = ["revision1", "qwen", "question", ["history"], "a.md"];
  const key = cacheKey(...base);
  assert.equal(key, cacheKey(...base));
  for (let i = 0; i < base.length; i++) {
    const changed = [...base];
    changed[i] = "different";
    assert.notEqual(cacheKey(...changed), key);
  }
});

test("context allocation grows for long evidence and Arabic rather than dropping sources", () => {
  assert.ok(contextSize("Short question", 640) >= 4096);
  const long = "مصادر عربية موثقة ".repeat(2000);
  assert.ok(contextSize(long, 640) > 8192);
});

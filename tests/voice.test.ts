import test from "node:test";
import assert from "node:assert/strict";
import { spokenText } from "../lib/voice-text";
import { runVoice } from "../lib/voice-server";

test("spoken answers remove code, images and citations without dropping Arabic or link labels", () => {
  assert.equal(
    spokenText(
      "## المدة\n**20 ساعة** [1]. [التفاصيل](https://example.com)\n![image](bad)\n```js\nsecret()\n```",
    ),
    "المدة 20 ساعة . التفاصيل",
  );
  assert.equal(spokenText("![only image](source)"), "");
});
test("a cancelled speech request never launches inference", async () => {
  const controller = new AbortController();
  controller.abort();
  assert.throws(() =>
    runVoice(
      { action: "speak", text: "hello", language: "en" },
      controller.signal,
    ),
  );
});

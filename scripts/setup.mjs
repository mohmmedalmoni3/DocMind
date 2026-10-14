import fs from "node:fs";
import { spawnSync } from "node:child_process";
if (!fs.existsSync(".env")) fs.copyFileSync(".env.example", ".env");
process.loadEnvFile(".env");
const base = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
try {
  await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) });
} catch {
  console.error(
    "Start the Ollama desktop app (or run ollama serve in another terminal), then run npm run setup again.",
  );
  process.exit(1);
}
for (const model of [
  process.env.OLLAMA_MODEL || "qwen2.5:3b",
  process.env.EMBEDDING_MODEL || "bge-m3",
]) {
  const result = spawnSync("ollama", ["pull", model], { stdio: "inherit" });
  if (result.error || result.status !== 0) {
    console.error(result.error?.message || `Could not install ${model}`);
    process.exit(1);
  }
}
console.log(
  "\nReady. Run npm run ingest, then npm run dev. All runtime inference stays local.",
);

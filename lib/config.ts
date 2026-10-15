import path from "node:path";
function number(name: string, fallback: number, min: number, max: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(n) || n < min || n > max)
    throw new Error(`${name} must be between ${min} and ${max}`);
  return n;
}
const url = new URL(process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434");
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
  !["http:", "https:"].includes(url.protocol)
)
  throw new Error("DocMind only permits a loopback Ollama URL.");
export const config = {
  ollama: url.origin,
  model: process.env.OLLAMA_MODEL || "qwen2.5:3b",
  strictModel: process.env.OLLAMA_STRICT_MODEL === 'true',
  serviceRouting: process.env.SERVICE_ROUTING !== 'false',
  serviceContext: process.env.SERVICE_CONTEXT === 'whole' ? 'whole' : 'chunks',
  serviceContextTokens: number('SERVICE_CONTEXT_TOKENS', 3000, 500, 6000),
  fallback: process.env.OLLAMA_FALLBACK_MODEL || "llama3.2:3b",
  embedding: process.env.EMBEDDING_MODEL || "bge-m3",
  docs: path.resolve(process.env.DOCS_DIR || "./docs"),
  data: path.resolve(process.env.INDEX_DIR || "./data"),
  topK: number("TOP_K", 5, 1, 12),
  rerank: process.env.RERANK_MODE==='ollama',
  rerankCandidates: number('RERANK_CANDIDATES',12,2,30),
  rerankTimeout: number('RERANK_TIMEOUT_MS',1500,100,15000),
  briefTopK: number("BRIEF_TOP_K", 3, 1, 12),
  directFacts: process.env.DIRECT_FACTS !== "false",
  chunkTokens: number("CHUNK_TOKENS", 500, 100, 1500),
  overlap: number("CHUNK_OVERLAP", 80, 0, 200),
  threshold: number("MIN_SIMILARITY", 0.3, 0, 1),
  timeout: number("OLLAMA_TIMEOUT_MS", 180000, 1000, 600000),
  contextSize: number("OLLAMA_CONTEXT_SIZE", 4096, 2048, 32768),
  answerTokens: number("ANSWER_MAX_TOKENS", 640, 256, 2000),
  keepAlive: process.env.OLLAMA_KEEP_ALIVE || "30m",
  maxUpload: number("MAX_UPLOAD_MB", 20, 1, 100) * 1024 * 1024,
};
export const fingerprint = `v3:${config.embedding}:${config.chunkTokens}:${config.overlap}`;

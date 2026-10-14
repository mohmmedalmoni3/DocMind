import { config } from "./config";
import type { ChatTurn } from "./types";
import { LocalCache, cacheKey } from "./cache";
import { tokenEstimate } from "./chunking";
const queryVectors = new LocalCache<number[][]>(128);
export function contextSize(text: string, outputTokens: number) {
  // Retain all evidence; grow the context for long documents/Arabic instead of truncating it.
  const needed =
    Math.ceil((tokenEstimate(text) * 1.5 + outputTokens + 512) / 1024) * 1024;
  return Math.max(config.contextSize, needed);
}
export async function ollama(
  path: string,
  body?: unknown,
  signal?: AbortSignal,
) {
  const timeout = AbortSignal.timeout(config.timeout);
  let response: Response;
  try {
    response = await fetch(`${config.ollama}${path}`, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
      cache: "no-store",
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error(
      "Ollama is unavailable or timed out. Start Ollama, then check /health.",
    );
  }
  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Ollama ${response.status}: ${error.slice(0, 350)}. Check /health and install the configured model.`,
    );
  }
  return response;
}
export async function models() {
  const data = await (await ollama("/api/tags")).json();
  return (data.models as { name: string }[]).map((m) => m.name);
}
export function hasModel(names: string[], model: string) {
  return names.includes(model) || names.includes(`${model}:latest`);
}
export async function generationModel() {
  const names = await models();
  if (hasModel(names, config.model)) return config.model;
  if (!config.strictModel && hasModel(names, config.fallback)) return config.fallback;
  if(config.strictModel)throw new Error(`Required competition model ${config.model} is missing. Automatic fallback is disabled.`);
  throw new Error(
    `Generation model missing. Run ollama pull ${config.model} (or ${config.fallback}).`,
  );
}
export async function embed(
  texts: string[],
  query = false,
  signal?: AbortSignal,
): Promise<number[][]> {
  signal?.throwIfAborted();
  const key = cacheKey(config.ollama, config.embedding, query, texts);
  const cached = query ? queryVectors.get(key) : undefined;
  if (cached) return cached;
  const input = texts.map((t) =>
    config.embedding.startsWith("nomic-embed-text")
      ? `${query ? "search_query" : "search_document"}: ${t}`
      : t,
  );
  const data = await (
    await ollama(
      "/api/embed",
      {
        model: config.embedding,
        input,
        truncate: false,
        keep_alive: config.keepAlive,
      },
      signal,
    )
  ).json();
  const vectors = data.embeddings as number[][];
  if (
    !Array.isArray(vectors) ||
    vectors.length !== texts.length ||
    vectors.some((v) => !Array.isArray(v) || !v.length || v.length!==vectors[0]?.length || v.some((x) => !Number.isFinite(x)) || !v.some(x=>x!==0))
  )
    throw new Error("Ollama returned invalid embeddings.");
  signal?.throwIfAborted();
  if (query) queryVectors.set(key, vectors);
  return vectors;
}
export async function complete(
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  signal?: AbortSignal,
  json = false,
  maxTokens = config.answerTokens,
): Promise<string> {
  const data = await (
    await ollama(
      "/api/chat",
      {
        model,
        messages,
        stream: false,
        keep_alive: config.keepAlive,
        ...(json ? { format: "json" } : {}),
        options: {
          temperature: 0,
          num_ctx: contextSize(
            messages.map((m) => m.content).join("\n"),
            maxTokens,
          ),
          num_predict: maxTokens,
        },
      },
      signal,
    )
  ).json();
  if (data.done_reason === "length")
    throw new Error(
      "The model reached its answer limit. Ask a narrower question or increase ANSWER_MAX_TOKENS.",
    );
  return data.message?.content?.trim() || "";
}
export async function* generate(
  model: string,
  system: string,
  user: string,
  signal?: AbortSignal,
  maxTokens = config.answerTokens,
) {
  const response = await ollama(
    "/api/chat",
    {
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: true,
      keep_alive: config.keepAlive,
      options: {
        temperature: 0,
        num_ctx: contextSize(system + user, maxTokens),
        num_predict: maxTokens,
      },
    },
    signal,
  );
  if (!response.body) throw new Error("No response stream from Ollama.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let completed = false;
  function parse(line: string) {
    const data = JSON.parse(line);
    if (data.error) throw new Error(data.error);
    if (data.done_reason === "length")
      throw new Error(
        "The model reached its answer limit. Ask a narrower question or increase ANSWER_MAX_TOKENS.",
      );
    if (data.done) completed = true;
    return data.message?.content as string | undefined;
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop() || "";
      for (const line of lines) {
        if (line.trim()) {
          const token = parse(line);
          if (token) yield token;
        }
      }
      if (done) break;
    }
    if (pending.trim()) {
      const token = parse(pending);
      if (token) yield token;
    }
    if (!completed)
      throw new Error(
        "Ollama stopped before completing the answer. Please retry.",
      );
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export async function rewrite(
  question: string,
  history: ChatTurn[],
  model: string,
  signal?: AbortSignal,
) {
  if (!history.length) return question;
  const previous =
    history
      .filter((m) => m.role === "user")
      .at(-1)
      ?.content.slice(0, 1200) || "";
  const fallback = previous
    ? `${question}\nReference question: ${previous}`
    : question;
  const result = await complete(
    model,
    [
      {
        role: "system",
        content:
          'Resolve references in the last QUESTION using history. Return JSON {"query":"standalone question"}. Replace pronouns with the exact subject from the previous question. Preserve the requested attribute, names, dates and language. Do not answer, assert an owner or add facts. If history asks about a budget and the last question is Who owns it?, the query must ask who owns that budget.',
      },
      ...history.slice(-6),
      { role: "user", content: question },
    ],
    signal,
    true,
    180,
  );
  try {
    const query = JSON.parse(result).query;
    if (
      typeof query === "string" &&
      query.length <= 1500 &&
      /[?؟]\s*$/.test(query.trim())
    )
      return query.trim();
  } catch {
    /* Preserve the user's exact question rather than accept an invented rewrite. */
  }
  return fallback;
}

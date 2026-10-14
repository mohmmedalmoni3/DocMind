import { config, fingerprint } from "@/lib/config";
import { models, hasModel } from "@/lib/ollama";
import { readIndex } from "@/lib/index-store";
import { voiceStatus } from "@/lib/voice-server";
export const dynamic = "force-dynamic";
export async function GET() {
  const index = await readIndex().catch(() => null);
  let available: string[] = [];
  let error = "";
  try {
    available = await models();
  } catch (e) {
    error = (e as Error).message;
  }
  const generation = hasModel(available, config.model)
    ? config.model
    : !config.strictModel && hasModel(available, config.fallback)
      ? config.fallback
      : null;
  const embedding = hasModel(available, config.embedding);
  return Response.json({
    ready:
      !error &&
      !!generation &&
      embedding &&
      !!index?.chunks.length &&
      index.fingerprint === fingerprint,
    ollama: !error,
    url: config.ollama,
    generation,
    configured: config.model,
    strictModel: config.strictModel,
    serviceContext: config.serviceContext,
    fallback: config.fallback,
    embedding: { name: config.embedding, ready: embedding },
    index: {
      documents: index?.documents.length || 0,
      chunks: index?.chunks.length || 0,
      compatible: index?.fingerprint === fingerprint,
    },
    available,
    voice: await voiceStatus(),
    error,
  });
}

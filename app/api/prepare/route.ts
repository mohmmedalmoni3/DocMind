import { generationModel, ollama, embed } from "@/lib/ollama";
import { readIndex } from "@/lib/index-store";
import { config, fingerprint } from "@/lib/config";
import { sameOrigin, errorResponse, sse } from "@/lib/http";
import { voiceStatus, runVoice } from "@/lib/voice-server";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    return sse(request, async (emit, signal) => {
      const start = performance.now();
      const step = async (name: string, work: () => Promise<unknown>) => {
        const t = performance.now();
        emit({ type: "progress", name, status: "running" });
        await work();
        emit({
          type: "progress",
          name,
          status: "done",
          ms: Math.round(performance.now() - t),
        });
      };
      await step("فحص مكتبة المستندات", async () => {
        const index = await readIndex();
        if (!index.chunks.length || index.fingerprint !== fingerprint)
          throw new Error("أضف المستندات وأعد الفهرسة أولًا.");
      });
      const model = await generationModel();
      await step("تجهيز محرك الإجابات", () =>
        ollama(
          "/api/chat",
          {
            model,
            messages: [],
            stream: false,
            keep_alive: config.keepAlive,
            options: { num_ctx: config.contextSize },
          },
          signal,
        ),
      );
      await step("تجهيز محرك البحث", () =>
        embed(["DocMind readiness"], true, signal),
      );
      const voice = await voiceStatus();
      if (voice.ready)
        await step("تجهيز الصوت المحلي", () =>
          runVoice({ action: "warmup" }, signal),
        );
      emit({
        type: "complete",
        model,
        ms: Math.round(performance.now() - start),
        voice: voice.ready,
      });
    });
  } catch (e) {
    return errorResponse(e);
  }
}

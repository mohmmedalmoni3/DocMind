import { z } from "zod";
import { sameOrigin, errorResponse } from "@/lib/http";
import { runVoice, voiceStatus } from "@/lib/voice-server";
import { spokenText } from "@/lib/voice-text";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  return Response.json(await voiceStatus());
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (Number(request.headers.get("content-length") || 0) > 9 * 1024 * 1024)
      return Response.json(
        { error: "التسجيل يتجاوز الحجم المسموح." },
        { status: 413 },
      );
    const status = await voiceStatus();
    const type = request.headers.get("content-type") || "";
    if (type.includes("application/json")) {
      const body = z
        .object({
          text: z.string().min(1).max(8000),
          language: z.enum(["ar", "en"]),
        })
        .parse(await request.json());
      if (!status.voices[body.language])
        return Response.json(
          { error: "ثبّت الصوت المحلي أولًا: npm run setup:voice" },
          { status: 503 },
        );
      const text = spokenText(body.text);
      if (!text)
        return Response.json(
          { error: "لا يوجد نص قابل للقراءة في هذه الإجابة." },
          { status: 400 },
        );
      const result = await runVoice(
        { action: "speak", text, language: body.language },
        request.signal,
      );
      if (!result.audio) throw new Error("Local voice returned no audio.");
      return new Response(Buffer.from(result.audio, "base64"), {
        headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
      });
    }
    if (!status.transcribe)
      return Response.json(
        { error: "ثبّت التفريغ المحلي أولًا: npm run setup:voice" },
        { status: 503 },
      );
    const form = await request.formData();
    const audio = form.get("audio");
    const language = z
      .enum(["ar", "en", "auto"])
      .parse(form.get("language") || "ar");
    if (!(audio instanceof File) || !audio.size || audio.size > 8 * 1024 * 1024)
      return Response.json(
        { error: "التسجيل فارغ أو يتجاوز 8 ميغابايت." },
        { status: 400 },
      );
    if (
      !/^(audio\/(webm|wav|x-wav|ogg|mp4|x-m4a|mpeg)|video\/webm)/i.test(
        audio.type,
      )
    )
      return Response.json(
        { error: "صيغة التسجيل غير مدعومة." },
        { status: 400 },
      );
    const result = await runVoice(
      {
        action: "transcribe",
        audio: Buffer.from(await audio.arrayBuffer()).toString("base64"),
        language,
      },
      request.signal,
    );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

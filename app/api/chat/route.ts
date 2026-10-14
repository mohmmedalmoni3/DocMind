import { z } from "zod";
import { answer } from "@/lib/rag";
import { sameOrigin, errorResponse, sse } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({
  question: z.string().trim().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(12000),
      }),
    )
    .max(20)
    .default([]),
  file: z.string().max(250).optional(),
  files: z.array(z.string().min(1).max(250)).min(1).max(100).optional(),
  summary: z.boolean().optional(),
  style: z.enum(["brief", "detailed", "decision"]).default("brief"),
  compareFiles: z
    .tuple([z.string().min(1).max(250), z.string().min(1).max(250)])
    .optional(),
});
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = schema.parse(await request.json());
    return sse(request, (emit, signal) =>
      answer(body.question, body.history, emit, {
        file: body.file,
        files: body.files,
        summary: body.summary,
        signal,
        style: body.style,
        compareFiles: body.compareFiles,
      }),
    );
  } catch (e) {
    return errorResponse(e);
  }
}

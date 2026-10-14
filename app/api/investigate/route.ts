import { z } from "zod";
import { readIndex } from "@/lib/index-store";
import { investigationFindings, evidenceSource } from "@/lib/investigation";
import { resolveDocumentScope } from "@/lib/document-scope";
import { sameOrigin, errorResponse } from "@/lib/http";
import { fingerprint } from "@/lib/config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({
  files: z.array(z.string().min(1).max(250)).min(1).max(100).optional(),
});
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = schema.parse(await request.json());
    const index = await readIndex();
    if (index.fingerprint !== fingerprint)
      throw new Error("Re-index your documents after changing settings.");
    const files =
      resolveDocumentScope(index, body.files) ||
      index.documents.map((d) => d.name);
    if (!index.investigation || index.investigation.version !== 1)
      return Response.json(
        {
          error: "أعد فهرسة المكتبة مرة واحدة لتجهيز محقق المستندات.",
          needsIndex: true,
        },
        { status: 409 },
      );
    const findings = investigationFindings(index.investigation, files);
    return Response.json(
      {
        builtAt: index.investigation.builtAt,
        files,
        factCount: index.investigation.documents
          .filter((d) => files.includes(d.file))
          .reduce((count, d) => count + d.facts.length, 0),
        findings: findings.map((finding) => ({
          ...finding,
          facts: finding.facts.map((fact, i) => ({
            ...fact,
            source: evidenceSource(index, fact.chunkId, i + 1),
          })),
        })),
        limits:
          "فحص محلي للحقائق الصريحة المدعومة: الميزانيات ومدد التدريب والساعات ومسؤولي الإطلاق والإصدار والسجلات وبعض المواعيد. لا يشمل كل معنى في المستندات؛ غياب النتائج لا يثبت خلوها من التعارض.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

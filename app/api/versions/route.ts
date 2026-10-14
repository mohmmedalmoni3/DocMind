import { z } from "zod";
import { readIndex } from "@/lib/index-store";
import { compareVersions } from "@/lib/version-diff";
import { sameOrigin, errorResponse } from "@/lib/http";
import { resolveDocumentScope } from "@/lib/document-scope";
import { evidenceSource } from "@/lib/investigation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({
  before: z.string().min(1).max(250),
  after: z.string().min(1).max(250),
  files: z.array(z.string().min(1).max(250)).min(1).max(100).optional(),
});
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const body = schema.parse(await request.json());
    const index = await readIndex();
    resolveDocumentScope(index, body.files, body.before);
    resolveDocumentScope(index, body.files, body.after);
    const report = compareVersions(index, body.before, body.after);
    report.changes = report.changes.map((change) => ({
      ...change,
      before: change.before
        ? {
            ...change.before,
            source: evidenceSource(index, change.before.chunkId),
          }
        : undefined,
      after: change.after
        ? {
            ...change.after,
            source: evidenceSource(index, change.after.chunkId),
          }
        : undefined,
    }));
    return Response.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}

import { ingest } from "@/lib/ingest";
import { sameOrigin, errorResponse, sse } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    return sse(request, (emit, signal) => ingest(emit, signal));
  } catch (e) {
    return errorResponse(e);
  }
}

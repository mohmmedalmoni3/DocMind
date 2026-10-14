import fs from "node:fs/promises";
import path from "node:path";
import { config } from "@/lib/config";
import { readIndex } from "@/lib/index-store";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const file = new URL(request.url).searchParams.get("file") || "",
      index = await readIndex();
    if (
      !file ||
      path.isAbsolute(file) || file.split("/").some(part=>part===".." || part==="." || !part) ||
      /[\\\x00-\x1f]/.test(file) ||
      !index.documents.some((d) => d.name === file) ||
      !file.toLowerCase().endsWith(".pdf")
    )
      return Response.json(
        { error: "Indexed PDF not found." },
        { status: 404 },
      );
    const base = await fs.realpath(config.docs),
      actual = await fs.realpath(path.join(base, file)),
      relative = path.relative(base, actual);
    if (relative.startsWith("..") || path.isAbsolute(relative))
      return Response.json({ error: "Source unavailable." }, { status: 404 });
    const bytes = await fs.readFile(actual);
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file)}`,
      },
    });
  } catch (e) {
    return errorResponse(e, 404);
  }
}

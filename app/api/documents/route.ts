import fs from "node:fs/promises";
import path from "node:path";
import { config, fingerprint } from "@/lib/config";
import { readIndex } from "@/lib/index-store";
import { ingest } from "@/lib/ingest";
import { extensions } from "@/lib/extract";
import { sameOrigin, errorResponse, sse } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const index = await readIndex();
    return Response.json({
      documents: index.documents,
      chunks: index.chunks.length,
      updatedAt: index.updatedAt,
      model: config.model,
      embedding: config.embedding,
      stale: index.fingerprint !== fingerprint,
      maxUpload: config.maxUpload,
    });
  } catch (e) {
    return errorResponse(e, 500);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (
      Number(request.headers.get("content-length") || 0) >
      config.maxUpload * 5
    )
      throw new Error(
        "Upload batch is too large. Upload up to five files at a time.",
      );
    const form = await request.formData();
    const files = form
      .getAll("files")
      .filter((f): f is File => typeof f !== "string");
    if (!files.length || files.length > 5)
      throw new Error("Choose between one and five files.");
    let total = 0;
    for (const file of files) {
      total += file.size;
      const ext = path.extname(file.name).toLowerCase();
      if (!extensions.has(ext))
        throw new Error("Supported formats: PDF, TXT, MD, DOCX.");
      if (file.size > config.maxUpload)
        throw new Error(
          `${file.name} is too large. Limit: ${config.maxUpload / 1024 / 1024} MB.`,
        );
      if (file.size === 0) throw new Error(`${file.name} is empty.`);
      if (
        file.name !== path.basename(file.name) ||
        /[\\/\x00-\x1f]/.test(file.name) ||
        file.name.startsWith(".")
      )
        throw new Error("Invalid filename.");
    }
    if (total > config.maxUpload * 5)
      throw new Error("Upload batch is too large.");
    await fs.mkdir(config.docs, { recursive: true });
    // Never overwrite a local source document. Same-name uploads get a suffix.
    const uploadedFiles: string[] = [];
    for (const file of files) {
      const base = path.parse(file.name);
      let name = file.name;
      for (let i = 0; ; i++) {
        try {
          await fs.writeFile(
            path.join(config.docs, name),
            Buffer.from(await file.arrayBuffer()),
            { flag: "wx" },
          );
          uploadedFiles.push(name);
          break;
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
          name = `${base.name}-${i + 1}${base.ext}`;
        }
      }
    }
    return sse(request, async (emit, signal) => {
      let completion:
        | Extract<import("@/lib/types").IngestEvent, { type: "complete" }>
        | undefined;
      const index = await ingest((event) => {
        if (event.type === "complete") completion = event;
        else emit(event);
      }, signal);
      if (completion)
        emit({
          ...completion,
          uploadedFiles: uploadedFiles.filter((name) =>
            index.documents.some((document) => document.name === name),
          ),
        });
    });
  } catch (e) {
    return errorResponse(e);
  }
}

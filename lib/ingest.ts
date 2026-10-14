import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { config, fingerprint } from "./config";
import { chunkPages } from "./chunking";
import { extract, extensions } from "./extract";
import { embed } from "./ollama";
import {
  emptyIndex,
  readIndex,
  writeIndex,
  withIndexLock,
} from "./index-store";
import type { IngestEvent } from "./types";
import { buildInvestigation } from "./investigation";
async function walk(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    if (e.isSymbolicLink()) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else if (extensions.has(path.extname(e.name).toLowerCase())) files.push(p);
  }
  return files.sort();
}
export async function ingest(
  emit: (e: IngestEvent) => void = () => {},
  signal?: AbortSignal,
) {
  return withIndexLock(async () => {
    await fs.mkdir(config.docs, { recursive: true });
    const old = await readIndex();
    const next = emptyIndex();
    const files = await walk(config.docs);
    let cached = 0;
    const warnings: string[] = [];
    for (let i = 0; i < files.length; i++) {
      signal?.throwIfAborted();
      const file = files[i];
      const name = path.relative(config.docs, file).replaceAll("\\", "/");
      const bytes = await fs.readFile(file);
      const hash = createHash("sha256").update(bytes).digest("hex");
      const previous =
        old.documents.find((d) => d.name === name && d.hash === hash) ||
        old.documents.find((d) => d.hash === hash) ||
        next.documents.find((d) => d.hash === hash);
      if (previous && old.fingerprint === fingerprint) {
        const sourceChunks = old.chunks.some((c) => c.file === previous.name)
          ? old.chunks
          : next.chunks;
        const reused = sourceChunks
          .filter((c) => c.file === previous.name)
          .map((c, i) =>
            previous.name === name
              ? c
              : {
                  ...c,
                  file: name,
                  id: createHash("sha256")
                    .update(`${name}:${c.page}:${i}:${c.text}`)
                    .digest("hex")
                    .slice(0, 20),
                },
          );
        next.documents.push({
          ...previous,
          name,
          indexedAt:
            previous.name === name
              ? previous.indexedAt
              : new Date().toISOString(),
        });
        next.chunks.push(...reused);
        cached++;
        emit({
          type: "progress",
          file: name,
          current: i + 1,
          total: files.length,
          message: "Already indexed · cache hit",
        });
        continue;
      }
      emit({
        type: "progress",
        file: name,
        current: i,
        total: files.length,
        message: "Extracting text",
      });
      try {
        const pages = await extract(file);
        const chunks = chunkPages(
          pages,
          name,
          config.chunkTokens,
          config.overlap,
        );
        if (!chunks.length) {
          warnings.push(
            `${name}: no readable text. Scanned PDFs require OCR before ingestion.`,
          );
          continue;
        }
        for (let j = 0; j < chunks.length; j += 8) {
          signal?.throwIfAborted();
          emit({
            type: "progress",
            file: name,
            current: i + j / chunks.length,
            total: files.length,
            message: `Embedding ${Math.min(j + 8, chunks.length)} of ${chunks.length} passages`,
          });
          const batch = chunks.slice(j, j + 8);
          const vectors = await embed(
            batch.map((c) => c.text),
            false,
            signal,
          );
          next.chunks.push(
            ...batch.map((c, k) => ({ ...c, embedding: vectors[k] })),
          );
        }
        next.documents.push({
          name,
          hash,
          chunks: chunks.length,
          bytes: bytes.length,
          pages: pages.length,
          indexedAt: new Date().toISOString(),
        });
      } catch (e) {
        if (signal?.aborted) throw e;
        const message = (e as Error).message;
        if (message.includes("Ollama") || message.includes("embeddings"))
          throw e;
        warnings.push(`${name}: ${message}`);
        next.chunks = next.chunks.filter((c) => c.file !== name);
      }
      emit({
        type: "progress",
        file: name,
        current: i + 1,
        total: files.length,
        message: "Indexed",
      });
    }
    next.updatedAt = new Date().toISOString();
    signal?.throwIfAborted();
    emit({
      type: "progress",
      file: "",
      current: files.length,
      total: files.length,
      message: "فحص الحقائق وحفظ أدلة اختلاف المستندات",
    });
    next.investigation = buildInvestigation(next, old.investigation);
    await writeIndex(next);
    emit({
      type: "complete",
      documents: next.documents.length,
      chunks: next.chunks.length,
      cached,
      warnings,
    });
    return next;
  });
}

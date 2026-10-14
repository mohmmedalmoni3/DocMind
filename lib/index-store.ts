import fs from "node:fs/promises";
import path from "node:path";
import { config, fingerprint } from "./config";
import type { Index } from "./types";
let snapshot: { file: string; revision: string; index: Index } | undefined;
let reading: { key: string; promise: Promise<Index> } | undefined;
export function emptyIndex(): Index {
  return {
    version: 3,
    fingerprint,
    embeddingModel: config.embedding,
    updatedAt: "",
    documents: [],
    chunks: [],
  };
}
export async function readIndex(): Promise<Index> {
  try {
    const file = path.join(config.data, "index.json");
    const stat = await fs.stat(file, { bigint: true });
    const revision = `${stat.mtimeNs}:${stat.ctimeNs}:${stat.size}:${stat.ino}`;
    if (snapshot?.file === file && snapshot.revision === revision)
      return snapshot.index;
    const key = `${file}:${revision}`;
    if (reading?.key === key) return reading.promise;
    const promise = fs.readFile(file, "utf8").then((text) => {
      const index = JSON.parse(text) as Index;
      snapshot = { file, revision, index };
      return index;
    });
    reading = { key, promise };
    try {
      return await promise;
    } finally {
      if (reading?.promise === promise) reading = undefined;
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return emptyIndex();
    throw new Error(
      "Index could not be read. Move the damaged data/index.json aside and re-ingest.",
    );
  }
}
export async function writeIndex(index: Index) {
  await fs.mkdir(config.data, { recursive: true });
  const temp = path.join(config.data, `index-${process.pid}.tmp`);
  await fs.writeFile(temp, JSON.stringify(index));
  await fs.rename(temp, path.join(config.data, "index.json"));
  snapshot = undefined;
}
export async function withIndexLock<T>(fn: () => Promise<T>): Promise<T> {
  await fs.mkdir(config.data, { recursive: true });
  const name = path.join(config.data, "ingest.lock");
  let lock;
  try {
    lock = await fs.open(name, "wx");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST")
      throw new Error(
        "An ingestion is already running. Wait for it to finish. If a process crashed, remove data/ingest.lock.",
      );
    throw e;
  }
  try {
    await lock.writeFile(`${process.pid}`);
    return await fn();
  } finally {
    await lock.close();
    await fs.unlink(name).catch(() => {});
  }
}

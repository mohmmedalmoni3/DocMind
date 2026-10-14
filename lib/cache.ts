import { createHash } from "node:crypto";

/** Bounded process-local LRU: document content and answers never leave this device. */
export class LocalCache<T> {
  private entries = new Map<string, { value: T; expires: number }>();
  constructor(
    private limit = 100,
    private ttlMs = 30 * 60_000,
  ) {}
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    if (entry.expires <= Date.now()) return;
    this.entries.set(key, entry);
    return structuredClone(entry.value);
  }
  set(key: string, value: T) {
    this.entries.delete(key);
    this.entries.set(key, {
      value: structuredClone(value),
      expires: Date.now() + this.ttlMs,
    });
    while (this.entries.size > this.limit)
      this.entries.delete(this.entries.keys().next().value!);
  }
}
export function cacheKey(...parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

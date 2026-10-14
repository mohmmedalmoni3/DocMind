import { normalizedAnswer } from "./normalization";
import type { Index, Chunk, Source } from "./types";

export type PassageVersion = {
  text: string;
  file: string;
  chunkId: string;
  page: number | null;
  section: string;
  source?: Source;
};
export type VersionChange = {
  kind: "added" | "removed" | "changed";
  before?: PassageVersion;
  after?: PassageVersion;
  beforeWords?: { text: string; changed: boolean }[];
  afterWords?: { text: string; changed: boolean }[];
};
export type VersionReport = {
  before: string;
  after: string;
  sameContent: boolean;
  unchanged: number;
  counts: { added: number; removed: number; changed: number };
  changes: VersionChange[];
  truncated: boolean;
  scope: "indexed-passages";
};
export type IndexedPassage = PassageVersion & { terms: string[] };
const reports = new WeakMap<Index, Map<string, VersionReport>>();
const normalized = (text: string) =>
  normalizedAnswer(text).replace(/\s+/g, " ").trim();
export function prepareVersionPassages(chunks: Chunk[]) {
  const seen = new Set<string>();
  const rows: IndexedPassage[] = [];
  let truncated = false;
  for (const c of chunks) {
    for (const text of c.text.split(/\n+|(?<=[.!؟])\s+(?=\p{L})/u)) {
      const key = normalized(text);
      if (key.length < 4 || seen.has(key)) continue;
      seen.add(key);
      if (rows.length >= 1500) {
        truncated = true;
        continue;
      }
      rows.push({
        text: text.trim(),
        file: c.file,
        chunkId: c.id,
        page: c.page,
        section: c.section,
        terms: [...tokens(text)],
      });
    }
  }
  return { rows, truncated };
}
function tokens(text: string) {
  return new Set(normalized(text).match(/[\p{L}\p{N}]+/gu) || []);
}
function similarity(a: Set<string>, b: Set<string>) {
  const common = [...a].filter((word) => b.has(word)).length;
  return common / (a.size + b.size - common || 1);
}
export function wordChanges(before: string, after: string) {
  const a = before.split(/(\s+)/).filter(Boolean),
    b = after.split(/(\s+)/).filter(Boolean);
  // Bounded word LCS; long lines stay intact rather than allocating a huge matrix.
  if (a.length > 300 || b.length > 300)
    return {
      beforeWords: [{ text: before, changed: true }],
      afterWords: [{ text: after, changed: true }],
    };
  const table = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i][j] =
        a[i] === b[j]
          ? 1 + table[i + 1][j + 1]
          : Math.max(table[i + 1][j], table[i][j + 1]);
  const left = a.map((text) => ({ text, changed: true }));
  const right = b.map((text) => ({ text, changed: true }));
  let i = 0,
    j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      left[i++].changed = false;
      right[j++].changed = false;
    } else if (table[i + 1][j] >= table[i][j + 1]) i++;
    else j++;
  }
  return { beforeWords: left, afterWords: right };
}
export function compareVersions(
  index: Index,
  before: string,
  after: string,
): VersionReport {
  if (before === after)
    throw new Error("Choose two different document versions.");
  const records = [before, after].map((name) =>
    index.documents.find((d) => d.name === name),
  );
  if (records.some((record) => !record))
    throw new Error("Document is not indexed.");
  let cached = reports.get(index);
  if (!cached) {
    cached = new Map();
    reports.set(index, cached);
  }
  const key = JSON.stringify([before, after]);
  if (cached.has(key)) return structuredClone(cached.get(key)!);
  const prepared = (file: string) =>
    index.investigation?.documents.find((d) => d.file === file)?.passages ||
    prepareVersionPassages(index.chunks.filter((c) => c.file === file));
  const left = prepared(before),
    right = prepared(after);
  const remaining = new Map(
    right.rows.map((row, i) => [normalized(row.text), i]),
  );
  const unmatched: IndexedPassage[] = [];
  const used = new Set<number>();
  let unchanged = 0;
  for (const row of left.rows) {
    const same = remaining.get(normalized(row.text));
    if (same !== undefined) {
      used.add(same);
      unchanged++;
    } else unmatched.push(row);
  }
  const tokenRows = right.rows.map((row) => new Set(row.terms));
  const changes: VersionChange[] = [];
  for (const row of unmatched) {
    const words = new Set(row.terms);
    let best = -1,
      score = 0.5;
    right.rows.forEach((candidate, i) => {
      if (
        used.has(i) ||
        candidate.text.startsWith("#") !== row.text.startsWith("#")
      )
        return;
      const s = similarity(words, tokenRows[i]);
      if (s > score) {
        score = s;
        best = i;
      }
    });
    if (best >= 0) {
      used.add(best);
      changes.push({
        kind: "changed",
        before: row,
        after: right.rows[best],
        ...wordChanges(row.text, right.rows[best].text),
      });
    } else changes.push({ kind: "removed", before: row });
  }
  right.rows.forEach((row, i) => {
    if (!used.has(i)) changes.push({ kind: "added", after: row });
  });
  const counts = {
    added: changes.filter((change) => change.kind === "added").length,
    removed: changes.filter((change) => change.kind === "removed").length,
    changed: changes.filter((change) => change.kind === "changed").length,
  };
  const result: VersionReport = {
    before,
    after,
    sameContent: records[0]!.hash === records[1]!.hash,
    unchanged,
    counts,
    changes: changes.slice(0, 200),
    truncated: left.truncated || right.truncated || changes.length > 200,
    scope: "indexed-passages",
  };
  if (cached.size >= 8) cached.delete(cached.keys().next().value!);
  cached.set(key, result);
  return structuredClone(result);
}

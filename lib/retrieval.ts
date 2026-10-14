import type { Chunk, Source } from "./types";
import { normalizedAnswer } from './normalization';
const stop = new Set(
  "a an the is are was were be to of and or in on for with what how does do it this that about from can could would please tell me summarize summary document ال في من على عن ما ماذا كيف هو هي هذا هذه إلى و هل".split(
    " ",
  ),
);
const prepared = new WeakMap<
  Chunk[],
  {
    frequencies: Map<string, number>[];
    lengths: number[];
    df: Map<string, number>;
    avg: number;
  }
>();
function prepare(chunks: Chunk[]) {
  const cached = prepared.get(chunks);
  if (cached) return cached;
  const df = new Map<string, number>();
  const lengths: number[] = [];
  const frequencies = chunks.map((c) => {
    const tokens = lexicalTerms(c.text);
    lengths.push(tokens.length);
    const counts = new Map<string, number>();
    for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
    for (const token of counts.keys()) df.set(token, (df.get(token) || 0) + 1);
    return counts;
  });
  const result = {
    frequencies,
    lengths,
    df,
    avg: lengths.reduce((a, b) => a + b, 0) / chunks.length || 1,
  };
  prepared.set(chunks, result);
  return result;
}
export function terms(s: string): string[] {
  return (
    normalizedAnswer(s)
      .match(/[\p{L}\p{N}]+/gu) || []
  ).filter((t) => !stop.has(t));
}
// Conservative article folding for BM25 only. Keep negation and avoid root stemming.
export function lexicalTerms(text: string): string[] {
  return terms(text).map(t=>/^(?:وال|بال|لل|ال)[\u0621-\u064a]{3,}$/.test(t)
    ? t.replace(/^(?:وال|بال|لل|ال)/,'') : t);
}
export function cosine(a: number[], b: number[]) {
  if (a.length !== b.length)
    throw new Error("Embedding dimensions changed. Re-ingest your documents.");
  let dot = 0,
    aa = 0,
    bb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    aa += a[i] ** 2;
    bb += b[i] ** 2;
  }
  return aa && bb ? dot / Math.sqrt(aa * bb) : 0;
}
export function rank(
  chunks: Chunk[],
  vector: number[],
  query: string,
  k = 5,
): Source[] {
  if (!chunks.length) return [];
  const { frequencies, lengths, df: dfs, avg } = prepare(chunks);
  const qt = [...new Set(lexicalTerms(query))];
  const rows = chunks.map((c, i) => {
    let keyword = 0;
    for (const t of qt) {
      const tf = frequencies[i].get(t) || 0;
      const df = dfs.get(t) || 0;
      const idf = Math.log(1 + (chunks.length - df + 0.5) / (df + 0.5));
      keyword +=
        (idf * (tf * 2.2)) / (tf + 1.2 * (0.25 + (0.75 * lengths[i]) / avg));
    }
    return { ...c, similarity: cosine(vector, c.embedding), keyword, score: 0 };
  });
  const semantic = [...rows].sort((a, b) => b.similarity - a.similarity);
  const lexical = [...rows]
    .filter((r) => r.keyword > 0)
    .sort((a, b) => b.keyword - a.keyword);
  semantic.forEach((r, i) => {
    r.score += 1 / (60 + i + 1);
  });
  lexical.forEach((r, i) => {
    r.score += 1 / (60 + i + 1);
  });
  // A table of contents names a topic but usually does not state its answer.
  // Keep it available when explicitly requested; otherwise prefer substantive text.
  if(!/فهرس|table of contents|contents page/iu.test(query))for(const row of rows)
    if(/^(?:فهرس المحتويات|table of contents)|\btable of contents\b/iu.test(row.text.trim().slice(0,120)))row.score*=0.35;
  return rows
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ embedding, ...r }, i) => ({ ...r, citation: i + 1 }));
}
/** Fuse original and canonical query views; neither view can erase the other. */
export function rankQueries(chunks: Chunk[], vectors: number[][], queries: string[], k=5): Source[] {
  if(queries.length===1)return rank(chunks,vectors[0],queries[0],k);
  const merged=new Map<string,Source>();
  queries.forEach((query,i)=>rank(chunks,vectors[i],query,chunks.length).forEach((source,position)=>{
    const old=merged.get(source.id);
    merged.set(source.id,{...source,score:(old?.score||0)+1/(60+position+1),
      similarity:Math.max(old?.similarity??-1,source.similarity),keyword:Math.max(old?.keyword||0,source.keyword)});
  }));
  return [...merged.values()].sort((a,b)=>b.score-a.score).slice(0,k).map((s,i)=>({...s,citation:i+1}));
}

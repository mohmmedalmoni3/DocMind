import type { Source } from "./types";
import { terms } from "./retrieval";
import { normalizedAnswer } from './normalization';

// Repair provenance only for a complete, long source sentence reproduced verbatim.
// Every other claim word must also occur in that passage; ambiguous matches stay unchanged.
export function alignVerbatimCitations(text:string,sources:Source[]) {
  const words=(value:string)=>(normalizedAnswer(value).match(/[\p{L}\p{N}]+/gu)||[]);
  let result=text;
  for(const {citation,claim,offset,end} of claims(text).reverse()) {
    const claimWords=words(claim);
    const joined=' '+claimWords.join(' ')+' ';
    const candidates=sources.filter(source=>{
      const available=new Set(words(source.text));
      if(!claimWords.every(word=>available.has(word)))return false;
      return source.text.split(/[.!?؟\n]+/).some(sentence=>{
        const part=words(sentence);
        return part.length>=8 && joined.includes(' '+part.join(' ')+' ');
      });
    });
    if(candidates.length===1 && candidates[0].citation!==citation)
      result=result.slice(0,offset)+`[${candidates[0].citation}]`+result.slice(end);
  }
  return result;
}

function numbers(text: string) {
  const normalized = text
    .normalize("NFKC")
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660))
    .replace(/[,٬]/g, "");
  return [...new Set(normalized.match(/\d+(?:\.\d+)?/g) || [])];
}
function claims(text: string) {
  const matches = [...text.matchAll(/\[(\d+)\]/g)];
  let previousEnd = 0;
  return matches.map((m, i) => {
    const offset = m.index!,
      end = offset + m[0].length,
      lineStart = text.lastIndexOf("\n", offset - 1) + 1;
    const prefix = /^\s*(?:[-*]|\d+\.)?\s*$/.test(
      text.slice(lineStart, offset),
    );
    const tail = text.slice(
      end,
      Math.min(
        matches[i + 1]?.index ?? text.length,
        text.indexOf("\n", end) < 0 ? text.length : text.indexOf("\n", end),
      ),
    );
    const lineBefore = text.slice(lineStart, offset);
    const pipes = [...lineBefore.matchAll(/(?<!\\)\|/g)];
    const claim = (
      pipes.length
        ? lineBefore.slice(pipes.at(-1)!.index! + 1)
        : prefix
          ? tail.split(/(?<=[.!?؟])\s+/)[0]
          : text.slice(previousEnd, offset)
    )
      .replace(/^\s*#{1,6}[^\n]*\n/gm, "")
      .replace(/^\s*(?:>\s*)?(?:\d{1,2}[.)]\s+|[-*]\s+)/gm, "");
    previousEnd = end;
    return { citation: Number(m[1]), claim, offset, end };
  });
}
export function numericCitationsSupported(
  text: string,
  sources: { citation: number; text?: string }[],
) {
  return claims(text).every(({ citation, claim }) => {
    const facts = numbers(claim);
    if (!facts.length) return true;
    const source = sources.find((s) => s.citation === citation);
    return (
      !!source?.text && facts.every((n) => numbers(source.text!).includes(n))
    );
  });
}

// A small model can attach the wrong existing citation to a date or amount.
// Reassign only when one passage contains every number and shares multiple words.
// Ambiguous matches stay untouched; this is not a semantic entailment guarantee.
export function alignNumericCitations(text: string, sources: Source[]) {
  const aligned = claims(text).map(({ citation: id, claim, offset, end }) => {
    const cited = sources.find((s) => s.citation === id);
    const facts = numbers(claim);
    if (
      !cited ||
      !facts.length ||
      facts.every((n) => numbers(cited.text).includes(n))
    )
      return { offset, end, id };
    const words = terms(claim).filter((t) => /\p{L}/u.test(t));
    const candidates = sources.filter(
      (s) =>
        facts.every((n) => numbers(s.text).includes(n)) &&
        new Set(words.filter((t) => terms(s.text).includes(t))).size >= 2,
    );
    return {
      offset,
      end,
      id: candidates.length === 1 ? candidates[0].citation : id,
    };
  });
  let result = text;
  for (const change of aligned.reverse())
    result =
      result.slice(0, change.offset) +
      `[${change.id}]` +
      result.slice(change.end);
  return result;
}

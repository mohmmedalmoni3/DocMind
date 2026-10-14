export function normalizedEvidence(text: string) {
  return text.normalize("NFKC").toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/[^\p{L}\p{N}]/gu, "");
}
/** Highlight exact contiguous normalized matches, never unrelated keyword hits. */
export function evidenceItems(items: string[], passage: string): { indices: number[]; exact: boolean } {
  const normalized = items.map(normalizedEvidence), page = normalized.join(""), target = normalizedEvidence(passage);
  if (!target) return { indices: [], exact: false };
  const start = page.indexOf(target), ranges: [number, number][] = [];
  if (start >= 0) ranges.push([start, start + target.length]);
  else {
    const width = Math.min(32, target.length);
    if (width >= 18) for (let i = 0; i <= target.length-width; i += 16) {
      const anchor = target.slice(i, i+width), pos = page.indexOf(anchor);
      if (pos < 0 || page.indexOf(anchor, pos+1) >= 0) continue;
      let left = 0, right = width;
      while (i-left > 0 && pos-left > 0 && target[i-left-1] === page[pos-left-1]) left++;
      while (i+right < target.length && pos+right < page.length && target[i+right] === page[pos+right]) right++;
      ranges.push([pos-left,pos+right]);
    }
  }
  let offset = 0;
  const indices: number[] = [];
  normalized.forEach((text, i) => { if (text.length && ranges.some(([a,b]) => offset < b && offset+text.length > a)) indices.push(i); offset += text.length; });
  return {indices, exact: start >= 0};
}

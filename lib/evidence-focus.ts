import { terms } from "./retrieval";
/** Extract complete contiguous sentence/line windows; never paraphrase document evidence. */
export function focusEvidence(text: string, query: string): string {
  if (text.length <= 650) return text;
  // Conditions can be far from the matching fee/duration. Keep the whole original
  // passage rather than presenting a qualifier-free extract to the generator.
  if(/بشرط|يشترط|استثناء|باستثناء|يعفى|لا يشمل|لا تبدأ|بعد اكتمال|unless|except|provided that|subject to/iu.test(text))return text;
  const queryWords = [
    ...new Set(terms(query).map((w) => w.replace(/^ال/, ""))),
  ].filter((w) => w.length >= 3);
  const parts = text
    .split(/\n+|(?<=[.!?؟])\s+/)
    .flatMap((part) => {
      if (part.length <= 500) return [part];
      const words = part.split(/\s+/),
        windows: string[] = [];
      let current: string[] = [];
      for (const word of words) {
        current.push(word);
        if (current.join(" ").length >= 420) {
          windows.push(current.join(" "));
          current = current.slice(-12);
        }
      }
      if (current.length) windows.push(current.join(" "));
      return windows;
    })
    .filter((p) => p.trim());
  if (parts.length < 2) return text;
  const scores = parts
    .map((p, i) => {
      const tokens = terms(p).map((w) => w.replace(/^ال/, ""));
      return {
        i,
        score: queryWords.reduce(
          (n, w) => n + (tokens.some((t) => t === w) ? 1 : 0),
          0,
        ),
      };
    })
    .sort((a, b) => b.score - a.score || a.i - b.i);
  // Preserve full passages for paraphrases with weak lexical evidence.
  if (!scores[0] || scores[0].score < 2) return text;
  const chosen = scores
    .filter((s) => s.score > 0)
    .slice(0, 2)
    .map((s) => s.i)
    .sort((a, b) => a - b);
  const focused = chosen.map((i) => parts[i]).join("\n[…]\n");
  return focused.length < text.length * 0.85 ? focused : text;
}

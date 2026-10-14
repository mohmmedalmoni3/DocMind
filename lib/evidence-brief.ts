import type { Source } from "./types";
import { terms } from "./retrieval";
const generic = new Set(
  "create make give decision brief card requirements document documents findings information key numbers next step summary انشئ اعطني بطاقة قرار ملخص معلومات مستند مستندات".split(
    " ",
  ),
);
const stem = (word: string) => word.replace(/^ال/, "").replace(/s$/, "");
/** A decision brief contains literal evidence and explicit limits, never an invented business decision. */
export function evidenceBrief(
  question: string,
  sources: Source[],
): string | null {
  const ar = /[\u0600-\u06ff]/.test(question),
    words = [
      ...new Set(
        terms(question)
          .filter((w) => !generic.has(w))
          .map(stem),
      ),
    ];
  const quotes: { text: string; citation: number; score: number }[] = [],
    seen = new Set<string>();
  for (const source of sources) {
    if (source.similarity < 0.45 || ar !== /[\u0600-\u06ff]/.test(source.text))
      continue;
    const heading = terms(source.section).map(stem),
      headingScore = words.filter((w) => heading.includes(w)).length;
    for (const sentence of source.text.split(/(?<=[.!?؟])\s+|\n+/)) {
      const text = sentence.trim();
      if (
        text.length < 20 ||
        text.length > 450 ||
        /^#|fictional|\bdemo\b|\[\d+\]/i.test(text)
      )
        continue;
      const tokens = terms(text).map(stem),
        hits = words.filter((w) => tokens.includes(w)).length;
      if (!hits || hits + Math.min(headingScore, 1) < 2 || seen.has(text))
        continue;
      seen.add(text);
      quotes.push({
        text,
        citation: source.citation,
        score: hits + Math.min(headingScore, 1),
      });
    }
  }
  const selected = quotes.sort((a, b) => b.score - a.score).slice(0, 5);
  if (!selected.length) return null;
  const numeric = selected.filter((q) => /[\d٠-٩]/.test(q.text)),
    findings = selected.filter((q) => !/[\d٠-٩]/.test(q.text));
  const list = (rows: typeof selected) =>
    rows.map((q) => `- ${q.text} [${q.citation}]`).join("\n");
  return ar
    ? `### النتائج\n${findings.length ? list(findings) : "الأدلة المباشرة المتعلقة بالسؤال موضحة أدناه."}\n\n### الأرقام المهمة\n${numeric.length ? list(numeric) : "لم تظهر أرقام في المقاطع المختارة لهذه البطاقة."}\n\n### حدود المعلومات\nهذه بطاقة من المقاطع المسترجعة؛ لا تؤكد اكتمال جميع معايير اتخاذ القرار.\n\n### الخطوة التالية\n**اقتراح:** راجع المقاطع المشار إليها وتحقق من الافتراضات المتبقية قبل اتخاذ القرار.`
    : `### Findings\n${findings.length ? list(findings) : "Direct evidence for the requested topic is shown below."}\n\n### Key numbers\n${numeric.length ? list(numeric) : "No numbers appear in the passages selected for this brief."}\n\n### Information limits\nThis brief covers retrieved passages; it does not establish that all decision criteria are covered.\n\n### Next step\n**Suggestion:** inspect the cited passages and confirm remaining assumptions before deciding.`;
}

import type { Source } from "./types";
import { normalizedAnswer } from "./normalization";
import { terms } from "./retrieval";
type Rule = { id: string; question: RegExp; sentence: RegExp; value: RegExp };
const rules: Rule[] = [
  {
    id: "budget",
    question:
      /\b(total|overall)\b.*\bbudget\b|\bbudget\b.*\b(total|overall)\b|الميزانية (?:الاجمالية|الإجمالية)|(?:الاجمالية|الإجمالية).*ميزانية/i,
    sentence:
      /total budget|budget of|budget is|budget.*total|الميزانية الاجمالية|الميزانية الإجمالية/i,
    value: /\$\s*[\d,]+|[\d,]+\s*دولار/,
  },
  {
    id: "logs",
    question: /how long.*diagnostic logs|مدة.*سجلات التشخيص|كم.*سجلات التشخيص/i,
    sentence: /diagnostic logs|سجلات التشخيص/i,
    value: /\d+\s*(?:days?|يوما|يوماً|يومًا)/i,
  },
  {
    id: "backups",
    question: /how long.*(?:production )?backups/i,
    sentence: /backups.*retained/i,
    value: /\d+\s*days?/i,
  },
  {
    id: "onboarding",
    question: /how long.*onboarding session/i,
    sentence: /onboarding session/i,
    value: /\d+[- ]minute/i,
  },
  {
    id: "teams",
    question: /how many.*(?:teams|invited)/i,
    sentence: /(?:include|with|تشمل).*\d+.*(?:invited teams|فريق)/i,
    value: /\d+\s*(?:invited teams|فريق)/i,
  },
  {
    id: "launch-date",
    question: /^when.*(?:public beta|beta).*launch/i,
    sentence: /public beta launches on/i,
    value:
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i,
  },
  {
    id: "launch-owner",
    question:
      /^who.*(?:launch owner|owns.*launch)|^من المسؤولة عن اطلاق|^من المسؤولة عن إطلاق/i,
    sentence:
      /launch owner is|owns the product launch|المسؤولة عن الاطلاق هي|المسؤولة عن الإطلاق هي/i,
    value:
      /(?:owner is|owns the product launch|الاطلاق هي|الإطلاق هي)\s+[^.!؟\n]+/i,
  },
  {
    id: "budget-owner",
    question: /^who.*(?:owns|owner).*budget/i,
    sentence: /budget owner is/i,
    value: /budget owner is\s+[^.!?\n]+/i,
  },
];
/** A narrowly gated extractive answer. No paraphrase, arithmetic or inferred authority. */
export function directFact(
  question: string,
  sources: Source[],
  labels: Map<string, string>,
  scoped = false,
): { text: string; source: Source } | null {
  const q = normalizedAnswer(question),
    ar = /[\u0600-\u06ff]/.test(question);
  if (
    q.length > 300 ||
    /\b(compare|why|explain|calculate|difference|should|not|except|and|breakdown|allocated|before|after|previous|last|next|earlier)\b|قارن|لماذا|احسب|الفرق|توزيع|هل|ليس|باستثناء|السابق|القديم|التالي|قبل|بعد/i.test(
      q,
    )
  )
    return null;
  const rule = rules.find((r) => r.question.test(q));
  const course =
    !rule &&
    /(?:كم مدة|كم عدد ساعات|عدد ساعات التدريب)/.test(q) &&
    /دورة|تدريب/.test(q);
  if (!rule && !course) return null;
  const candidates: { text: string; source: Source; value: string }[] = [];
  const generic = new Set(
    "project program policy handbook training course finance operations overview budget total owner launch release دليل المشروع مشروع الدورة دورة التدريب البرنامج برنامج الميزانية الاجمالية نظرة عامة".split(
      " ",
    ),
  );
  const knownSubjects = [
    ...new Set(
      [...labels.values()].flatMap((label) => {
        const normalized = normalizedAnswer(label),
          project = normalized.match(/(?:\bproject|مشروع)\s+([\p{L}]+)/iu)?.[1],
          first = normalized.match(/[\p{L}]+/u)?.[0],
          subject = project || first;
        return subject && subject.length >= 4 && !generic.has(subject)
          ? [subject]
          : [];
      }),
    ),
  ];
  const queryWords = new Set(q.match(/[\p{L}\p{N}]+/gu) || []);
  const requestedSubjects = knownSubjects.filter((subject) =>
    queryWords.has(subject),
  );
  for (const source of sources) {
    if (source.similarity < 0.65 || ar !== /[\u0600-\u06ff]/.test(source.text))
      continue;
    const label = normalizedAnswer(labels.get(source.file) || source.file);
    const labelWords = new Set(label.match(/[\p{L}\p{N}]+/gu) || []);
    if (requestedSubjects.some((subject) => !labelWords.has(subject))) continue;
    const namedProject = q.match(/(?:\bproject|مشروع)\s+([\p{L}]+)/iu)?.[1];
    if (
      namedProject &&
      !generic.has(namedProject) &&
      !labelWords.has(namedProject)
    )
      continue;
    // Require a document subject explicitly present in the question unless the user chose its scope.
    if (!scoped) {
      const anchors = (
        label.match(/[a-z]{4,}|[\u0600-\u06ff]{4,}/g) || []
      ).filter((a) => !generic.has(a));
      const matches = [...new Set(anchors.filter((a) => q.includes(a)))];
      if (matches.length < 1) continue;
    }
    if (course) {
      const quantity = new Set(
        "كم وكم مدة عدد وعدد ساعات ساعة ايام يوم تدريب دورة يومية الوقت اجمالي في هذه و".split(
          " ",
        ),
      );
      const topics = terms(q)
        .map((w) => w.replace(/^ال/, ""))
        .filter((w) => !quantity.has(w));
      const titleWords = new Set(terms(label).map((w) => w.replace(/^ال/, "")));
      if (topics.some((topic) => !titleWords.has(topic))) continue;
    }
    const pieces = course
      ? [source.text.split(/طبيعة الدورة/)[0].trim()]
      : source.text.split(/(?<=[.!?؟])\s+|\n+/);
    for (const piece of pieces) {
      const p = normalizedAnswer(piece);
      const sourceProject = p.match(/(?:\bproject|مشروع)\s+([\p{L}]+)/iu)?.[1];
      if (sourceProject && !q.includes(sourceProject)) continue;
      const value = course
        ? p.match(/\d+\s*(?:ساعة|ساعات|ايام|أيام)/g)?.join("|")
        : p.match(rule!.value)?.[0];
      if (!value || (!course && !rule!.sentence.test(p))) continue;
      if (
        course &&
        (!/اجمالي ساعات التدريب/.test(p) ||
          !/\d+\s*ايام/.test(p) ||
          piece.length > 400)
      )
        continue;
      // Period qualifiers and negation must never silently disappear.
      if (
        /\b(not|except|less than|more than|at least|at most)\b|ليس|لن |لا |اقل|اكثر/.test(
          p,
        )
      )
        continue;
      const numbers = q.match(/\d+/g) || [],
        evidenceNumbers = new Set(p.match(/\d+/g) || []);
      if (numbers.some((n) => !evidenceNumbers.has(n))) continue;
      if (piece.length > 450 || piece.length < 5 || /\[\d+\]/.test(piece))
        continue;
      candidates.push({ text: piece.trim(), source, value });
    }
  }
  if (!candidates.length || new Set(candidates.map((c) => c.value)).size !== 1)
    return null;
  const best = candidates[0];
  return {
    source: best.source,
    text: `> ${best.text.replace(/^#+\s*/, "")} [${best.source.citation}]`,
  };
}

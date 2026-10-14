import { createHash } from "node:crypto";
import { normalizedAnswer } from "./normalization";
import type { Chunk, Index, Source } from "./types";
import { prepareVersionPassages } from "./version-diff";

export type EvidenceFact = {
  id: string;
  file: string;
  chunkId: string;
  page: number | null;
  section: string;
  quote: string;
  entity: string;
  field: string;
  value: string;
  period: string;
  scope: string;
  revision: boolean;
};
export type InvestigationSnapshot = {
  version: 1;
  builtAt: string;
  documents: {
    file: string;
    hash: string;
    facts: EvidenceFact[];
    passages: ReturnType<typeof prepareVersionPassages>;
  }[];
};
export type Finding = {
  id: string;
  entity: string;
  field: string;
  kind: "potential-conflict" | "revision-review" | "scope-review";
  explanation: string;
  facts: EvidenceFact[];
};
const rules = [
  {
    field: "الميزانية الإجمالية",
    match: /total budget|الميزانية الاجمالية/,
    value: /\$\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:دولار|usd|jod|دينار)/,
  },
  {
    field: "مدة التدريب",
    match: /training duration|مدة التدريب|مدة الدورة/,
    value: /\d+\s*(?:days?|ايام|يوما|يوم|hours?|ساعة|ساعات)/,
  },
  {
    field: "ساعات التدريب",
    match: /total training hours|اجمالي ساعات التدريب/,
    value: /\d+\s*(?:hours?|ساعة|ساعات)/,
  },
  {
    field: "مسؤول إطلاق المنتج",
    match: /launch owner is|المسؤولة عن الاطلاق هي|المسؤول عن الاطلاق هو/,
    value:
      /(?:launch owner is|المسؤولة عن الاطلاق هي|المسؤول عن الاطلاق هو)\s+([^.!؟\n]+)/,
  },
  {
    field: "مسؤول الإصدار الهندسي",
    match: /release owner is|مسؤول الاصدار هو/,
    value: /(?:release owner is|مسؤول الاصدار هو)\s+([^.!؟\n]+)/,
  },
  {
    field: "الاحتفاظ بسجلات التشخيص",
    match: /diagnostic logs|سجلات التشخيص/,
    value: /\d+\s*(?:days?|ايام|يوما|يوم)/,
  },
  {
    field: "موعد إطلاق النسخة التجريبية",
    match: /public beta launches on/,
    value:
      /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d+\s*\d{4}/,
  },
] as const;
const hash = (text: string) =>
  createHash("sha256").update(text).digest("hex").slice(0, 20);
const normalized = (text: string) =>
  normalizedAnswer(text).replace(/\s+/g, " ").trim();

function identity(chunks: Chunk[], file: string) {
  const text = chunks.map((c) => c.text).join("\n");
  // Explicit names connect finance/operations copies without conflating unrelated courses.
  const project = text.match(
    /\bProject\s+([A-Z][\p{L}\d_-]+)|مشروع\s+([\p{L}\d_-]+)/u,
  );
  if (project) return normalized(project[1] || project[2]);
  const heading = text.match(/^#\s+([^\n]+)/m)?.[1];
  return normalized(
    (heading || file.replace(/\.[^.]+$/, ""))
      .split(/[·|]/)[0]
      .replace(/(?:[-_ ](?:v\d+|version\s*\d+|نسخة\s*\d+|\d+))$/i, ""),
  );
}
function markers(text: string) {
  const p = normalized(text);
  const months =
    "january|february|march|april|may|june|july|august|september|october|november|december|يناير|فبراير|مارس|ابريل|مايو|يونيو|يوليو|اغسطس|سبتمبر|اكتوبر|نوفمبر|ديسمبر";
  const dates =
    p.match(
      new RegExp(
        `(?:${months})\\s+\\d{4}|\\b\\d{4}[-/]\\d{1,2}(?:[-/]\\d{1,2})?\\b`,
        "g",
      ),
    ) || [];
  const scopes =
    p.match(
      /\b(?:beta|production|pilot|annual|quarterly)\b|تجريبي|سنوي|ربع سنوي/g,
    ) || [];
  return {
    period: [...new Set(dates)].sort().join(" · "),
    scope: [...new Set(scopes)].sort().join(" · "),
    revision:
      /\b(supersedes|superseded|replaces|draft|expired|deprecated|unapproved)\b|مسودة|يلغي|تلغي|منتهي الصلاحية/.test(
        p,
      ),
  };
}
function extractFacts(chunks: Chunk[], file: string): EvidenceFact[] {
  const entity = identity(chunks, file);
  const namedProjects = (text: string) => [
    ...new Set(
      [
        ...text.matchAll(
          /\bProject\s+([A-Z][\p{L}\d_-]+)|مشروع\s+([\p{L}\d_-]+)/gu,
        ),
      ].map((match) => normalized(match[1] || match[2])),
    ),
  ];
  const projects = namedProjects(chunks.map((c) => c.text).join("\n"));
  const whole = markers(chunks.map((c) => c.text).join("\n"));
  const seen = new Set<string>();
  const facts: EvidenceFact[] = [];
  for (const chunk of chunks) {
    for (const quote of chunk.text.split(/\n+|(?<=[.!؟])\s+(?=\p{L})/u)) {
      const text = normalized(quote);
      const quoteProjects = namedProjects(quote);
      if (
        quoteProjects.length > 1 ||
        (projects.length > 1 && !quoteProjects.length)
      )
        continue;
      if (
        quote.length > 1000 ||
        /\b(?:not|except|at least|at most|over|under)\b|لا |ليس|اكثر|اقل/.test(
          text,
        )
      )
        continue;
      for (const rule of rules) {
        if (!rule.match.test(text)) continue;
        const match = text.match(rule.value);
        if (!match) continue;
        const value = (match[1] || match[0])
          .trim()
          .replace(/\b(?:days?|ايام|يوما|يوم)\b/g, "day")
          .replace(/\b(?:hours?)\b/g, "hour")
          .replace(/(?:ساعة|ساعات)$/g, "hour");
        const key = `${rule.field}:${value}:${text}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const local = markers(quote);
        facts.push({
          id: hash(`${file}:${key}`),
          file,
          chunkId: chunk.id,
          page: chunk.page,
          section: chunk.section,
          quote: quote.trim(),
          entity: quoteProjects[0] || entity,
          field: rule.field,
          value,
          period: local.period || whole.period,
          scope: local.scope || whole.scope,
          revision: whole.revision,
        });
      }
    }
  }
  return facts;
}
export function buildInvestigation(
  index: Index,
  previous?: InvestigationSnapshot,
): InvestigationSnapshot {
  return {
    version: 1,
    builtAt: new Date().toISOString(),
    documents: index.documents.map((document) => {
      const old =
        previous?.version === 1
          ? previous.documents.find(
              (d) => d.file === document.name && d.hash === document.hash,
            )
          : undefined;
      const chunks = index.chunks.filter((c) => c.file === document.name);
      const ids = new Set(chunks.map((c) => c.id));
      return {
        file: document.name,
        hash: document.hash,
        facts:
          old && old.facts.every((f) => ids.has(f.chunkId))
            ? old.facts
            : extractFacts(chunks, document.name),
        passages:
          old?.passages &&
          old.passages.rows.every((row) => ids.has(row.chunkId))
            ? old.passages
            : prepareVersionPassages(chunks),
      };
    }),
  };
}
export function investigationFindings(
  snapshot: InvestigationSnapshot,
  files: string[],
): Finding[] {
  const groups = new Map<string, EvidenceFact[]>();
  for (const fact of snapshot.documents
    .filter((d) => files.includes(d.file))
    .flatMap((d) => d.facts)) {
    const key = `${fact.entity}:${fact.field}`;
    groups.set(key, [...(groups.get(key) || []), fact]);
  }
  const results: Finding[] = [];
  for (const [key, facts] of groups) {
    if (
      new Set(facts.map((f) => f.file)).size < 2 ||
      new Set(facts.map((f) => f.value)).size < 2
    )
      continue;
    const samePeriod = facts.every(
      (f) => !!f.period && f.period === facts[0].period,
    );
    const sameScope = facts.every((f) => f.scope === facts[0].scope);
    const unit = (value: string) =>
      value
        .replace(/[\d\s.]+/g, "")
        .replace(/days?|ايام|يوما|يوم/g, "day")
        .replace(/hours?|ساعة|ساعات/g, "hour");
    const sameUnits = facts.every(
      (f) => unit(f.value) === unit(facts[0].value),
    );
    const owners = /مسؤول/.test(facts[0].field);
    const kind = facts.some((f) => f.revision)
      ? "revision-review"
      : samePeriod && sameScope && (sameUnits || owners)
        ? "potential-conflict"
        : "scope-review";
    results.push({
      id: hash(key),
      entity: facts[0].entity,
      field: facts[0].field,
      kind,
      facts,
      explanation:
        kind === "potential-conflict"
          ? facts[0].scope
            ? "قيم مختلفة للموضوع والحقل نفسه مع تطابق مؤشرات الفترة والنطاق. تعارض محتمل يحتاج مراجعة؛ لا نختار قيمة معتمدة بلا دليل."
            : "قيم مختلفة للموضوع والحقل نفسه مع تطابق مؤشر الفترة. نطاق التطبيق غير محدد صراحة؛ تحقق منه قبل اعتبار الاختلاف تعارضًا. لا نختار قيمة معتمدة بلا دليل."
          : kind === "revision-review"
            ? "توجد إشارة لمسودة أو استبدال أو انتهاء صلاحية. قد يكون الاختلاف بين إصدارات؛ راجع تاريخ الاعتماد والمرجع المسؤول."
            : "تختلف القيم، لكن الفترة أو نطاق التطبيق غير متطابق أو غير محدد. الاختلاف وحده لا يثبت وجود تعارض.",
    });
  }
  return results;
}
export function evidenceSource(
  index: Index,
  chunkId: string,
  citation = 1,
): Source {
  const chunk = index.chunks.find((c) => c.id === chunkId);
  if (!chunk) throw new Error("Evidence changed. Refresh the report.");
  const { embedding, ...source } = chunk;
  return { ...source, citation, similarity: 0, keyword: 0, score: 0 };
}

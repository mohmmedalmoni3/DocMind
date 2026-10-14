import type { Source } from "./types";
import { normalizedAnswer } from "./normalization";
type Field = {
  name: string;
  ar: string;
  question: RegExp;
  match: RegExp;
  value: RegExp;
};
const fields: Field[] = [
  {
    name: "Total budget",
    ar: "الميزانية الإجمالية",
    question: /budget|ميزانية/,
    match: /total budget|الميزانية الاجمالية/,
    value: /\$\s*[\d,]+|[\d,]+\s*دولار/,
  },
  {
    name: "Training duration",
    ar: "مدة التدريب",
    question: /duration|مدة/,
    match: /training duration is|مدة التدريب|مدة الدورة/,
    value: /\d+\s*(?:days?|ايام|ساعات|hours?)/,
  },
  {
    name: "Training hours",
    ar: "ساعات التدريب",
    question: /hours|ساعات/,
    match: /total training hours|اجمالي ساعات التدريب/,
    value: /\d+\s*(?:hours?|ساعة|ساعات)/,
  },
  {
    name: "Product launch owner",
    ar: "مسؤول إطلاق المنتج",
    question: /launch.*owner|owner.*launch|المسؤول.*اطلاق|المسؤولة.*اطلاق/,
    match: /launch owner is|المسؤولة عن الاطلاق هي/,
    value: /(?:launch owner is|المسؤولة عن الاطلاق هي)\s+([^.!?؟\n]+)/,
  },
  {
    name: "Engineering release owner",
    ar: "مسؤول الإصدار الهندسي",
    question: /release.*owner|owner.*release|مسؤول.*اصدار/,
    match: /release owner is/,
    value: /release owner is\s+([^.!?\n]+)/,
  },
];
export function directComparison(
  question: string,
  sources: Source[],
  files: [string, string],
  labels: Map<string, string>,
): string | null {
  const q = normalizedAnswer(question),
    ar = /[\u0600-\u06ff]/.test(question);
  const requested = fields.filter((f) => f.question.test(q));
  if (!requested.length) return null;
  // Revision/authority relationships need interpretation rather than a literal value comparison.
  if (
    sources.some((s) =>
      /\b(supersedes|superseded|replaces|revision|draft|expired|deprecated|unapproved|precedence)\b|مسودة|يلغي|تلغي|اعتماد نهائي|الاولوية/.test(
        normalizedAnswer(s.text),
      ),
    )
  )
    return null;
  const generic = new Set(
    "project program policy handbook training course finance operations overview budget total engineering product brief active دليل المشروع مشروع برنامج سياسة الدورة دورة التدريب البرنامج الميزانية الاجمالية نظرة عامة".split(
      " ",
    ),
  );
  const subjects = files.map(
    (file) =>
      new Set(
        (
          normalizedAnswer(labels.get(file) || file).match(
            /[a-z]{4,}|[\u0600-\u06ff]{4,}/g,
          ) || []
        ).filter((w) => !generic.has(w)),
      ),
  );
  const common = [...subjects[0]].filter(
    (w) => subjects[1].has(w) && q.includes(w),
  );
  if (!common.length) return null;
  const rows = requested.map((field) => {
    const cells = files.map((file, fileIndex) => {
      const found = sources
        .filter((s) => s.file === file)
        .flatMap((source) =>
          source.text
            .split(/(?<=[.!?؟])\s+|\n+/)
            .map((piece) => {
              const normalized = normalizedAnswer(piece),
                value = normalized.match(field.value),
                period = [
                  ...new Set(
                    normalizedAnswer(source.text).match(
                      /(?:january|february|march|april|may|june|july|august|september|october|november|december|يناير|فبراير|مارس|ابريل|مايو|يونيو|يوليو|اغسطس|سبتمبر|اكتوبر|نوفمبر|ديسمبر)\s+(?:\d{1,2}\s+)?\d{4}|\b20\d{2}-\d{2}(?:-\d{2})?\b|\b20\d{2}\b/g,
                    ) || [],
                  ),
                ];
              if (
                !field.match.test(normalized) ||
                !value ||
                /\bnot\b|ليس|لن |لا /.test(normalized) ||
                piece.length > 400 ||
                /\[\d+\]/.test(piece)
              )
                return null;
              if (ar !== /[\u0600-\u06ff]/.test(piece)) return null;
              const scopes = [
                /\bbeta\b|تجريب/,
                /\btraining\b|تدريب/,
                /\bmarketing\b|تسويق/,
                /\bengineering\b|هندس/,
              ]
                .map((pattern, i) =>
                  pattern.test(
                    normalized + " " + normalizedAnswer(source.section),
                  )
                    ? String(i)
                    : null,
                )
                .filter((s): s is string => s !== null);
              const namedProject = normalized.match(
                /(?:\bproject|مشروع)\s+([\p{L}]+)/iu,
              )?.[1];
              if (namedProject && !common.includes(namedProject)) return null;
              const requestedYears = q.match(/\b20\d{2}\b/g) || [];
              if (
                requestedYears.some((y) => !period.some((p) => p.includes(y)))
              )
                return null;
              return {
                piece: piece.trim().replace(/^#+\s*/, ""),
                value: value[1] || value[0],
                citation: source.citation,
                period,
                scopes,
              };
            })
            .filter((r): r is NonNullable<typeof r> => !!r),
        );
      const values = new Set(found.map((f) => f.value));
      if (values.size > 1) return null;
      return found[0] || undefined;
    });
    return { field, cells };
  });
  if (
    rows.some((r) => r.cells.some((c) => c === null)) ||
    rows.every((r) => r.cells.every((c) => !c))
  )
    return null;
  const missing = ar
    ? "لم يظهر في المقاطع المسترجعة"
    : "Not found in retrieved passages";
  const escape = (text: string) =>
    text.replace(/\|/g, "\\|").replace(/\n/g, " ");
  let result = `| ${ar ? "المعلومة" : "Requested fact"} | ${escape(files[0])} | ${escape(files[1])} |\n|---|---|---|\n`;
  for (const row of rows)
    result += `| ${ar ? row.field.ar : row.field.name} | ${row.cells.map((c) => (c ? `${escape(c.piece)} [${c.citation}]` : missing)).join(" | ")} |\n`;
  const different = rows.filter(
    (r) => r.cells[0] && r.cells[1] && r.cells[0].value !== r.cells[1].value,
  );
  const samePeriod =
    different.length &&
    different.every(
      (row) =>
        row.cells[0]!.period.length === 1 &&
        row.cells[1]!.period.length === 1 &&
        row.cells[0]!.period[0] === row.cells[1]!.period[0] &&
        row.cells[0]!.scopes.join("|") === row.cells[1]!.scopes.join("|"),
    );
  if (different.length) {
    const refs = [
      ...new Set(
        different.flatMap((r) => r.cells.map((c) => `[${c!.citation}]`)),
      ),
    ].join(" ");
    result += ar
      ? `\n**${samePeriod ? "تعارض محتمل في الفترة نفسها" : "اختلاف يحتاج مراجعة الفترة والنطاق"}:** ${different.map((r) => r.field.ar).join("، ")}. المقاطع المسترجعة لا تحدد أي القيمتين معتمدة؛ راجع أصحاب المستندات. ${refs}`
      : `\n**${samePeriod ? "Potential conflict for the same period" : "Difference requiring period/scope review"}:** ${different.map((r) => r.field.name).join(", ")}. The retrieved passages do not establish which value wins; verify with the document owners. ${refs}`;
  } else
    result += ar
      ? "\nالمقاطع المسترجعة لا تُظهر قيمتين مختلفتين للحقل نفسه. نقص المعلومة أو اختلاف الأدوار لا يثبت تعارضًا."
      : "\nThe retrieved passages do not show different values for the same field. Missing evidence or different roles do not establish a conflict.";
  return result;
}
export function comparisonCitationsStayScoped(
  text: string,
  sources: Source[],
  files: [string, string],
) {
  const table = text
    .split("\n")
    .filter((line) => line.trim().startsWith("|") && /\[\d+\]/.test(line));
  return table.every((line) => {
    const cells = line.split(/(?<!\\)\|/).slice(1, -1);
    if (cells.length < 3) return false;
    return files.every((file, i) =>
      [...cells[i + 1].matchAll(/\[(\d+)\]/g)].every((m) =>
        sources.some((s) => s.citation === Number(m[1]) && s.file === file),
      ),
    );
  });
}

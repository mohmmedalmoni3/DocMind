import type { ChatTurn } from "./types";
import { normalizedAnswer as normalizeFact } from "./normalization";
import { numericCitationsSupported } from "./citations";
export type EvaluationCase = {
  question: string;
  expected: string;
  terms: string[];
  file: string | null;
  category?: string;
  scope?: string;
  history?: ChatTurn[];
  compareFiles?: [string, string];
  files?: string[];
};
export const evaluationCases: EvaluationCase[] = [
  {
    question: "When does the Atlas public beta launch?",
    expected: "November 18, 2026",
    terms: ["november", "18", "2026"],
    file: "01-Project-Atlas.md",
  },
  {
    question: "What is the total beta budget?",
    expected: "$48,000",
    terms: ["48,000"],
    file: "03-Beta-Playbook.md",
  },
  {
    question: "How long are diagnostic logs retained?",
    expected: "14 days",
    terms: ["14", "days"],
    file: "02-Engineering-Handbook.md",
  },
  {
    question: "من المسؤولة عن إطلاق مشروع أطلس؟",
    expected: "مايا تشين",
    terms: ["مايا", "تشين"],
    file: "04-دليل-المشروع.md",
  },
  {
    question: "What was the Atlas revenue in 2023?",
    expected: "I couldn't find this in the documents",
    terms: ["couldn't find"],
    file: null,
  },
  {
    question: "How many teams are invited to the Atlas beta?",
    expected: "150 teams",
    terms: ["150"],
    file: "01-Project-Atlas.md",
    category: "Fact",
  },
  {
    question: "Who owns the Atlas beta budget?",
    expected: "Priya Shah",
    terms: ["priya", "shah"],
    file: "03-Beta-Playbook.md",
    category: "Scoped fact",
    scope: "03-Beta-Playbook.md",
  },
  {
    question: "How long are production backups retained?",
    expected: "30 days",
    terms: ["30", "days"],
    file: "02-Engineering-Handbook.md",
    category: "Scoped fact",
    scope: "02-Engineering-Handbook.md",
  },
  {
    question: "How long is an Atlas onboarding session?",
    expected: "30 minutes",
    terms: ["30", "minute"],
    file: "03-Beta-Playbook.md",
    category: "Fact",
  },
  {
    question: "What expense threshold needs Maya Chen approval?",
    expected: "Over $2,000",
    terms: ["2000"],
    file: "03-Beta-Playbook.md",
    category: "Fact",
    scope: "03-Beta-Playbook.md",
  },
  {
    question: "ما الميزانية الإجمالية للبرنامج التجريبي؟",
    expected: "48,000 دولار",
    terms: ["48000"],
    file: "04-دليل-المشروع.md",
    category: "Arabic",
    scope: "04-دليل-المشروع.md",
  },
  {
    question: "كم مدة الاحتفاظ بسجلات التشخيص؟",
    expected: "14 يوماً",
    terms: ["14"],
    file: "04-دليل-المشروع.md",
    category: "Arabic",
    scope: "04-دليل-المشروع.md",
  },
  {
    question: "How many teams are invited?",
    expected: "150 teams in Atlas",
    terms: ["150"],
    file: "01-Project-Atlas.md",
    category: "Follow-up",
    history: [
      { role: "user", content: "When does the Atlas public beta launch?" },
      { role: "assistant", content: "November 18, 2026." },
    ],
  },
  {
    question: "Who owns it?",
    expected: "Priya Shah owns the beta budget",
    terms: ["priya", "shah", "budget"],
    file: "03-Beta-Playbook.md",
    category: "Follow-up",
    scope: "03-Beta-Playbook.md",
    history: [
      { role: "user", content: "What is the Atlas beta budget?" },
      { role: "assistant", content: "The beta budget is $48,000." },
    ],
  },
  {
    question: "ما سعر الاشتراك الشهري في مشروع أطلس؟",
    expected: "لم أجد هذه المعلومات في المستندات",
    terms: ["لم أجد"],
    file: null,
    category: "Arabic abstention",
    scope: "04-دليل-المشروع.md",
  },
  {
    question:
      "Compare the Atlas product launch owner and engineering release owner. Are different roles necessarily a contradiction?",
    expected: "Maya Chen / Omar Haddad, different roles",
    terms: ["maya", "chen", "omar", "haddad"],
    file: "01-Project-Atlas.md",
    files: ["01-Project-Atlas.md", "02-Engineering-Handbook.md"],
    category: "Comparison",
    compareFiles: ["01-Project-Atlas.md", "02-Engineering-Handbook.md"],
  },
];
export function normalizedAnswer(text: string) {
  return normalizeFact(text);
}
export function checkEvaluation(
  test: EvaluationCase,
  result: {
    text: string;
    sources: { file: string; citation: number; text?: string }[];
  },
) {
  const correct = test.terms.every((t) =>
    normalizedAnswer(result.text).includes(normalizedAnswer(t)),
  );
  const files = test.files || (test.file ? [test.file] : []);
  const citation =
    (files.length
      ? files.every((file) =>
          result.sources.some(
            (s) => s.file === file && result.text.includes(`[${s.citation}]`),
          ),
        )
      : !/\[\d+\]/.test(result.text)) &&
    numericCitationsSupported(result.text, result.sources);
  return { correct, citation, pass: correct && citation };
}

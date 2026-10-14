import type { ChatTurn } from "./types";
import { terms } from "./retrieval";

// Conservative: ambiguous short questions still resolve against conversation history.
export function shouldRewrite(
  question: string,
  history: ChatTurn[],
  titles: string[] = [],
  scoped = false,
) {
  if (!history.length) return false;
  if (
    /\b(it|its|they|their|them|that|those|this|previous|same|above|also|more|instead)\b|(?:تكلفتها|مدتها|سعرها|عددها|ذلك|تلك|السابق|نفس|أيضاً|ايضا|وماذا|ماذا عنه|بالمقارنة)/i.test(
      question,
    )
  )
    return true;
  if (scoped) return false;
  const tokens = new Set(terms(question));
  return !titles.some((title) => {
    const words = terms(title.replace(/\.[^.]+$/, "").replace(/^\d+[-_]/, ""));
    const matches = words.filter((w) => tokens.has(w));
    return matches.length >= 2 || matches.some((w) => /^[a-z]{4,}$/i.test(w));
  });
}

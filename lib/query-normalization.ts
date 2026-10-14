/** Bounded query-only dialect normalization. Never rewrite source passages or add facts. */
export function normalizeQuestion(question: string): string {
  const replacements: Record<string, string> = {
    شقد: 'كم', شكد: 'كم', قديش: 'كم', اديش: 'كم', أديش: 'كم',
    كام: 'كم', بكم: 'بكم', بكام: 'بكم', بقديش: 'بكم',
    شو: 'ما', شنو: 'ما', وش: 'ما', ايش: 'ما', إيش: 'ما',
    شلون: 'كيف', ازاي: 'كيف', إزاي: 'كيف', وين: 'أين', فين: 'أين',
    امتى: 'متى', إمتى: 'متى', ايمتى: 'متى', ليش: 'لماذا', ليه: 'لماذا',
  };
  // Word boundaries must be Unicode-aware: JS \b does not delimit Arabic words.
  let result=question.normalize('NFKC').replace(/[\p{L}\p{M}]+/gu,word=>{
    const bare=word.replace(/[\u064b-\u065f\u0670\u0640]/g,'');
    return replacements[bare] ?? (bare.startsWith('و') && replacements[bare.slice(1)] ? 'و'+replacements[bare.slice(1)] : word);
  });
  result=result.replace(/(^|\s)(و?كم)\s+(الساعات|ساعات)(?=\s|[؟?!،,.]|$)/gu,'$1$2 عدد $3');
  return result.trim();
}

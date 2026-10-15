# Required by the official brief

## Scope and environment
- Event: 42 Irbid, AI Future 26, Youth Edition.
- Four hours, teams of 3–4.
- Same approximately 7B generation model supplied through Ollama for everyone; exact model name is not stated in the brief.
- Evaluation on the team's laptop with internet off.
- Knowledge only from organizer documents; all answers generated at runtime by the supplied model.
- Coding assistants during development and local helper embedding/reranking models are allowed.
- No other generation models, online AI services or pre-written answers.

## Expected corpus: filename stems (inspect actual extensions)
| Family | First issue | Renewal | Lost | Damaged |
|---|---|---|---|---|
| Passport | passport_first_issue | passport_renewal | passport_lost | passport_damaged |
| Family book | family_book_first_issue | family_book_renewal | family_book_lost | family_book_damaged |
| Smart ID | id_card_first_issue | id_card_renewal | id_card_lost | id_card_damaged |

Nine fields per service: الفئة المستفيدة، أماكن تقديم الخدمة، الشروط، الوثائق المطلوبة، الإجراءات، الزمن المستغرق، شركاء الخدمة، ملاحظات، الرسوم.
Raw text may contain menus, duplicates, typos, tabs, blank lines and multiple numbering systems. Cleaning may not alter facts.

## Input/output
Run: python main.py questions.json
Output: answers.json in the project folder beside main.py, UTF-8 valid JSON.
Keep chats/chat_id/messages/message_id/question and all incoming information unchanged. Add answer and contexts per message. Extra keys allowed but unnecessary. No sorting, reordering or merging chats.
contexts is a list of actual used source passages, cleaned or raw, not summaries and not complete files. [] if nothing found.
Every message gets an answer even on technical failure. Technical literal error is permitted in the brief's failure example, but is not a successful answer.
Official practice questions.json contains five chats, one with two messages; answers_example.json is for comparison, not a production lookup table.

## Question classes
Simple facts; fees conditional on personal circumstances; documents and conditions; rules hidden in notes; comparisons; dialect; long stories and multiple questions; incorrect assumptions; unclear questions; questions outside supplied services.
Conversation follow-ups are bonus and never lower the main score. Clear state between chats.

## Evaluation
Most important: correct answer for the user's actual situation, without incorrect additions. Correct source service(s). Grounded answer supported by returned contexts, even when an unsupported claim happens to be true.
A full pasted document is not an answer. Provide a short walkthrough of preprocessing, retrieval and preventing hallucinations.

## Not specified by the brief
No mandatory website, hosting, UI framework, embedding model, vector database, exact context size, per-answer time limit, score weights or final answer length. Choose practical settings and measure them; never present suggested architecture as organizer rules.

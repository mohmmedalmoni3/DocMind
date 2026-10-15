# Acceptance checklist

Mark PASS/FAIL/BLOCKED with evidence. Not all checks can run before official inputs arrive.

## Contract
- Input metadata and all IDs/questions/order preserved exactly.
- All valid messages receive string answer and list-of-strings contexts.
- UTF-8 Arabic roundtrip; no corrupted encoding.
- Empty chats/messages, large batches and invocation from a different working directory.
- Output beside main.py; atomic save; no collision with input.
- Per-message timeout, invalid model JSON, invalid evidence ID and failed generation do not lose other results.
- A technical error is explicit and never reported as a grounded answer.

## Data and grounding
- All 12 original files identified and retained unchanged.
- Menus cleaned without losing facts, negations, list continuations or conditional notes.
- Each returned passage traceable to raw or conservative cleaned source.
- Amounts, time periods, exceptions and applicability verified against real sources.
- Complete required-document lists; no dropped exceptions due to top-k cutoff.
- No full-document dumps, unrelated passages or generated summaries in contexts.
- No hardcoded factual answers, answer cache or factual knowledge imported from the brief.

## Behavior matrix
- Each of 12 services: fee, documents, eligibility, place, time where present.
- Each actual fee branch: boundary ages, expiry/remain conditions, location and loss count where present.
- Notes-only exception; wrong premise; dialect variants; ambiguous document/situation.
- Comparison across two services, long story, multiple people and multiple requested facts.
- Out-of-scope related services and unrelated services decline without inventing.
- Follow-up uses current chat; topic correction updates state; next chat starts fresh.
- Prompt-injection text in query/document does not override evidence-only answering.

## Runtime
- Correct organizer model tag verified, no silent substitution.
- Live generation demonstrated; mocks explicitly separated.
- Context/output truncation handling exercised; dependencies fully local.
- Timed official practice run and comparison; exact structure preserved, semantic wording may differ.
- Offline run succeeds with local Ollama reachable; no runtime network/download dependencies.
- Windows setup and documented alternative venv command checked where available.
- Short judges walkthrough explains limitations honestly.

## Evaluation status rules
Synthetic tests passing means mechanics verified only. Official practice passing does not guarantee hidden accuracy. If real data, exact approved model, or live offline test is absent, state BLOCKED for those checks and list what is needed. Never claim 100% completion or guaranteed ranking based on scaffolding.

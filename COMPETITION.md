# Government-services challenge

## What changed

The product now prioritizes service identity, intact conditions and auditable evidence. No additional visual features are required for the challenge.

- An explicit label within the first 12 lines of the first extracted chunk `# خدمة اسم الخدمة` or `اسم الخدمة: اسم الخدمة` identifies a service. `إجراءات اسم الخدمة` can join a second document to the same service. Exact normalized service names route within the user's attachments; a passing mention in a different document does not create a route. Original PDF/DOCX text remains unchanged. If extraction does not expose such a title, routing conservatively falls back to hybrid retrieval; review extracted headings before the demo.
- Generic Arabic questions such as «كم الرسوم؟» with multiple recognized services request clarification instead of choosing the highest similarity result. A selected single service is not ambiguous. Simple field follow-ups preserve the original question and borrow only one explicit service name from the previous user turn; other follow-ups use rewriting before routing. Two to four explicitly named services receive balanced retrieval. This is conservative exact-name routing, not a semantic service classifier; paraphrases and unrecognized names still use retrieval.
- Conditional passages containing exemption/exclusion language are kept intact instead of sentence-focused cropping. Full-service context is available as an experiment, but the default remains ranked chunks unless measurement justifies expansion.
- `SERVICE_CONTEXT=whole` appends original passages from an explicitly identified service or selected file, retaining individual page/section citations. It has a 3000 estimated-token and 16-passage budget; over-budget context falls back to chunks without clipping source text. It is not a guarantee that every claim is entailed.
- `OLLAMA_STRICT_MODEL=true` prevents silent model fallback in both answer generation and readiness reporting. The committee's exact model name has not been provided yet. Qwen2.5:7b is only the current rehearsal model.

## Competition run (PowerShell)

Stop any existing server on port 3002 first. From the project directory:

```powershell
$env:COMPETITION_MODEL = 'EXACT_MODEL_NAME_FROM_COMMITTEE'
npm run competition
```

Open `http://127.0.0.1:3002`. Upload the committee documents in the interface. They go to `competition-docs` with an isolated `data/competition` index, leaving the original library and previous practice packs intact. BGE-M3 is the default embedding model for this profile. Models must already be installed locally.

Alternatively copy files into `competition-docs`, run `npm run competition:ingest`, then start the server. Run `npm run build` after source changes, with all servers sharing this checkout stopped. `COMPETITION_DOCS_DIR`, `COMPETITION_INDEX_DIR`, `COMPETITION_EMBEDDING_MODEL`, `COMPETITION_CONTEXT_SIZE`, and `COMPETITION_PORT` can override profile paths/settings.

Do not set the committee model to Qwen merely because it was used in our rehearsal. Use the exact model/tag they give you; compare its Arabic results before the demo.

## Fixed ten-service evaluation

`demo-packs/challenge-ten` contains 10 fictional service documents. `demo-packs/challenge-ten-cases.json` contains 17 fixed questions, frozen before the first run and SHA-256 recorded in reports. The set is authored locally and is **not a blind evaluation** or the official committee question set. Don't tune it to hide failures. Previous three-service fixtures remain a regression set.

```powershell
$env:COMPETITION_MODEL = 'qwen2.5:7b' # rehearsal only
npm run benchmark:challenge
$env:SERVICE_CONTEXT = 'whole'
$env:CHALLENGE_CASES = 'conditional-exemption,duration-start,follow-up'
npm run benchmark:challenge
```

Reports preserve full answers, source passages, service scope, expected facts, numerical support and clarification checks. Answer replay is disabled; Ollama prompt caching remains enabled. Single sequential measurements do not prove a general speedup. Condition, meaning and citation alignment still require manual inspection. The corpus is small, text-based and synthetic; scanned Arabic PDFs, unseen committee wording and actual files require separate validation.

## Three-minute demonstration

1. Show readiness and the exact mandated model name.
2. Ask «كم الرسوم؟» across all services: show clarification.
3. Specify one service: show the fee and its original passage.
4. Ask about an exemption and show its documentary condition.
5. Ask two similar services' fees: verify each amount has its own source.
6. Ask for a missing phone number: show abstention.

Prepare models before disconnecting the network. No physical network-disconnection claim is made by these automated runs.


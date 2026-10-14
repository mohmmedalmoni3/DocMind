# Verification notes

## Investigator, two-stage evidence, and versions — 2026-10-13

The investigator's explicit facts and normalized comparison units are saved at ingestion and reused by file hash. The nine existing documents were initially prepared with nine embedding-cache hits; source files and conversation history were preserved. Two fictional Vega version files were then uploaded through the browser; they are supplied as optional demo packs, while their working upload copies are excluded from the source ZIP. The library now has eleven documents.

All **38 automated tests pass**, with TypeScript checks and the production build successful. The new tests cover same-period explicit differences, unrelated entities, distinct roles, unknown/different periods, revisions, incompatible units, Arabic digits and exact quote provenance; they also cover reused preprocessing, additions/deletions/word highlights, cached-report mutation isolation and API scope/origin checks. API tests assert zero network/model calls for saved scans and version comparisons, and require re-indexing when analysis is absent. Streaming tests assert that source evidence with a measured time precedes the first answer token.

Actual browser observations: scoped Orion scan found two differences across four extracted facts in **10 ms**; first Vega v1 → v2 comparison took **34 ms**, with **five changed units, three additions, two removals**. The launch owner stayed unchanged and did not become a conflict. A detailed Atlas mission/risk question showed retrieved evidence at **0.2 s**, first generated text at **12.2 s**, and completed at **21.4 s**. The early evidence screenshot was captured while generation was pending. These are separate observations, not a benchmark or accuracy percentage. A first PowerShell HTTP scan took 230 ms including its client overhead.

The investigator is intentionally limited to explicit supported fields; scope/date markers are heuristics and unknown scope is disclosed. It neither picks authoritative values nor interprets arbitrary legal/semantic conflicts. Version comparison is of normalized, deduplicated indexed units (1,500 per file / 200 displayed changes), not an exhaustive document-layout or reorder diff. These limitations are visible in the UI and exported reports.

## Conversation attachments — 2026-10-13

Added an explicit per-conversation attachment set, uploaded-file acknowledgements with actual collision-safe filenames, persisted attachment chips, and union retrieval restricted to that set. Single-file focus and comparison are checked against attachments; missing filenames fail closed. Multi-attachment brief questions use the configured TOP_K instead of the reduced brief count, sharing one query embedding and ranking pass.

Thirty automated tests pass (29-test suite plus the dedicated upload test), with TypeScript and production build checks. New tests cover unrelated-topic routing, excluded-library source isolation, empty/missing scope rejection, duplicate-content filenames, cache isolation/order normalization, and multi-file uploads with same-name preservation in a disposable index. Browser checks used the existing course PDF and Project Atlas file together: the course question returned 20 hours / 10 days from page 3 in 0.9 seconds; the launch question returned November 18, 2026 from Atlas in 0.1 seconds. A budget question correctly abstained because the budget lives in a different, unattached playbook (19.9 seconds through generation). These are individual observations, not speed guarantees. Both attachments survived a page refresh. User sources and previous conversation were preserved. Short-screen layout keeps an answer area visible and makes long attachment rows horizontally scrollable.

## Hackathon upgrade — 2026-10-12

Twenty-six automated tests, TypeScript checks and the production build pass. The 16-case benchmark passed **16/16** on the current eight-document library (73 passages), including the two explicitly fictional Orion comparison files and the two local Arabic PDFs. Tests cover extractive fact gates, period/subject mismatches, conflicting retrieved values, exact/partial PDF matching, duplicate-file embedding reuse, index snapshot replacement and file-column citation scope. User PDFs and generated assets are excluded from the source archive; the optional Orion pack is included separately.

`performance-hackathon-final.json` records actual retrieval + answer timings with exact replays separately labelled. Its median is **259 ms**, observed P95 **7.63 seconds**, and literal standalone evidence cases **185–323 ms**. Replays took **91–150 ms**. Direct quoted answers bypass generation, not retrieval, and are labelled in the UI/report. Follow-up rewriting still adds time; inference/unknown-information questions still use the local model. This mixed-path benchmark is not a pure generation benchmark or a general accuracy estimate. The earlier generation-only run is retained in `performance-hackathon-generation.json`; hardware warm-up and CPU load differ between runs, so comparisons are not controlled.

The expanded benchmark caught unjustified refusals in known-answer cases. A shorter positive grounded prompt and deterministic generation corrected the tested cases. JSON query rewrites are validated; generation also receives the original question and previous user question to retain the exact subject. Comparison inspection additionally caught cross-file citations and confusion between launch/release roles that term-only scoring would have missed. Known fields now use a scoped literal table; generated tables have a file-column citation guard. These checks still do not prove arbitrary semantic entailment.

Speech production-API measurements in `performance-hackathon.json` show Arabic synthesis **731 / 368 ms** with loaded engines and transcription **3,924 / 3,699 ms**, returning the exact test question. The worker retains engines, serializes bounded jobs, stops an active job on cancellation, and unloads after five idle minutes. The original cold-process voice measurements are retained separately. Physical microphone capture remains dependent on browser permission and is unverified in the in-app browser.

The original Arabic course PDF was rendered locally on its cited page 3. Matching text runs, including the 20-hour / 10-day metrics, were highlighted; the UI correctly labelled the match as partial because the two extraction engines differ in reading order/ligatures. No unrelated keyword highlights are used. PDF assets load on demand from local files; initial chat bundle size stayed about 194 kB of first-load JavaScript. The source API only serves indexed PDFs within the document directory and rejects traversal.

The readiness button preloads Ollama generation/embeddings and installed speech engines. Its first observed run took 34.1 seconds (cold preparation), with each real step shown. Preparation is not counted as answer latency. Starter questions are now generated from document sections without competing background inference. The quality page displays an actual recorded run with timestamp/revision checks and offers fresh evaluation/report export.

Direct extraction covers a limited set of explicit fields; ambiguous or unsupported forms use generation. It checks the retrieved evidence, not every possible contradictory statement in the corpus. Potential conflict flags and date matches require source review; missing information does not establish agreement. No model replacement or GPU speed claim was made: these measurements used CPU Ollama (`size_vram: 0`) on an i7-1185G7 with about 15 GB reported RAM.

The final decision brief was measured at 137 ms through the real pipeline and 0.3 seconds in the production browser. It preserves the $48,000 total and the over-$2,000 approval condition as literal cited sentences, with suggestions and completeness limits separated. The initial generated decision test had refused after 70 seconds; the new evidence-brief path corrected that observed failure. Summaries remain an independent mode. Numeric citation repair now handles citations before sentences; the stricter quality report checks numeric literals against the actual cited passage and exports citation-to-file/page/section references. Derived number conversions can still need human review. Unverified numeric references are labelled for source verification and excluded from answer reuse.

The 390-pixel mobile check had no horizontal page overflow. Comparison tables now scroll within their own region with readable column widths. Recorded quality results and JSON export were verified in the browser. The original user conversation and document files were preserved; use a fresh conversation for the presentation so exploratory test timings do not affect its average.

## Local voice repair — 2026-10-12

Speech input now uses browser microphone recording and local multilingual Whisper transcription. Read-aloud uses local Piper Arabic (Jordanian) and English models with a visible audio player. Neither runtime uses a cloud speech service or requires browser/OS language packs. Models are installed on this machine; a fresh checkout requires the documented one-time `npm run setup:voice` download.

All **16 automated tests**, TypeScript checks and the production build pass. Real backend synthesis followed by transcription returned both test questions exactly in Arabic and English; measured results are in `voice-verification.json`. These are synthetic speech round-trips, not a physical microphone accuracy benchmark.

The production browser successfully imported the Arabic WAV through the UI and placed the exact question in the editable composer. The answer speaker button produced a playable Arabic WAV; the browser reported readyState 4, a 7.08-second duration and active playback. Physical speaker audibility was not independently measured. Health checks confirm Ollama, the generation/embedding models, transcription and both voices are ready.

The in-app browser left its microphone permission request pending without exposing a usable permission prompt. Recording on a physical microphone therefore remains unverified here. The UI now permits cancellation and recovers after 20 seconds with guidance to grant microphone permission, use Chrome/Edge or import a recording. Late permission responses are discarded and their tracks stopped. Imported audio and read-aloud were verified in this browser. The current local library contains six documents (69 passages); user PDFs remain local and are excluded from the source archive.

## Speed update — 2026-10-11

The final production build and browser check passed. The scoped Arabic PDF question completed in **4.7 seconds**, with first text at **0.7 seconds**, on the already-warm model. Starting a new conversation and repeating it displayed **Instant replay / 0.1 s** with the same page-3 citation. The 3B model's Arabic remains occasionally awkward in wording even when the cited facts are correct.

Final Arabic wording was tested separately in `performance-arabic.json`: Atlas owner 3.4 s, budget 4.6 s, and the actual course PDF duration/hours question 5.9 s, with 48–70 ms cached replays. The course answer correctly returned 10 days and 20 hours from page 3. This warm-model run followed earlier requests (including a 42.1-second first PDF browser request); Ollama prompt reuse and changing CPU load also affect the comparison. A mixed Arabic/Latin word seen in the earlier PDF answer was eliminated in the tested final wording. These are observed timings, not universal speed or language-quality guarantees.

These new measurements used the current five-document library (46 passages), including the added Arabic PDF, while the earlier verification below used the original four demo documents. The source archive includes only the fictional demo corpus; the added PDF remains in the local working library.

The final five-question regression passed **5/5**, with no answer replacements in that run. Exact repeated cited answers took **58–84 ms**, versus **8.6–29.4 seconds** for fresh answers/refusals. Reuse is explicitly labelled in the UI and requires unchanged documents, scope, recent conversation and model. It is not a fresh-generation benchmark. The quality lab bypasses answer reuse.

| Question | Before, total ms | After, total ms |
| --- | ---: | ---: |
| Beta launch | 28,579 | 16,567 |
| Budget | 10,152 | 11,025 |
| Log retention | 10,190 | 11,435 |
| Arabic launch owner | 27,760 | 29,417 |
| Missing revenue | 7,437 | 8,646 |

These are sequential single runs on CPU-only Ollama (`size_vram: 0`), with variable hardware load and model warm-up. They show a large gain on the launch answer from avoiding an extra citation-repair pass, not a uniform improvement on every fresh question. The main repeat-query gain comes from bounded local caching. Full first-token timings and answers are in `performance-before.json` and `performance.json`; reproduce with `npm run benchmark`.

Additional live checks cover a multi-fact question, Arabic budget, document scope, follow-up rewriting, and summary replay in `performance-quality.json`. Summary-specific wording was preserved after the new question-level citation hint made the small model confuse bullet numbers with source IDs. The final summary cites the launch date to the actual launch passage and took 53.1 seconds fresh / 66 ms replay. The automated checks measure expected facts and citation presence/scope, not full claim-by-claim entailment; broad paraphrases still need source inspection.

Fourteen automated tests pass, including a mocked end-to-end answer test that verifies cache replay, document-revision/scope/history invalidation, evaluation bypass, aborted requests, and rejection of token-limit-truncated streams. The existing citation checks remain enabled. A smaller fixed context was also tried and discarded because it did not improve this machine's measured latency. The default remains 8192; long evidence grows the context rather than being silently cut.

Verified locally with **qwen2.5:3b** and **nomic-embed-text**, using the four included fictional Atlas documents (23 indexed passages).

- Automated regression tests cover all four file formats, PDF page metadata, chunk boundaries, Arabic normalization, cosine/BM25/RRF ranking, hash-cache reuse, changed/deleted documents, source-ID validation, numeric citation alignment, local origin enforcement, and fragmented/truncated SSE streams.
- The live five-question benchmark passed **5/5** for English facts, Arabic facts, expected-document citations, and abstention. Answers and measured timings are saved in `verification.json`. This is a small fixture benchmark, not a general accuracy claim.
- Scoped comparison returned Maya Chen from the product brief and Omar Haddad from the engineering handbook. Source lists stayed within the requested file.
- Follow-up rewriting resolved “How many teams are invited?” to Atlas and returned 150 with a citation.
- Uploading a temporary TXT document triggered streamed re-indexing and appeared in the library. Unsupported extensions, empty questions, and cross-origin mutations were rejected. The temporary document was then removed and the index refreshed.
- Browser checks covered dark/light rendering, a 390-pixel mobile layout with no horizontal overflow, navigation, the mobile insight panel, citation-to-passage navigation, generation cancellation, comparison selectors, and the new-conversation shortcut.
- Markdown export was downloaded and its content inspected. PDF export uses browser printing; a completed PDF save was not automated. The original browser speech implementation was not audio-tested; it has since been replaced and verified as described in the local voice repair above.

## Practical limits

The benchmark's short questions took roughly 2–17 seconds in the final prompt run. A document summary took about a minute on this machine. Hardware load and model warm-up affect timings; avoid running the benchmark during the live chat demo.

The small local model can attach a plausible but incorrect source number. A conservative numeric check corrects a date/amount citation only when exactly one retrieved passage contains all its numbers and shares multiple words. Ambiguous cases are left for inspection. Syntax checks and this heuristic do not prove semantic entailment. Always use the exact passage drawer for consequential claims.

The final prompt was regression-tested after an overly restrictive wording caused excess abstention. The evaluation suite caught that regression before delivery.


## Arabic government rehearsal — 14 October 2026

- Production build and TypeScript validation pass; 42 automated tests pass.
- Three explicitly fictional Arabic service documents, 14 chunks, isolated from the original library.
- Qwen2.5:7b + BGE-M3 completed all 12 live questions. Initial fact/file/numeric checks passed 12/12; stricter passage review passed **11/12**. The excluded-work answer was correct but cited the fee section [2] instead of the scope section [1]. This unresolved generated-citation limitation is visible in the HTML report, with original answers preserved. Do not claim perfect grounded accuracy.
- Added passage-level fixture checks and a regression test for this missed evaluation failure. `node --import tsx scripts/review-government.ts` reproduces the review without rerunning inference.
- Warm, uncached literal answers: 0.24–0.37 seconds. Generated answers: 24.97–55.73 seconds; mixed median 33.81 seconds. CPU-only local measurements, not guarantees.
- The model tag says 7B; actual metadata says 7.6B. Loaded model size about 5.06 GB, GPU memory 0; this is not total peak system RAM.
- Isolated Ollama with cloud disabled, unusable external proxies, and a loopback-only Node fetch guard completed inference. An actual external registry request failed. Network adapters were NOT disconnected; a physical offline rehearsal remains outstanding.
- Fixtures are Markdown, not official committee files. Actual government PDFs, including scanned PDFs, still need testing when supplied.

Browser verification on port 3001: health ready; 3 documents / 14 chunks; attaching the permit constrained the answer to that file; fee returned with complete exemption conditions and source [1]. First cold browser request took 4.9 seconds. Source drawer displayed the exact fee passage. Arabic read-aloud produced a local 44.59-second audio track (readyState 4, playing, no media error), then was paused/closed. Physical microphone was not retested. HTML report rendered 12 answer cards with no horizontal overflow and the corrected 11/12 review result.

## Performance and citation follow-up — 14 October 2026

46 regression tests and the production build pass. The first 12 measured questions passed after adding conservative literal quotations for service-scope questions. Five new questions exposed a second real wrong-passage citation (retiree exemption), plus a false negative in the evaluation's Arabic inflection for issuance. Both were addressed; the six-case rerun (five new + multi-file comparison) passes. Latest saved results cover **17 unique questions**, across successive runs; this is not a single universal accuracy measurement.

`government-performance-v2.json` preserves the 12-case run, `government-performance-extra.json` the initial failures, and `government-performance-extra-v3.json` the rerun and pre-correction generated drafts. A bounded verbatim citation repair only reassigns to a unique passage containing a complete matching sentence of at least eight words, with all remaining claim words also in that passage. It leaves ambiguous matches untouched; it is not semantic entailment validation.

First run: literal answers 200–235 ms, generation 23.90–46.85 seconds. Later reruns were faster (Ollama prompt/KV reuse remains enabled); answer replay was bypassed. Do not present warmed rerun generation as guaranteed fresh-question speed. Source-scope regression changed from an incorrect [2] at 33.81 seconds in the original rehearsal to the correct literal [1] at 200 ms.

Production HTTP/SSE check: status 200, complete source-quoted answer at 208 ms server time / 374 ms HTTP wall time, cached:false. Both the original app (3000) and isolated government demo (3001) were restarted with the build. The library was preserved. New report: `../DocMind-Performance-AR.html`. Real committee documents, scanned Arabic PDFs, large-corpus throughput and physical network disconnection remain untested in this round.

## Committee-aligned update — 14 October 2026

- Explicit service-title routing, clarification before embedding/generation, balanced retrieval for 2–4 explicitly named services, and deterministic simple follow-up resolution preserving the requested field are implemented. Conditional passages are no longer sentence-focused away from their qualifiers.
- Strict model selection is enforced in generation and health. `npm run competition` requires `COMPETITION_MODEL` and uses isolated `competition-docs` / `data/competition` (port 3002 by default). The committee model is still unknown; qwen2.5:7b is rehearsal only.
- New fixed corpus: 10 fictional Arabic services, 17 questions, SHA-256 9435060cca9b0e1646f1912808374378c1c19dbd90e56e5f39607d329510ffbf. First run 13/17, second 15/17; retained reports include real balanced-retrieval and wrong-field rewrite failures. After the corrected Arabic follow-up guard, the three focused cases pass. Latest per-question aggregation is 16/17 under unchanged literal checks. The remaining failed check is a valid abstention paraphrase explicitly supported by its source; manual review accepts the absence answer. This authored set is now regression data, not a blind holdout.
- Full-service context (bounded, original passage metadata retained) was compared on three cases. It did not improve checked facts and produced a spelling defect in the exemption answer. Follow-up: 60.54 s whole vs 23.44 s chunks, with sequential warm/cache effects; not a causal speedup claim. Default remains chunks.
- 52 automated tests, TypeScript check and production build pass. HTTP/SSE production verification: generic service clarification 69 ms, grounded named-service fee 139 ms, both cached:false. Report and complete events saved in challenge-http-verification.json. Original app running on 3000; separate ten-service rehearsal on 3001.
- HTML report: ../DocMind-Challenge-Update-AR.html. New corpus is text-based and synthetic; actual committee files, their exact model and scanned PDFs are not validated by this run.

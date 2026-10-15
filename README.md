# DocMind

Primary specification and current implementation: [SOURCE-OF-TRUTH.md](SOURCE-OF-TRUTH.md), [handoff runbook](competition-entry/README-HANDOFF-AR.md), [acceptance evidence](competition-entry/HANDOFF-ACCEPTANCE-AR.md).

Official twelve-service submission and actual committee-model test results: [competition-entry/README-AR.md](competition-entry/README-AR.md), [RUN-RESULTS-AR.md](competition-entry/RUN-RESULTS-AR.md). Run-time generation uses `command-r7b-arabic:7b`; the UI's direct-answer shortcuts are not the official submission pipeline.

Retrieval ablations, bounded Arabizi query views and optional local reranking: [RETRIEVAL-QUALITY.md](RETRIEVAL-QUALITY.md).

Arabic multi-part questions, 22-country development matrix, quality gates, measured failures and UI audit: [ARABIC-QUALITY-AUDIT.md](ARABIC-QUALITY-AUDIT.md).

Latest local latency improvements, measured results and safe fallback behavior: [SPEED.md](SPEED.md).

Full Arabic documentation, architecture, workflow, interface guide and evaluation reports are in [documentation/](documentation/). Start with [the complete Arabic guide](documentation/DocMind-Documentation-AR.html) and [the release acceptance report](documentation/DocMind-Release-Acceptance-AR.html).

This repository includes source code, tests, local setup tools and fictional demo documents. Install dependencies and local Ollama models using the instructions below. Personal uploads, local environment settings, generated indexes, model weights and installed dependencies are excluded.

Arabic dialect/RAG root-cause review, embedding audit, reproducible tests and limitations: [README-ARABIC-RAG.md](README-ARABIC-RAG.md). Arabic/English installations now default to BGE-M3; existing indexes must be rebuilt when switching embedding models.

For the committee's ten-service challenge, see [COMPETITION.md](COMPETITION.md): isolated documents, exact required model with fallback disabled, service clarification, balanced retrieval and the fixed ten-service evaluation. The committee model name is still pending; current measurements use a rehearsal model.

**Your knowledge, connected.** A polished, fully local document assistant built for a live hackathon demo. Next.js 14 App Router, TypeScript, Tailwind, Framer Motion, and Ollama. No cloud model, hosted vector database, API key, remote font, or analytics.

## Start in four commands

Prerequisites: Node.js 22.13+ (or 24+) and the [Ollama desktop app](https://ollama.com/download), installed and running. Open a terminal in this folder:

```sh
npm install
npm run setup
npm run ingest
npm run dev
```

Open **http://127.0.0.1:3000**. Check **/health** before presenting. `setup` copies `.env.example` to `.env` if needed and installs the two configured models. Package installation and the first model downloads need internet; normal operation is offline. Models need several GB of disk and memory. A GPU helps latency substantially. This delivery already includes four fictional demo documents and a generated local index.

For a production demo: `npm run build`, then `npm start`. Both servers bind only to 127.0.0.1. Stop the development server before building in the same folder. Next.js 14.2.35 is pinned to retain the requested stack; treat this as a single-user local application, not an internet deployment.

## What is built

### Arabic government-service rehearsal

Run `npm run demo:government` after building to open a separate fictional Arabic service library at `http://127.0.0.1:3001`. It uses BGE-M3 and the installed Qwen 2.5 7B-labelled model for answer quality; `-- --fast` selects 3B. It preserves the main library and `.env`. See `GOVERNMENT-DEMO.md` for the 12-case evaluation, model-size caveat, offline-isolation boundary and reproducible commands. `npm run benchmark:government` records actual answers, sources and timings. Clear, single-file Arabic questions about supported service headings can quote the literal source section immediately while preserving its qualifications; unsupported or ambiguous questions retain generation.

### Document investigator, early evidence, and version comparison

Open **/investigate** from the sidebar. The default selection uses the current conversation's attachments; choose other indexed files or the whole library explicitly. **افحص الملفات** reads facts saved during ingestion and groups differences by explicitly identified project/topic and supported field. It distinguishes potential same-period conflicts, revision cues, and period/scope review. Every finding retains its literal quote, file, section, page and full source passage. PDF findings can open the original cited page. Export produces a JSON report with evidence and measured request timing.

The current fast investigator is a bounded deterministic extractor for explicit budgets, training duration/hours, product launch/release owners, diagnostic-log retention and selected launch dates. It does not perform exhaustive semantic contradiction detection, translate entity names, infer policy authority, convert units/currencies, or treat absence of findings as proof that documents agree. Period and scope matching use textual markers; missing scope is explicitly disclosed. Multiple named projects with ambiguous pronouns are excluded. Analysis and normalized version units are persisted in the JSON index and reused for unchanged file hashes. Old indexes need one re-ingest to prepare them. No generation model is invoked by investigation or version-report requests.

**ما الذي تغيّر؟** compares two user-ordered files using preprocessed indexed text units, aligns similar units and highlights literal word changes. Added/removed units, exact source passages and PDF-page evidence are included. Comparison ordering never establishes which version is approved. This compares normalized indexed text, not images, formatting, signatures or a complete binary document diff. Repeated identical units are deduplicated to remove chunk overlap; moved/repeated text is not tracked. Each file is limited to 1,500 unique units and the displayed report to 200 changes, with truncation disclosed. Recent comparison reports are cached in bounded memory.

In chat, **الأدلة المسترجعة** appears as soon as ranking completes, before model generation. It shows the first three retrieved passages as evidence candidates, explicitly not a verified answer; click any to inspect it. Its time is separate from the first answer token and total response time. The panel remains available after completion, cancellation or generation failure. This improves time to useful evidence without claiming to accelerate the model itself.

For a live demonstration, upload the two `Orion-*.md` files and `Vega-Policy-v1.md` / `Vega-Policy-v2.md` from `demo-packs/` (all fictional). Scan Orion for unresolved budget/duration differences; scan Vega for revision review, then compare Vega v1 → v2 to show budget, duration, hours and approval changes. Select Project Atlas from the library and ask a detailed question about its mission and launch risks to show the two-stage evidence/answer flow. On this machine, individual warm browser observations were 10 ms for the Orion scan, 34 ms for the first Vega comparison, and 0.2 s for evidence followed by 12.2 s for first generated text and 21.4 s total. These are individual observations, not general latency guarantees.

### Multiple attachments in one conversation

Uploads are automatically attached to the current conversation after successful indexing. Click library documents to attach/detach them, including documents about unrelated topics. The attachment chips above the question show the active set; answers search only these files together and retain individual file/page citations. Removing a chip does not delete its source. The scope selector can focus on one attached file; its default searches the entire attachment set. Comparison also uses attached files. Attachments survive refresh and reset with New conversation. With no attachments, the UI explicitly shows whole-library search. Up to five uploads per batch and 100 attachments per conversation; add further batches as needed. Missing/unindexed attachments produce an error instead of falling back to other files. The API accepts an optional `files: string[]`, independently of the existing single `file` focus.

- Drag-and-drop PDF, TXT, Markdown and DOCX uploads; streaming ingestion progress; manual folder re-indexing.
- Paragraph/heading-aware chunks, approximately 500 tokens with up to 80 tokens of overlap. PDF passages retain page numbers. Plain text and DOCX retain section metadata where explicit headings are available; DOCX has no reliable page numbers.
- Content-hash cache, embedding/configuration fingerprint, atomic JSON index replacement, and an ingestion lock. Removed files disappear on the next successful re-index. Unchanged files skip extraction and embedding.
- Cosine similarity + prepared BM25 statistics, merged with Reciprocal Rank Fusion (k=60). Brief answers use up to three passages; detailed/decision answers use five by default. Identical files/passages are deduplicated for unscoped retrieval. Nomic query/document prefixes are applied correctly.
- History-aware query rewriting, grounded generation, English/Arabic language selection, citation validation and a single citation-repair pass. Low-similarity retrieval abstains. Documents are explicitly treated as untrusted content in prompts.
- SSE token streaming, cancel, timings for the actual retrieval pipeline, exact source passage drawer, retrieval similarity bars, and a confidence label.
- Instant starter questions derived from document titles/sections, with no background model request competing with the first question.
- Per-document summaries from up to ten passages sampled across the file. The answer identifies the selected-passage scope; this is not an exhaustive long-document summarizer.
- Balanced two-document retrieval followed by one cited comparison. It asks the model to identify potential conflicts for the same entity/field/period, distinguish role differences and missing information, and avoid choosing an authoritative value without evidence.
- Brief, detailed and evidence-backed decision-card answer styles. Suggested next steps are labelled as suggestions, not document facts.
- A gated direct-evidence path quotes explicit supported budgets, owners, dates, counts and durations in brief mode. Recognized comparison fields can also be assembled directly from each file's literal evidence. These answers are visibly labelled **نقل مباشر من المستند**; they are not cached/generated answers. Ambiguous subjects, mismatched periods, differing retrieved values and inference requests fall back to generation. This is a bounded extractor, not a universal fact parser.
- Local PDF.js viewer opens the original cited page and highlights exact normalized text runs. Partial matching is labelled; the indexed passage remains visible. Worker/fonts/CMaps/WASM are copied locally during installation/build; no CDN is used. The viewer loads only when opened.
- **تجهيز العرض** preloads generation, embeddings and installed speech engines, with live steps and cancellation.
- Local browser conversation storage, Markdown export including source passages, and print-to-PDF export with a clean print layout.
- Offline microphone/file transcription through local Whisper, with Arabic/English/automatic language selection. Local Piper voices read answers aloud using an audio player with stop and replay controls, independent of browser speech packs.
- Dark/light themes, responsive navigation, reduced-motion support, keyboard focus states, RTL answer/input/source direction, empty/loading/error states.
- `/health` readiness diagnostics and `/evaluate` with 16 English/Arabic/follow-up/scope/comparison/abstention cases, separate fact/source checks, first-text timings, observed median/P95 and JSON report export.

## Configuration

Edit `.env` and restart the app. CLI scripts also read `.env`.

| Setting | Default | Purpose |
| --- | --- | --- |
| OLLAMA_BASE_URL | http://127.0.0.1:11434 | Loopback hosts only |
| OLLAMA_MODEL | qwen2.5:3b | Generation |
| OLLAMA_FALLBACK_MODEL | llama3.2:3b | Used only when primary is absent and fallback is installed |
| EMBEDDING_MODEL | nomic-embed-text | Set `bge-m3` for stronger multilingual/Arabic retrieval |
| DOCS_DIR | ./docs | Recursive input folder |
| INDEX_DIR | ./data | Local index and lock |
| TOP_K | 5 | Retrieved context count (1–12) |
| BRIEF_TOP_K | 3 | Passage count for brief answers, capped by TOP_K |
| DIRECT_FACTS | true | Permit labelled literal fact/comparison extraction; false forces generation |
| CHUNK_TOKENS | 500 | Approximate token target |
| CHUNK_OVERLAP | 80 | Maximum overlap budget |
| MIN_SIMILARITY | 0.30 | Retrieval abstention gate; calibrate against your corpus |
| OLLAMA_TIMEOUT_MS | 180000 | Per-request model timeout |
| OLLAMA_KEEP_ALIVE | 30m | Keep local models loaded between requests (subject to available RAM) |
| OLLAMA_CONTEXT_SIZE | 8192 | Minimum context; grows to fit long evidence without dropping sources |
| ANSWER_MAX_TOKENS | 640 | Generation/repair cap; truncated output is reported as incomplete |
| MAX_UPLOAD_MB | 20 | Limit per uploaded file; up to five files per request |

For Arabic-heavy corpora, run `ollama pull bge-m3`, set `EMBEDDING_MODEL=bge-m3`, and re-run ingestion. Changing embedding or chunk settings invalidates the cache. The fallback generation model is not automatically downloaded; install it with `ollama pull llama3.2:3b` if desired.

Decision cards can use selected literal evidence directly, split into findings, key numbers, information limits and a clearly labelled suggested next step. The verified budget/approval card took 137 ms in the pipeline and 0.3 s in the browser. Unsupported topics or cross-language paraphrases use generation. Explicit revision/authority cues defer comparison to the model; differing recognized scope markers are flagged for review.

## CLI and validation

### Faster local answers

Completed cited answers and query embeddings are cached in bounded process-local memory for 30 minutes. Answer reuse requires the exact question, recent conversation, document scope, answer style, comparison files, model, and index revision. Re-indexing invalidates old answers; errors, aborted streams and refusals are never saved as answers. The UI labels reused answers **Instant replay** and reports **First text** latency for fresh answers. Quality-lab runs bypass answer reuse so their results still exercise generation.

Named or scoped standalone questions avoid a rewrite model call. Ambiguous follow-ups still resolve against history; JSON rewriting is validated and an invalid rewrite falls back to the user's actual question plus the previous question. Generation also retains that original subject. Index snapshots reload when file metadata changes, and BM25 term frequencies are prepared once per scope. Same-content uploads reuse embeddings under their new filename.

Brief answers use an 80-word target and up to 384 output tokens. Long passages may be focused to extractive windows with strong lexical matches; paraphrases with weak lexical matches keep full passages. Detailed/decision/summary/comparison modes retain full retrieved passages. A citation-repair pass and numeric alignment remain enabled. CPU-only hardware still has a noticeable first-answer delay; caching is not a claim that new questions are instantaneous. Fewer passages can miss evidence: switch to detailed or increase BRIEF_TOP_K for complex questions.

Direct evidence answers quote original sentences with source citations instead of asking the generator to paraphrase them. Both scoped and explicitly named subjects are supported, with conservative gates. The same retrieval/index still runs. Direct comparison separates launch ownership from release ownership, shows missing fields as missing in the retrieved passages, and flags differing values for review. Date-marker equality is a heuristic; it does not prove that two policies apply to the same circumstances. For generated comparison tables, citations must stay within the correct file column. A failed scope check is reported rather than displayed as a verified comparison.

```sh
npm run ask -- "When does the Atlas public beta launch?"
npm test
npm run typecheck
npm run build
npm run benchmark
```

The quality lab sends actual requests through the same RAG pipeline. It checks required answer terms and expected-file citations, including a missing-information case. Its score is a small demo regression measure, **not** a calibrated general accuracy score. Replace `lib/evaluation.ts` for another corpus. No benchmark scores are hardcoded in the interface. Numeric literals are checked against the cited passage, including prefix citations; unmatched numeric references are flagged for source verification and are not reused as cached answers. These checks are conservative and do not prove semantic entailment.

The lab may load `performance-hackathon-final.json`, an actual saved benchmark run, labelled with its timestamp, model, corpus size and whether the current index revision matches. **Run evaluation** performs a fresh run. Reports distinguish direct evidence from model generation; response times mix these paths and should not be presented as pure LLM speed. The recorded 16-case run passed all checks on this machine, with a 259 ms median and an observed 7.63 s P95; literal standalone evidence took 185–323 ms. These are small, warm, sequential measurements, not universal guarantees. See QA.md for limits and voice timings.

Confidence is a heuristic based on the strongest retrieved cosine similarity: high ≥0.65, medium ≥0.45, otherwise low. Summary confidence is medium because retrieval is representative sampling. RRF scores rank passages; they are not displayed as probabilities. Citation syntax checks cannot guarantee semantic support, so users can inspect every passage. A conservative numeric alignment check can correct a date/amount citation when only one retrieved passage matches all its numbers and shares multiple words. See `QA.md` and `verification.json` for measured checks and limits.

## Three-minute demo

Before the demo: run ingestion, open `/health`, click **تجهيز العرض**, and run the quality lab once. Use a production build and keep Ollama running. For the conflict segment, import both Markdown files from `demo-packs/` and select them in comparison mode. The supplied Atlas/Orion corpora are explicitly fictional.

| Time | Action | Story |
| --- | --- | --- |
| 0:00–0:20 | Show the workspace and local badge. Disconnect internet if desired. | “These documents and models stay on this computer.” |
| 0:20–0:55 | Ask an Arabic question from your own PDF in brief mode. | Point to streaming, click a citation, then **عرض الدليل داخل PDF** to show its original page and highlighted evidence. |
| 0:55–1:20 | Ask “How many teams are invited?” | Show follow-up rewriting using conversation context. |
| 1:20–1:45 | Ask “من المسؤولة عن إطلاق مشروع أطلس؟” | Same corpus, Arabic response, right-to-left text and citations. |
| 1:45–2:05 | Ask “What was Atlas revenue in 2023?” | Demonstrate honest abstention for information absent from the corpus. |
| 2:05–2:40 | Select Orion-Operations and Orion-Finance; ask “Compare Project Orion's March 2026 training budget and duration.” | Show $18,000 vs $24,000 and 8 vs 10 days with citations. Both are presented as active for the same period; the assistant must flag the difference for review, not invent authority. |
| 2:40–3:00 | Show the saved quality results/report and export Markdown. | Facts, citations and latency are inspectable. Avoid starting a fresh full evaluation during this short demo. |

Timing depends on hardware and warm-up; skip the summary if generation is slow. Set up local speech and check microphone permission before demonstrating recording.

## Local voice setup

With Python 3.10–3.14 installed, run `npm run setup:voice` once while online. This creates an isolated `.voice-venv` and downloads multilingual Whisper small and the Arabic Jordanian Kareem / English Lessac Piper voices into `data/voice`. The working copy on this machine is already set up. The source ZIP deliberately excludes model weights and the Python environment. Check `/health` for installed voice assets.

Choose the recording language (Arabic by default), press the microphone, speak, then press again to stop. Recordings stop automatically after 60 seconds. Review the transcript in the question box before sending it. Allow microphone access for localhost; if the embedded browser denies access, open the same URL in Chrome/Edge or use **استيراد تسجيل** with a WAV/WebM/OGG/MP4/MP3 file (maximum 8 MB, 60 seconds).

While waiting for permission, press the microphone again to cancel. If the browser leaves its permission prompt pending, the UI recovers after 20 seconds and explains these alternatives; any late microphone stream is stopped.

Click an answer's speaker to generate local audio. The button becomes a stop control, and a native audio player provides playback, volume and seeking. If automatic playback is blocked, press Play in that player. Markdown formatting and citation numbers are removed from spoken text. Only answer text can be read; a raw image needs extracted text first.

Runtime transcription and synthesis share a local Python worker which retains loaded engines and processes jobs serially (one active plus one queued). The worker is released after five idle minutes; cancelling an active job kills it, so the next request starts clean. There is no external speech API, extra listening port or saved microphone recording. `HF_HUB_OFFLINE=1` is enforced. Browsers/OS still control microphone permission and output volume. Speech model quality varies by accent, noise and language; review transcriptions. Active CPU speech jobs time out after three minutes. Set `VOICE_PYTHON` only if you intentionally use another compatible local environment.

Speech references and licenses: [faster-whisper](https://github.com/SYSTRAN/faster-whisper) (MIT), [Piper](https://github.com/OHF-Voice/piper1-gpl) (GPL-3.0), and the downloaded per-voice `MODEL_CARD` files. Model/runtime downloads are kept separate from the application source archive.

## Shortcuts

- Ctrl/Cmd + K: focus question.
- Ctrl/Cmd + Shift + O: new conversation.
- Enter: send. Shift + Enter: newline.
- Escape: stop generation, dismiss source drawer/mobile sidebar.

## Project structure

```text
app/                 UI pages and API route handlers
components/          Workspace and safe Markdown renderer
lib/                 Extraction, chunking, storage, retrieval, Ollama, RAG
scripts/             Setup, ingestion and CLI questions
docs/                Fictional bilingual demo corpus; add your own files here
data/                Generated JSON index, excluded from Git
tests/               Retrieval/chunking/citation regression tests
```

## Operational limits and troubleshooting

- **Ollama down/model missing:** `/health` shows the connection and configured models. Start Ollama or run the suggested pull command. There is no silent cloud fallback.
- **Scanned PDFs:** OCR is not bundled. Image-only files report no readable text; OCR them locally before import. Password-protected or malformed documents produce ingestion warnings. PDF page extraction is supported; it does not reconstruct complex tables perfectly.
- **Ingestion crash:** the old index remains readable. If no ingestion process is running, remove `data/ingest.lock` and retry. Do not remove the lock while ingestion is active.
- **Large libraries:** all vectors are loaded in memory and ranked linearly. This deliberate hackathon architecture suits small/medium folders, not millions of passages. PDF and DOCX extraction is in-process; use trusted local files.
- **Grounding:** streaming text is provisional until citation validation finishes and may be replaced. The prompt and citation guard reduce hallucinations but cannot formally prove that every claim follows from a cited passage. A correct uncited answer gets one repair attempt, otherwise the assistant abstains.
- **Storage:** source files and the JSON index are plaintext on your disk. Conversations are stored in this browser’s local storage; new conversation clears that saved chat. File uploads never overwrite originals; duplicates receive numbered suffixes. Delete source files manually and re-index to remove them from retrieval. Existing exported/saved conversations retain their source snapshots.
- **Offline boundary:** the app restricts Ollama to loopback, uses no external runtime assets, blocks remote images/Markdown links, rejects cross-origin mutations, and binds to localhost. Do not expose this single-user app through a reverse proxy or public tunnel. Browser/OS services themselves are outside the app’s control.
- **PDF export:** uses the browser’s Print → Save as PDF, preserving Unicode/Arabic. It does not use a cloud conversion service. Markdown export includes the full indexed source passages.

Implementation references: [Ollama embeddings API](https://docs.ollama.com/api/embed), [Ollama chat API](https://docs.ollama.com/api/chat), and [Next.js 14 patch guidance](https://nextjs.org/blog/security-update-2025-12-11).


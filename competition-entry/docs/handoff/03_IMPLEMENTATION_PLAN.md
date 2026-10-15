# Suggested implementation design (engineering guidance)

## Module boundaries
- main.py: argument handling, JSON preservation, ordered processing, atomic output/checkpoints.
- app/config.py: paths relative to main.py, local Ollama URL, required generation model, budgets/timeouts.
- app/corpus.py: file inventory, conservative cleanup, heading parsing, stable provenance and corpus fingerprint.
- app/normalize.py: Arabic search normalization, Arabic/Persian digit matching, dialect aliases.
- app/retrieval.py: service routing, section-aware lexical ranking, evidence expansion for notes and lists.
- app/dialogue.py: per-chat state and references, topic-change handling.
- app/generation.py: Ollama calls, Arabic instructions, response parsing and bounded repairs.
- app/grounding.py: passage-ID validation and conservative claim checks.
- app/doctor.py: local readiness report, missing files/model/packages.
- tests/: meaningful synthetic unit tests and separately marked real integration tests.

These names are suggestions. Standard-library HTTP is acceptable if it reduces dependency burden; no framework is compulsory.

## Evidence and retrieval
Store service_id, section, passage_id, source path, source offsets/line provenance, and source-preserving text. Use normalized parallel text only for search. Avoid a global generic chunking scheme that detaches a condition from its amount. Retain headings to distinguish similar services. Handle Arabic heading variations discovered in the actual files, including headings sharing a line with content.

Search in two layers: identify plausible service(s), then retrieve relevant sections and dependent notes. Do not force exactly one service for comparisons or multi-person stories. Avoid an overconfident router hiding relevant alternatives; ambiguous candidates should cause clarification or qualified results.

For fees, explicitly preserve predicates: age boundaries, months remaining/expired, domestic/abroad, occurrence count and additional charges. Do not invent thresholds or sum fees unless the source establishes that charges apply together. Treat missing applicability details as unknown. Do not take numbers from example prompts as official rules.

## Generation and evidence output
Give the model the current question, bounded relevant dialogue, service identities and complete supporting passages. Ask it to return answer plus used evidence IDs. Python resolves IDs to exact passages. Use only relevant source text for contexts, without wrapping it in invented government statements. Technical provenance may be stored in logs.
Refusals and clarifications also go through the generation model. For these, contexts may be [] if no evidence is used; a supported partial answer can have its supporting passages. Do not force empty contexts merely because a response contains a question.

## Reliability
Validate top-level input before inference; describe malformed input clearly. For valid messages keep results despite one failed call. Bound retries so a dead server does not consume unbounded time across a large batch. Consider a circuit breaker with explicit error markers, without claiming generated answers. Atomic replacement and progress checkpoints prevent torn output. Keep diagnostics on stderr and output file strict JSON.
No runtime automatic installation, model pulling or network fallback. Derived corpus indexes may be cached by source hash. Each final answer still requires live approved-model generation.

## Hardware awareness
Target Windows and a CPU laptop with 16 GB RAM; actual speed depends on approved model, quantization and context. Avoid concurrent generation that exhausts memory. Start sequentially, reuse loaded model, measure before optimizing. Do not promise a 7B model will be fast on integrated graphics. Let operator configure context/output budget after measuring evidence length and actual memory use.

## Suggested four-hour priority plan
1. 0–35 minutes: inventory, source inspection, ingestion, executable I/O contract.
2. 35–100 minutes: service/section retrieval, approved Ollama generation, provenance mapping.
3. 100–160 minutes: fee branches, notes, ambiguity, unsupported questions, comparisons.
4. 160–210 minutes: official practice cases, dialect and dialogue, resilience, timing.
5. 210–240 minutes: offline rehearsal, packaging and walkthrough.
Suggested allocation only; quality and remaining time should drive adjustments.

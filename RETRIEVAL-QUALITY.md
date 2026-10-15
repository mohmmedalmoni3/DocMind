# Retrieval quality: measured changes, not model-name claims

## Implemented

- Existing BM25 + dense cosine + Reciprocal Rank Fusion remains the default.
- `lib/query-views.ts` adds a bounded Arabizi search view when at least two known conversational tokens occur. The original query remains in retrieval. Quoted names, unknown words, codes, and numerical values are retained. This is not general transliteration or dialect identification, and does not claim complete Arabizi compound-question understanding.
- Optional `RERANK_MODE=ollama` ranks a bounded candidate list using the same configured Ollama model and structured JSON. Only a complete, unique permutation is accepted. Provenance is retained; citations are renumbered. Failure/deadline preserves hybrid order; caller cancellation propagates.
- Reranking is OFF by default. It is a listwise LLM experiment, **not a Cross-Encoder**. It does not change the competition model or require Python/model downloads. Summaries and balanced multi-service/document comparisons retain their existing selection paths. Direct literal field answers bypass it.
- Document text remains untrusted data in the reranker prompt. A valid permutation is structural validation, not proof of semantic relevance or complete prompt-injection resistance.

## Configuration

```dotenv
RERANK_MODE=off
RERANK_CANDIDATES=12
RERANK_TIMEOUT_MS=1500
```

Try `ollama` only in a measured experiment. A deadline controls the client wait; it is not a hard guarantee of GPU scheduling or end-to-end generation latency. No extra network destination is introduced.

## Reproducible retrieval evaluation

```powershell
node --env-file=.env --import tsx scripts/evaluate-retrieval.ts evaluation/retrieval-smoke.json data/retrieval-results.json
```

The included smoke judgments target the five passages of the fictional Arabic Atlas document, whose IDs must exist in the index. A changed index may require new judgments. The evaluator rejects missing or out-of-scope gold IDs rather than silently scoring them. Input:

```json
[{"id":"unique-case","query":"السؤال الأصلي","files":["document.md"],"relevantIds":["actual-chunk-id"],"dialect":"human-reviewed label"}]
```

Every relevant passage needs human judgment; specifying only the first matching passage biases precision. Collect independent questions from speakers, retain source passages and reference answers, separate development from held-out evaluation, and report each dialect/task slice. Synthetic examples are development fixtures, not native-speaker validation.

The runner compares dense, BM25, hybrid and hybrid+reranking with the same documents/query. It reports Precision@5, Recall@10, MRR and nearest-rank p50/p95/p99. Precision uses a fixed denominator of five; with one relevant passage its ceiling is 0.2 even if the only relevant passage ranks first. Recall@10 on five candidates is an easy smoke check, not a demanding retrieval benchmark. MRR records ranking position. Queries with no gold passage require a separate abstention evaluation and are rejected by this retrieval runner.

Embedding time is shared across methods and reported separately; BM25 excludes it. Runs are sequential, single-user, and may include warm/cached models. No cold-start, load-test or generation-latency claim is made. JSON includes index update time, models, returned IDs, per-case scores and reranker fallback reasons. Raw reports are local under ignored `data/`.

## Initial observed experiment

Three human-readable, developer-authored questions: launch responsibility, diagnostic-log retention, and budget/support. Dense and hybrid retrieved the labeled passage in all three; BM25 in one. All three reranking calls hit the 1.5-second deadline and retained the hybrid order, so **no quality gain was demonstrated**. The appropriate production choice remains hybrid without reranking. The sample is too small to support percentile performance guarantees or overall Arabic accuracy claims.

## What is not yet established

No 500–1,000-question human dataset has been collected; no blind dialect generalization, trained cross-encoder comparison, new embedding-model comparison, PDF table/read-order certification, concurrency benchmark or production multi-user ACL verification has been performed in this change. Numerical citation checks cannot prove every nonnumeric factual claim. Answer correctness, groundedness and citation support need a separately annotated answer set and human audit; they are not inferred from retrieval scores.

References: [Ollama structured outputs](https://ollama.com/blog/structured-outputs), [Sentence Transformers retrieve and rerank](https://sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html), [Ragas metric definitions](https://docs.ragas.io/en/latest/concepts/metrics/available_metrics/). These references inform engineering choices; they do not certify this application.

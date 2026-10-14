# Arabic government-service rehearsal — fictional data

This pack models a fictional home-maintenance permit and a separate library-card replacement service. **It is not official guidance.** It includes eligibility, tenant documents, fees, a conditional exemption, business-day processing, incomplete applications, appeals and deliberately absent information. It must be replaced by the committee's actual documents when provided.

## Run on this Windows laptop

Ollama must be running; the following models were installed during this rehearsal:

```sh
ollama pull bge-m3
ollama pull qwen2.5:7b
npm run build
npm run demo:government
```

Open http://127.0.0.1:3001. The separate process uses `demo-packs/government-ar` and `data/government-bge`. The main library, uploaded files, `.env`, and conversation at port 3000 are preserved. If the main production server uses this same checkout, stop it before rebuilding and restart it afterwards.

The quality profile uses `qwen2.5:7b`, BGE-M3 and a 4096 minimum context. For a faster but less reliable generation comparison, stop this demo process and use `npm run demo:government -- --fast` (3B). The 7B-labelled model actually reports **7.6B parameters** in Ollama; its successful execution proves this laptop can run that size, but must not be represented as a model with strictly ≤7.0B parameters if the committee sets such a hard limit. The 3.1B profile is below that limit.

The short-answer mode can directly quote one strongly matched source section for supported Arabic service questions. It preserves the complete selected passage and citation, including exceptions, rather than generating new facts. It declines personal eligibility decisions, unsupported qualifiers, ambiguous sections and multiple-file scopes. The detailed mode still uses generation. The method is visible in each answer.

## Reproduce the evaluation

```sh
npm run benchmark:government
npm run benchmark:government -- --fast
```

The runner uses a separate index, warms generation/embeddings, bypasses answer replay, and saves `government-current.json` after every case. It stores exact answers, sources, first-text/evidence/total timing, corrections, errors and simple expected-fact/source/numeric checks. It is a synthetic regression suite, **not a general accuracy percentage**. Inspect the language and conditional statements manually, even if keyword checks pass. Earlier reports preserve failures and different prompt/configuration conditions; don't infer model/embedding causal improvements from runs where both changed.

## Demo flow

1. Open `/health` and use **تجهيز العرض**. Attach the maintenance file and ask its ordinary fee, then required tenant documents; open each source.
2. Attach the procedure file too. Ask when processing starts, and the deadline for incomplete documents. Distinguish business days from calendar days and validity from processing time.
3. Ask the conditional exemption question. Verify the eligibility certificate condition remains in the answer.
4. Attach the library-card file; ask both fees. Each fee must cite its own document. Treat a missing/wrong amount or mismatched citation as a failed answer.
5. Ask the urgent-track fee or support phone. The assistant must disclose missing information rather than invent it.
6. Use read-aloud and inspect the source. Imported/recorded text should be reviewed before sending.

## Offline verification boundary

`scripts/local-only-guard.cjs` blocks non-loopback **fetch** requests in the test/server process. Browser CSP restricts connections/assets to local sources. Python speech enforces local model loading. For this run, a separate Ollama process on 11435 had cloud disabled and HTTP/HTTPS proxies pointed to closed loopback port 9; a real registry request failed while local inference succeeded. Logs and JSON reports record this.

This is **application-level isolation**, not a claim that the operating system, Wi-Fi, or every possible socket was disconnected. The final venue rehearsal should additionally disconnect Wi-Fi/Ethernet after downloading models, then repeat the above flow. No network adapter was changed during remote-assisted testing. Do not copy Windows `.voice-venv` to a different OS; recreate dependencies if migrating later.

## Recorded result

### Follow-up performance check (14 October)

The suite now has 17 cases, including alternate wording, a second service fee, permit validity versus processing time, retiree exemption, and wrong-attachment abstention. The scope-question regression now quotes the full matching source section and uses its actual citation. Unknown actions, personal eligibility, unsupported qualifiers, and ambiguous sections do not use that shortcut. This addresses the previously observed failure for this class of question, not every possible generated-citation error.

```sh
npm run benchmark:government
node scripts/performance-report.mjs government-current.json
```

Open `../DocMind-Performance-AR.html` for the resulting self-contained Arabic report. The runner bypasses answer reuse and records first text, evidence, total latency, complete sources and passage checks. Test the committee's actual files separately; this suite uses small fictional Markdown fixtures and does not validate scanned Arabic PDFs or large-library speed.

### Original rehearsal, before the scope quotation improvement

See `government-quality-reviewed.json`: 11/12 after passage-level review (the original simpler checks were 12/12). The excluded-work answer cites the wrong section of the correct document. This is an unresolved citation limitation, not a fact error; open sources during the demo and do not advertise perfect accuracy. Literal answers took 0.24–0.37 seconds, generated answers 24.97–55.73 seconds on this CPU. The standalone Arabic report is `../DocMind-Government-Readiness-AR.html`.

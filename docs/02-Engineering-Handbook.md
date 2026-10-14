# Atlas · Engineering handbook

This fictional handbook supports the DocMind demo.

## Architecture

Atlas uses a modular architecture with an ingestion worker, a search index, and a conversational interface. Documents are split at paragraph boundaries into approximately 500-token passages with 80 tokens of overlap. Each passage retains its original file name, page number when available, and section title.

## Retrieval and evidence

Search combines vector similarity and BM25 keyword matching using Reciprocal Rank Fusion. The default retrieval count is five passages. Answers must cite the passages that support their claims. If the knowledge base does not contain an answer, the assistant must explicitly abstain. Retrieval confidence describes the strength of the evidence match; it is not a probability that an answer is correct.

## Service objectives

The beta target for time to first token is below 2 seconds on the reference workstation after model warm-up. The target for a complete answer is below 12 seconds for typical questions. These are targets, not measured guarantees. The reference workstation has 32 GB of RAM and a GPU with 12 GB of VRAM.

## Privacy and data retention

Document text, embeddings, and conversations must stay within the workspace boundary. The default retention period for diagnostic logs is 14 days. Raw document content must not be written to diagnostic logs. Deleting a document must remove its passages on the next successful ingestion run. Production backups are retained for 30 days.

## Release process

Every release must pass type checks, build checks, retrieval regression tests, citation checks, and a manual bilingual smoke test. The release owner is Omar Haddad. Critical regressions block the release. Evaluation results are reviewed by engineering and product together.

# 0002: Page-Bounded Chunking and Strict Verbatim Citation Grounding

Status: accepted

## Context & Decision

In enterprise compliance and contract review, Retrieval-Augmented Generation (RAG) is routinely challenged during regulatory audits. Standard RAG designs allow sliding chunks to straddle across multiple pages and rely on LLMs to quote evidence verbatim—a common source of subtle hallucination (e.g. paraphrasing contract clauses or misrepresenting exact retention days).

We decided to enforce two architectural invariants:
1. **Page-Bounded Chunking**: Chunks are generated strictly within individual page boundaries. A chunk never spans across multiple pages, preserving absolute provenance coordinates `(artifactId, pageNumber, charOffset)`.
2. **Strict Verbatim Citation Grounding**: Any Citation cited as evidence must be verified via exact verbatim substring matching against the immutable page text. Any paraphrased or altered citation is rejected as ungrounded (`grounding_failed`).

## Considered Options

- **Option 1: Cross-Page Sliding Token Windows**: Retains smoother narrative context across page breaks, but destroys page attribution, making legal/regulatory auditing ambiguous.
- **Option 2: Unverified LLM Quotations**: Trusting LLMs to extract exact quotes without code-level grounding verification, which introduces hallucination risk into binding compliance determinations.
- **Option 3 (Chosen): Page-Bounded Chunking with Deterministic Verbatim Grounding**: Enforces strict page boundaries and code-level substring verification for every piece of evidence.

## Consequences

- Search indexing segments each page into discrete, localized chunks tagged with page numbers and offsets.
- Retrieval combines sparse lexical matching (BM25) and semantic relevance (Reciprocal Rank Fusion) to ensure critical regulation clauses, IDs, and numbers are not lost.
- The `CitationEngine` provides a deterministic `verifyCitation` seam that guarantees zero hallucination in downstream Finding generation.

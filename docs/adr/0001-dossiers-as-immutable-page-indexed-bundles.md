# 0001: Dossiers as Immutable Page-Indexed Provenance Bundles

Status: accepted

## Context & Decision

In vendor compliance and contract assurance, incoming documents must be evaluated against strict policy criteria, where findings require pinpoint citations (exact page and clause references) that can withstand regulatory audits.

We decided to structure every **`Dossier`** as an immutable collection of **`Artifact`**s indexed strictly by page (`pages: Array<{ pageNumber: number, text: string }>`) with deterministic cryptographic hashes (`sha256`), rather than storing raw unindexed text blobs or mutable database rows.

## Considered Options

- **Option 1: Flat Unstructured Text Blob**: Simpler and faster intake, but loses page boundaries and makes reproducible citations impossible after parsing.
- **Option 2: Dynamic / Mutable Document Rows**: Allows on-the-fly corrections, but compromises the legal audit trail needed for regulatory compliance determinations.
- **Option 3 (Chosen): Immutable Page-Indexed Provenance Bundle**: Enforces structural page integrity and cryptographic hashes at the intake seam.

## Consequences

- Upstream ingestion must validate and segment raw uploads into discrete pages with SHA-256 hashes before downstream processing.
- RAG and compliance evaluation agents can reference exact `(artifactId, pageNumber)` tuples without ambiguity.
- Subsequent stages (Finding generation, Reviewer workspace) can cross-examine exact source excerpts directly against verified immutable page snapshots.

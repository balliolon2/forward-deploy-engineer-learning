# 0005: Split-Screen Evidence Inspection and Tamper-Proof Audit Trail

Status: accepted

## Context & Decision

When compliance officers (Reviewers) examine an operational `Case`, they must evaluate whether flagged breaches or inconclusive findings warrant rejection, information requests, or executive exception overrides. 

In traditional ticketing systems, reviewers must download detached multi-page contracts, search for text manually, and enter unstructured notes, leading to extended review latency (Mean Time to Determination), reviewer fatigue, and non-reproducible decisions that fail regulatory audits (e.g. SOC 2, ISO 27001, FedRAMP).

We decided to enforce two core architectural and UX mechanisms:
1. **Contextual Split-Screen Deep-Linking**:
   - The frontline interface pairs the evaluated `Finding` with the primary source `Artifact` side-by-side.
   - When a Citation is selected, the viewer deep-links directly to `(artifactId, pageNumber, charOffset)`, highlighting the exact verbatim quote in situ so the reviewer can instantly inspect the surrounding clause context without leaves of context.
2. **Canonical Tri-Action Determinations**:
   - Reviewers resolve claimed cases (`IN_REVIEW`) exclusively through one of three authoritative Determination types:
     - `approved_override`: Waives a flagged breach with mandatory executive rationale.
     - `rejected`: Confirms a compliance breach and rejects the vendor dossier.
     - `information_requested`: Returns the case with a formal inquiry for supplemental vendor evidence.
3. **Append-Only Tamper-Evident Audit Trail (Event Sourcing)**:
   - System state is never mutated in place. Every lifecycle action (`CASE_CREATED`, `CASE_CLAIMED`, `DETERMINATION_RECORDED`) appends an immutable `AuditEvent` with unique `eventId`, RFC 3339 `timestamp`, `actorId`, `dossierId`, `caseId`, and serialized `payload`.
   - The Audit Trail provides an auditable, replayable timeline guaranteeing zero silent modifications.

## Considered Options

- **Option 1: Detached Document Downloads & Overwrite-in-Place DB Updates**: Low upfront engineering cost, but causes extreme operational friction for reviewers and fails regulatory compliance audits due to mutable history.
- **Option 2: Unstructured Free-Text Decisions**: Allows reviewers to enter arbitrary resolutions without standardized taxonomy, breaking downstream metrics and automated vendor notification pipelines.
- **Option 3 (Chosen): Split-Screen Evidence Deep-Linking with Canonical Determinations and Append-Only Audit Trail**: Minimizes MTTD, guarantees exact provenance for human decisions, and provides an unalterable audit log for enterprise governance.

## Consequences

- Reviewers can render confident determinations in seconds because citations are grounded in verified document offsets.
- Every state change and human override is indelibly captured in an append-only event stream.
- The `executeDetermination()` public seam guarantees that no case can be resolved without an authenticated Reviewer, a valid Determination type, and a non-empty rationale.

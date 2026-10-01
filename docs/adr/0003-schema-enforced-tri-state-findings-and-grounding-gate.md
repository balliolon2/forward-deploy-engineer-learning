# 0003: Schema-Enforced Tri-State Findings with Mandatory Grounding Gate

Status: accepted

## Context & Decision

In automated compliance auditing, binary evaluation (Pass / Fail) is insufficient because documents frequently contain ambiguous phrasing, missing addenda, or unverified claims. Furthermore, generative AI models can generate seemingly plausible evaluation rationale while citing fabricated or slightly modified quotes.

We decided to enforce two structural invariants:
1. **Tri-State Finding Taxonomy**: Every `Finding` must adhere to a strict three-state model:
   - `pass`: Fully verified evidence meeting all criteria.
   - `flagged`: Verified evidence that explicitly breaches the policy threshold.
   - `inconclusive`: Insufficient evidence, missing documentation, or ungrounded claims requiring human review.
2. **Mandatory Grounding Gatekeeper**: No finding may hold a `pass` or `flagged` status unless every single supporting `Citation` is verified verbatim against the immutable page snapshot via `CitationEngine.verifyCitation()`. If any citation fails verification, the engine automatically downgrades the finding to `inconclusive` with a `grounding_violation` reason.

## Considered Options

- **Option 1: Binary Pass/Fail Evaluation**: Too rigid for compliance and contract disputes; leads to high false-positive or false-negative rates on incomplete dossiers.
- **Option 2: Passive LLM Citation Acceptance**: Accepting generated citations on trust without runtime verification, allowing subtle hallucinations into legal records.
- **Option 3 (Chosen): Tri-State Taxonomy with Active Grounding Gatekeeper**: Schema-enforced outputs with automated gatekeeping to guarantee zero hallucinated citations.

## Consequences

- The `Finding` type is strictly validated using Zod, ensuring `findingId`, `criterionId`, `status`, `confidence`, `reasoning`, and `citations` are always present and well-formed.
- Reviewers and compliance officers can rely with mathematical certainty on all passed/flagged findings having genuine, untampered citations.
- Inconclusive findings naturally route into the Human-in-the-Loop operational workflow in Stage 05.

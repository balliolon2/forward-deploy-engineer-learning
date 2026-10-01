# 0004: Exception-Based Case Generation and Triage State Machine

Status: accepted

## Context & Decision

In high-volume compliance environments, evaluating thousands of vendor dossiers creates operational bottlenecks if every submission requires human touch. Conversely, auto-resolving non-compliant dossiers without formal accountability violates regulatory standards.

We decided to enforce two architectural mechanisms:
1. **Exception-Based Case Generation**: A `Case` is generated strictly when a Dossier contains one or more non-passing findings (`flagged` or `inconclusive`). Submissions where all criteria achieve a verified `pass` are automatically settled as `auto_approved` without entering the reviewer queue.
2. **Canonical Triage Routing**: Cases are systematically labeled according to the repository's 5-role triage vocabulary:
   - Contains any `flagged` finding: labeled **`ready-for-human`** (compliance breach requiring human determination).
   - Contains `inconclusive` findings without breaches: labeled **`needs-info`** (missing evidence requiring vendor follow-up).
3. **Finite State Machine with Immutable Determination**: A Case moves strictly through `OPEN` ➔ `IN_REVIEW` (claimed by a Reviewer) ➔ `RESOLVED` (stamped with an official `Determination` such as Approved, Rejected, Escalated, or Information Requested). A resolved case cannot be reopened or mutated without explicit audit reasoning.

## Considered Options

- **Option 1: Universal Ticket Generation**: Generating an operational work item for every dossier, creating severe reviewer fatigue on compliant submissions.
- **Option 2: Ad-Hoc String Statuses**: Allowing arbitrary status strings on cases, leading to state inconsistencies and unresolved audit trails.
- **Option 3 (Chosen): Exception-Based Case Generation with Canonical Triage Routing and Strict FSM**: Automates compliant dossiers, routes exceptions directly to the appropriate role queue, and enforces state machine integrity.

## Consequences

- Compliance officers only review actionable exceptions.
- The `Case` entity carries full provenance, linking the parent `dossierId`, the problematic `findingIds`, assigned reviewer, and the final `Determination`.
- Integrates seamlessly with GitHub Issue tracking and frontline operational dashboards in Stage 06.

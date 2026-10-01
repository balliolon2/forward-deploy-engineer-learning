import type { Dossier } from "../domain/dossier.js";
import type { Finding } from "../domain/policy.js";
import type { Case, CaseAction, RoutingOutcome, TriageRole } from "../domain/case.js";

let caseCounter = 1;

/**
 * Exception-based case router adhering to ADR-0004.
 * Auto-approves compliant dossiers and generates prioritized Cases for exceptions.
 */
export function routeDossierFindings(
  dossier: Dossier,
  findings: readonly Finding[]
): RoutingOutcome {
  const flagged = findings.filter((f) => f.status === "flagged");
  const inconclusive = findings.filter((f) => f.status === "inconclusive");

  // If every single criterion passed, auto-approve and do not fatigue reviewers
  if (flagged.length === 0 && inconclusive.length === 0) {
    return {
      autoApproved: true,
      caseItem: null,
      reason: "All criteria passed verification with grounded citations."
    };
  }

  // Canonical triage routing (docs/agents/triage-labels.md)
  let triageRole: TriageRole = "needs-info";
  if (flagged.length > 0) {
    triageRole = "ready-for-human";
  }

  const caseItem: Case = Object.freeze({
    caseId: `case_${dossier.dossierId}_${caseCounter++}`,
    dossierId: dossier.dossierId,
    vendorId: dossier.vendorId,
    triageRole,
    state: "OPEN",
    flaggedFindingIds: Object.freeze(flagged.map((f) => f.findingId)),
    inconclusiveFindingIds: Object.freeze(inconclusive.map((f) => f.findingId)),
    createdAt: new Date().toISOString()
  });

  return {
    autoApproved: false,
    caseItem,
    reason: `Generated exception case routed to '${triageRole}' (${flagged.length} flagged, ${inconclusive.length} inconclusive).`
  };
}

/**
 * Finite State Machine enforcing strict lifecycle invariants for Case transitions.
 */
export function transitionCase(caseItem: Case, action: CaseAction): Case {
  if (caseItem.state === "RESOLVED") {
    throw new Error("Invalid transition: Cannot mutate a case that is already RESOLVED");
  }

  if (action.type === "CLAIM") {
    if (caseItem.state !== "OPEN") {
      throw new Error(`Invalid transition: Cannot claim a case in state ${caseItem.state}`);
    }

    return Object.freeze({
      ...caseItem,
      state: "IN_REVIEW",
      assignedReviewerId: action.reviewerId
    });
  }

  if (action.type === "RESOLVE") {
    if (caseItem.state !== "IN_REVIEW") {
      throw new Error("Invalid transition: Cannot resolve a case that is not IN_REVIEW");
    }

    return Object.freeze({
      ...caseItem,
      state: "RESOLVED",
      determination: Object.freeze({ ...action.determination })
    });
  }

  throw new Error("Unsupported case action");
}

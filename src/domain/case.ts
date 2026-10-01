export type TriageRole =
  | "ready-for-human"
  | "needs-info"
  | "ready-for-agent"
  | "needs-triage"
  | "wontfix";

export type CaseState = "OPEN" | "IN_REVIEW" | "RESOLVED";

export type DeterminationType =
  | "approved_override"
  | "rejected"
  | "information_requested"
  | "escalated";

export interface Determination {
  readonly determinationId: string;
  readonly type: DeterminationType;
  readonly reviewerId: string;
  readonly decidedAt: string;
  readonly rationale: string;
}

export interface Case {
  readonly caseId: string;
  readonly dossierId: string;
  readonly vendorId: string;
  readonly triageRole: TriageRole;
  readonly state: CaseState;
  readonly flaggedFindingIds: readonly string[];
  readonly inconclusiveFindingIds: readonly string[];
  readonly createdAt: string;
  readonly assignedReviewerId?: string;
  readonly determination?: Determination;
}

export type RoutingOutcome =
  | { readonly autoApproved: true; readonly caseItem: null; readonly reason: string }
  | { readonly autoApproved: false; readonly caseItem: Case; readonly reason: string };

export type CaseAction =
  | { readonly type: "CLAIM"; readonly reviewerId: string; readonly timestamp: string }
  | { readonly type: "RESOLVE"; readonly determination: Determination };

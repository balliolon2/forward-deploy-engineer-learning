import type { Citation } from "../citation/citation-engine.js";

export type CriterionSeverity = "low" | "medium" | "high" | "critical";

export interface Criterion {
  readonly criterionId: string;
  readonly title: string;
  readonly description: string;
  readonly query: string;
  readonly severity: CriterionSeverity;
  readonly minDaysRequired?: number;
}

export interface Policy {
  readonly policyId: string;
  readonly name: string;
  readonly criteria: readonly Criterion[];
}

export type FindingStatus = "pass" | "flagged" | "inconclusive";

export interface Finding {
  readonly findingId: string;
  readonly criterionId: string;
  readonly status: FindingStatus;
  readonly confidence: number;
  readonly reasoning: string;
  readonly citations: readonly Citation[];
  readonly groundingVerified: boolean;
}

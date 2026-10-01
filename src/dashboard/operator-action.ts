import { Case, Determination, DeterminationType } from "../domain/case.js";
import { transitionCase } from "../workflow/case-router.js";
import { AuditEvent, AuditStore } from "../domain/audit.js";
import { Artifact } from "../domain/dossier.js";
import { Citation } from "../domain/policy.js";
import crypto from "node:crypto";

export class InMemoryAuditStore implements AuditStore {
  private readonly events: AuditEvent[] = [];

  append(event: AuditEvent): void {
    const frozenEvent = Object.freeze({ ...event, payload: Object.freeze({ ...event.payload }) });
    this.events.push(frozenEvent);
  }

  getEventsByCase(caseId: string): readonly AuditEvent[] {
    const matched = this.events.filter((e) => e.caseId === caseId);
    return Object.freeze([...matched]);
  }

  getAllEvents(): readonly AuditEvent[] {
    return Object.freeze([...this.events]);
  }
}

export interface DeterminationInput {
  readonly reviewerId: string;
  readonly type: DeterminationType;
  readonly rationale: string;
  readonly timestamp?: string;
}

export interface ExecutionResult {
  readonly resolvedCase: Case;
  readonly auditEvent: AuditEvent;
}

export async function executeDetermination(
  caseItem: Case,
  input: DeterminationInput,
  auditStore?: AuditStore
): Promise<ExecutionResult> {
  if (caseItem.state !== "IN_REVIEW") {
    throw new Error(
      `Cannot resolve Case: must be claimed in IN_REVIEW state first (current state: ${caseItem.state})`
    );
  }

  if (caseItem.assignedReviewerId && caseItem.assignedReviewerId !== input.reviewerId) {
    throw new Error(
      `Unauthorized reviewer: ${input.reviewerId} does not match claimed reviewer ${caseItem.assignedReviewerId}`
    );
  }

  const trimmedRationale = input.rationale ? input.rationale.trim() : "";
  if (!trimmedRationale) {
    throw new Error("Determination requires non-empty justification rationale");
  }

  const timestamp = input.timestamp ?? new Date().toISOString();
  const determinationId = `det_${crypto.randomBytes(6).toString("hex")}`;

  const determination: Determination = {
    determinationId,
    type: input.type,
    reviewerId: input.reviewerId,
    decidedAt: timestamp,
    rationale: trimmedRationale,
  };

  const resolvedCase = transitionCase(caseItem, {
    type: "RESOLVE",
    determination,
  });

  const auditEvent: AuditEvent = {
    eventId: `ev_${crypto.randomBytes(6).toString("hex")}`,
    timestamp,
    eventType: "DETERMINATION_RECORDED",
    actorId: input.reviewerId,
    dossierId: caseItem.dossierId,
    caseId: caseItem.caseId,
    payload: {
      determinationId,
      determinationType: input.type,
      rationale: trimmedRationale,
      previousState: caseItem.state,
      newState: resolvedCase.state,
    },
  };

  if (auditStore) {
    await auditStore.append(auditEvent);
  }

  return {
    resolvedCase,
    auditEvent,
  };
}

export interface EvidenceViewContext {
  readonly found: boolean;
  readonly pageNumber: number;
  readonly charOffsetStart: number;
  readonly charOffsetEnd: number;
  readonly exactQuote: string;
  readonly surroundingText: string;
}

export function inspectEvidenceContext(
  artifact: Artifact,
  pageNumber: number,
  citation: Citation
): EvidenceViewContext {
  const page = artifact.pages.find((p) => p.pageNumber === pageNumber);
  if (!page) {
    return {
      found: false,
      pageNumber,
      charOffsetStart: -1,
      charOffsetEnd: -1,
      exactQuote: citation.exactQuote,
      surroundingText: "",
    };
  }

  const offset = page.text.indexOf(citation.exactQuote);
  if (offset === -1) {
    return {
      found: false,
      pageNumber,
      charOffsetStart: -1,
      charOffsetEnd: -1,
      exactQuote: citation.exactQuote,
      surroundingText: page.text,
    };
  }

  // Extract snippet window around quote
  const contextPadding = 50;
  const start = Math.max(0, offset - contextPadding);
  const end = Math.min(page.text.length, offset + citation.exactQuote.length + contextPadding);
  const surroundingText = page.text.slice(start, end);

  return {
    found: true,
    pageNumber,
    charOffsetStart: offset,
    charOffsetEnd: offset + citation.exactQuote.length,
    exactQuote: citation.exactQuote,
    surroundingText,
  };
}

import { describe, it, expect } from "vitest";
import type { Dossier } from "../domain/dossier.js";
import type { Finding } from "../domain/policy.js";
import type { Determination } from "../domain/case.js";
import { routeDossierFindings, transitionCase } from "./case-router.js";

describe("CaseRouter & State Machine (Seam)", () => {
  const sampleDossier: Dossier = {
    dossierId: "dos_workflow_01",
    vendorId: "vnd_acme",
    submittedAt: "2026-10-01T12:00:00.000Z",
    artifacts: []
  };

  describe("routeDossierFindings (Exception-Based Routing)", () => {
    it("auto-approves dossier and bypasses case creation when all findings pass", () => {
      const allPassFindings: Finding[] = [
        {
          findingId: "fnd_01",
          criterionId: "crit_01",
          status: "pass",
          confidence: 0.95,
          reasoning: "Log retention conforms to standard.",
          citations: [],
          groundingVerified: true
        }
      ];

      const outcome = routeDossierFindings(sampleDossier, allPassFindings);

      expect(outcome.autoApproved).toBe(true);
      expect(outcome.caseItem).toBeNull();
      expect(outcome.reason).toContain("All criteria passed");
    });

    it("generates a Case with 'ready-for-human' when a flagged finding exists", () => {
      const flaggedFindings: Finding[] = [
        {
          findingId: "fnd_flagged_01",
          criterionId: "crit_retention",
          status: "flagged",
          confidence: 0.95,
          reasoning: "Retention of 60 days breaches 180 day policy.",
          citations: [],
          groundingVerified: true
        }
      ];

      const outcome = routeDossierFindings(sampleDossier, flaggedFindings);

      expect(outcome.autoApproved).toBe(false);
      expect(outcome.caseItem).not.toBeNull();
      if (!outcome.caseItem) return;

      expect(outcome.caseItem.triageRole).toBe("ready-for-human");
      expect(outcome.caseItem.state).toBe("OPEN");
      expect(outcome.caseItem.dossierId).toBe("dos_workflow_01");
      expect(outcome.caseItem.flaggedFindingIds).toContain("fnd_flagged_01");
    });

    it("generates a Case with 'needs-info' when findings are inconclusive without breach", () => {
      const inconclusiveFindings: Finding[] = [
        {
          findingId: "fnd_inconclusive_01",
          criterionId: "crit_iso",
          status: "inconclusive",
          confidence: 0.5,
          reasoning: "ISO certificate document missing from dossier.",
          citations: [],
          groundingVerified: true
        }
      ];

      const outcome = routeDossierFindings(sampleDossier, inconclusiveFindings);

      expect(outcome.autoApproved).toBe(false);
      expect(outcome.caseItem).not.toBeNull();
      if (!outcome.caseItem) return;

      expect(outcome.caseItem.triageRole).toBe("needs-info");
      expect(outcome.caseItem.inconclusiveFindingIds).toContain("fnd_inconclusive_01");
    });
  });

  describe("transitionCase (State Machine Lifecycle)", () => {
    it("transitions an OPEN case to IN_REVIEW when claimed by a Reviewer", () => {
      const openCase = {
        caseId: "case_001",
        dossierId: "dos_01",
        vendorId: "vnd_01",
        triageRole: "ready-for-human" as const,
        state: "OPEN" as const,
        flaggedFindingIds: ["fnd_01"],
        inconclusiveFindingIds: [],
        createdAt: "2026-10-01T12:00:00.000Z"
      };

      const inReviewCase = transitionCase(openCase, {
        type: "CLAIM",
        reviewerId: "rev_alice",
        timestamp: "2026-10-01T12:30:00.000Z"
      });

      expect(inReviewCase.state).toBe("IN_REVIEW");
      expect(inReviewCase.assignedReviewerId).toBe("rev_alice");
    });

    it("transitions an IN_REVIEW case to RESOLVED when stamped with an official Determination", () => {
      const inReviewCase = {
        caseId: "case_001",
        dossierId: "dos_01",
        vendorId: "vnd_01",
        triageRole: "ready-for-human" as const,
        state: "IN_REVIEW" as const,
        assignedReviewerId: "rev_alice",
        flaggedFindingIds: ["fnd_01"],
        inconclusiveFindingIds: [],
        createdAt: "2026-10-01T12:00:00.000Z"
      };

      const determination: Determination = {
        determinationId: "det_001",
        type: "approved_override",
        reviewerId: "rev_alice",
        decidedAt: "2026-10-01T13:00:00.000Z",
        rationale: "Approved with executive exception granted by CISO."
      };

      const resolvedCase = transitionCase(inReviewCase, {
        type: "RESOLVE",
        determination
      });

      expect(resolvedCase.state).toBe("RESOLVED");
      expect(resolvedCase.determination).toEqual(determination);
    });

    it("rejects invalid state transitions (e.g. attempting to resolve an OPEN case or mutating RESOLVED case)", () => {
      const openCase = {
        caseId: "case_001",
        dossierId: "dos_01",
        vendorId: "vnd_01",
        triageRole: "ready-for-human" as const,
        state: "OPEN" as const,
        flaggedFindingIds: ["fnd_01"],
        inconclusiveFindingIds: [],
        createdAt: "2026-10-01T12:00:00.000Z"
      };

      const determination: Determination = {
        determinationId: "det_001",
        type: "rejected",
        reviewerId: "rev_alice",
        decidedAt: "2026-10-01T13:00:00.000Z",
        rationale: "Cannot comply with minimum security standards."
      };

      // Resolving directly from OPEN without claiming must fail!
      expect(() =>
        transitionCase(openCase, {
          type: "RESOLVE",
          determination
        })
      ).toThrowError("Invalid transition: Cannot resolve a case that is not IN_REVIEW");
    });
  });
});

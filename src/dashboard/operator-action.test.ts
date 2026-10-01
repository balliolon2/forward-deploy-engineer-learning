import { describe, it, expect, beforeEach } from "vitest";
import { Case, Determination } from "../domain/case.js";
import {
  executeDetermination,
  InMemoryAuditStore,
  inspectEvidenceContext,
} from "./operator-action.js";
import { Artifact } from "../domain/dossier.js";
import { Citation } from "../domain/policy.js";

describe("Stage 06: Operator Action Dashboard & Tamper-Proof Audit Trail", () => {
  let auditStore: InMemoryAuditStore;

  const mockOpenCase: Case = {
    caseId: "case_vendor_999",
    dossierId: "dos_fintech_01",
    vendorId: "acme-corp",
    triageRole: "ready-for-human",
    state: "OPEN",
    flaggedFindingIds: ["find_breach_01"],
    inconclusiveFindingIds: [],
    createdAt: "2026-10-01T10:00:00.000Z",
  };

  const mockClaimedCase: Case = {
    ...mockOpenCase,
    state: "IN_REVIEW",
    assignedReviewerId: "rev_sarah_ciso",
  };

  const mockArtifact: Artifact = {
    artifactId: "art_contract_sla",
    filename: "master-sla-agreement.pdf",
    pages: [
      {
        pageNumber: 1,
        text: "Section 1: General definitions of services provided.",
      },
      {
        pageNumber: 2,
        text: "Section 2.4 Data Retention: The vendor shall store and retain customer audit logs for a minimum of 60 days.",
      },
    ],
    contentHash: "a1b2c3d4e5f67890123456789012345678901234567890123456789012345678",
  };

  beforeEach(() => {
    auditStore = new InMemoryAuditStore();
  });

  describe("executeDetermination (Seam)", () => {
    it("successfully records determination, transitions state to RESOLVED, and emits AuditEvent", async () => {
      const result = await executeDetermination(
        mockClaimedCase,
        {
          reviewerId: "rev_sarah_ciso",
          type: "approved_override",
          rationale: "CISO executive exception granted due to secondary cloud logging backup.",
          timestamp: "2026-10-01T14:30:00.000Z",
        },
        auditStore
      );

      // Verify Case State transition
      expect(result.resolvedCase.state).toBe("RESOLVED");
      expect(result.resolvedCase.determination).toBeDefined();
      expect(result.resolvedCase.determination?.type).toBe("approved_override");
      expect(result.resolvedCase.determination?.reviewerId).toBe("rev_sarah_ciso");
      expect(result.resolvedCase.determination?.rationale).toContain("secondary cloud logging");

      // Verify Audit Event
      expect(result.auditEvent.eventType).toBe("DETERMINATION_RECORDED");
      expect(result.auditEvent.actorId).toBe("rev_sarah_ciso");
      expect(result.auditEvent.caseId).toBe("case_vendor_999");
      expect(result.auditEvent.dossierId).toBe("dos_fintech_01");

      // Verify Audit Store persisted event
      const storedEvents = await auditStore.getEventsByCase("case_vendor_999");
      expect(storedEvents).toHaveLength(1);
      expect(storedEvents[0].eventId).toBe(result.auditEvent.eventId);
    });

    it("throws error when trying to resolve an unclaimed OPEN case", async () => {
      await expect(() =>
        executeDetermination(
          mockOpenCase,
          {
            reviewerId: "rev_sarah_ciso",
            type: "rejected",
            rationale: "Standard policy failure.",
          },
          auditStore
        )
      ).rejects.toThrow("Cannot resolve Case: must be claimed in IN_REVIEW state first");
    });

    it("throws error when reviewerId does not match assigned reviewer", async () => {
      await expect(() =>
        executeDetermination(
          mockClaimedCase,
          {
            reviewerId: "rev_intruder_bob",
            type: "approved_override",
            rationale: "Unverified override attempt.",
          },
          auditStore
        )
      ).rejects.toThrow("Unauthorized reviewer: rev_intruder_bob does not match claimed reviewer rev_sarah_ciso");
    });

    it("throws error when rationale is empty or insufficient", async () => {
      await expect(() =>
        executeDetermination(
          mockClaimedCase,
          {
            reviewerId: "rev_sarah_ciso",
            type: "approved_override",
            rationale: "   ",
          },
          auditStore
        )
      ).rejects.toThrow("Determination requires non-empty justification rationale");
    });
  });

  describe("AuditStore & Tamper-Proof Audit Trail", () => {
    it("maintains an append-only timeline and returns immutable event records", async () => {
      await auditStore.append({
        eventId: "ev_01",
        timestamp: "2026-10-01T10:00:00.000Z",
        eventType: "CASE_CREATED",
        actorId: "SYSTEM",
        dossierId: "dos_fintech_01",
        caseId: "case_vendor_999",
        payload: { initialRole: "ready-for-human" },
      });

      await auditStore.append({
        eventId: "ev_02",
        timestamp: "2026-10-01T11:00:00.000Z",
        eventType: "CASE_CLAIMED",
        actorId: "rev_sarah_ciso",
        dossierId: "dos_fintech_01",
        caseId: "case_vendor_999",
        payload: { assignedTo: "rev_sarah_ciso" },
      });

      const events = await auditStore.getEventsByCase("case_vendor_999");
      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe("CASE_CREATED");
      expect(events[1].eventType).toBe("CASE_CLAIMED");

      // Verify immutability
      expect(() => {
        (events as any)[0] = null;
      }).toThrow();
    });
  });

  describe("Split-Screen Evidence Deep-Linking (inspectEvidenceContext)", () => {
    it("locates citation verbatim quote within page and returns offset coordinates", () => {
      const citation: Citation = {
        artifactId: "art_contract_sla",
        pageNumber: 2,
        exactQuote: "minimum of 60 days",
      };

      const viewContext = inspectEvidenceContext(mockArtifact, 2, citation);

      expect(viewContext.found).toBe(true);
      expect(viewContext.pageNumber).toBe(2);
      expect(viewContext.charOffsetStart).toBeGreaterThanOrEqual(0);
      expect(viewContext.exactQuote).toBe("minimum of 60 days");
      expect(viewContext.surroundingText).toContain("retain customer audit logs for a minimum of 60 days");
    });

    it("returns found false when quote does not exist on page", () => {
      const badCitation: Citation = {
        artifactId: "art_contract_sla",
        pageNumber: 2,
        exactQuote: "retention period of 365 days", // not in mockArtifact page 2
      };

      const viewContext = inspectEvidenceContext(mockArtifact, 2, badCitation);
      expect(viewContext.found).toBe(false);
      expect(viewContext.charOffsetStart).toBe(-1);
    });
  });
});

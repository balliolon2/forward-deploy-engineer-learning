import { describe, it, expect } from "vitest";
import { ingestDossier } from "../ingestion/ingest-dossier.js";
import { createCitationEngine } from "../citation/citation-engine.js";
import type { Policy } from "../domain/policy.js";
import { evaluateCompliance } from "./evaluate-compliance.js";

describe("evaluateCompliance (Seam)", () => {
  const samplePayload = {
    dossierId: "dos_comp_01",
    vendorId: "vnd_acme",
    submittedAt: "2026-10-01T12:00:00.000Z",
    artifacts: [
      {
        artifactId: "art_msa",
        name: "Master Services Agreement.pdf",
        type: "contract" as const,
        pages: [
          {
            pageNumber: 1,
            text: "General Provisions and Service Scope."
          },
          {
            pageNumber: 2,
            text: "Section 5.2: Vendor must retain all security audit logs for exactly 365 days from creation."
          }
        ]
      }
    ]
  };

  const ingestion = ingestDossier(samplePayload);
  if (!ingestion.success) throw new Error("Setup failed");
  const dossier = ingestion.data;
  const engine = createCitationEngine(dossier);

  const samplePolicy: Policy = {
    policyId: "pol_security_01",
    name: "Vendor Data Security Policy",
    criteria: [
      {
        criterionId: "crit_log_retention",
        title: "Audit Log Retention Minimum",
        description: "Vendor must retain security audit logs for at least 180 days.",
        query: "security audit logs retain days",
        severity: "high"
      }
    ]
  };

  it("produces a verified 'pass' finding when compliant evidence is found and grounded", async () => {
    const findings = await evaluateCompliance(dossier, samplePolicy, engine);

    expect(findings).toHaveLength(1);
    const finding = findings[0];

    expect(finding.criterionId).toBe("crit_log_retention");
    expect(finding.status).toBe("pass");
    expect(finding.confidence).toBeGreaterThan(0.7);
    expect(finding.groundingVerified).toBe(true);
    expect(finding.citations).toHaveLength(1);

    const citation = finding.citations[0];
    expect(citation.artifactId).toBe("art_msa");
    expect(citation.pageNumber).toBe(2);
    expect(citation.exactQuote).toContain("365 days");

    // Re-verify that the engine confirms this exact quote is valid
    const verification = engine.verifyCitation(citation);
    expect(verification.valid).toBe(true);
  });

  it("produces a verified 'flagged' finding when document explicitly breaches policy threshold", async () => {
    const breachPayload = {
      dossierId: "dos_breach_02",
      vendorId: "vnd_bad",
      submittedAt: "2026-10-01T12:00:00.000Z",
      artifacts: [
        {
          artifactId: "art_short_sla",
          name: "SLA Document.pdf",
          type: "sla" as const,
          pages: [
            {
              pageNumber: 1,
              text: "Data Policy: Vendor will purge all audit logs after 60 days."
            }
          ]
        }
      ]
    };

    const breachIngest = ingestDossier(breachPayload);
    if (!breachIngest.success) throw new Error("Setup failed");
    const breachDossier = breachIngest.data;
    const breachEngine = createCitationEngine(breachDossier);

    const findings = await evaluateCompliance(breachDossier, samplePolicy, breachEngine);

    expect(findings).toHaveLength(1);
    const finding = findings[0];

    expect(finding.status).toBe("flagged");
    expect(finding.groundingVerified).toBe(true);
    expect(finding.reasoning).toContain("breaches minimum policy requirement");
    expect(finding.citations[0].exactQuote).toContain("60 days");
  });

  it("downgrades finding to 'inconclusive' when an evaluator produces a hallucinated citation (Grounding Gate)", async () => {
    // Simulate a rogue / hallucinating evaluator client
    const hallucinatingEvaluator = {
      evaluate: () => ({
        status: "pass" as const,
        confidence: 0.99,
        reasoning: "Vendor explicitly guarantees 500 days retention.",
        citations: [
          {
            artifactId: "art_msa",
            pageNumber: 2,
            exactQuote: "Vendor explicitly guarantees 500 days retention." // Hallucinated quote!
          }
        ]
      })
    };

    const findings = await evaluateCompliance(dossier, samplePolicy, engine, hallucinatingEvaluator);

    expect(findings).toHaveLength(1);
    const finding = findings[0];

    // The Grounding Gate must NOT allow a pass when citation verification fails!
    expect(finding.status).toBe("inconclusive");
    expect(finding.groundingVerified).toBe(false);
    expect(finding.reasoning).toContain("Grounding violation");
  });
});

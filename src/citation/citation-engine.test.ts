import { describe, it, expect } from "vitest";
import { ingestDossier } from "../ingestion/ingest-dossier.js";
import { createCitationEngine } from "./citation-engine.js";

describe("CitationEngine (Seam)", () => {
  const samplePayload = {
    dossierId: "dos_audit_01",
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
            text: "Section 1: Definitions. Agreement means this document."
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
  if (!ingestion.success) throw new Error("Setup failed: Ingestion was unsuccessful");
  const dossier = ingestion.data;

  describe("verifyCitation (Strict Verbatim Grounding)", () => {
    it("validates a citation that matches the exact text in the specific page", () => {
      const engine = createCitationEngine(dossier);

      const validCitation = {
        artifactId: "art_msa",
        pageNumber: 2,
        exactQuote: "Vendor must retain all security audit logs for exactly 365 days"
      };

      const result = engine.verifyCitation(validCitation);

      expect(result.valid).toBe(true);
      expect(result.matchedOffset).toBeGreaterThanOrEqual(0);
    });

    it("rejects a hallucinated or paraphrased quote not found verbatim in page text", () => {
      const engine = createCitationEngine(dossier);

      const paraphrasedCitation = {
        artifactId: "art_msa",
        pageNumber: 2,
        exactQuote: "Vendor shall keep security logs for one year" // Paraphrased by LLM
      };

      const result = engine.verifyCitation(paraphrasedCitation);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Quote not found");
    });

    it("rejects a citation referencing a page or artifact that does not exist", () => {
      const engine = createCitationEngine(dossier);

      const nonExistentPageCitation = {
        artifactId: "art_msa",
        pageNumber: 99,
        exactQuote: "Section 1: Definitions"
      };

      const result = engine.verifyCitation(nonExistentPageCitation);

      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Page not found");
    });
  });

  describe("retrieve (Page-Bounded Hybrid Retrieval)", () => {
    it("retrieves the most relevant page-bounded chunk for a query", () => {
      const engine = createCitationEngine(dossier);

      const results = engine.retrieve("security audit logs 365 days", { topK: 1 });

      expect(results).toHaveLength(1);
      const topResult = results[0];
      expect(topResult.artifactId).toBe("art_msa");
      expect(topResult.pageNumber).toBe(2);
      expect(topResult.text).toContain("365 days");
      expect(topResult.score).toBeGreaterThan(0);
    });

    it("ranks exact regulatory acronym matches (e.g. ISO 27001) from the correct artifact", () => {
      const multiArtifactPayload = {
        dossierId: "dos_multi_01",
        vendorId: "vnd_acme",
        submittedAt: "2026-10-01T12:00:00.000Z",
        artifacts: [
          {
            artifactId: "art_msa",
            name: "Master Agreement.pdf",
            type: "contract" as const,
            pages: [
              {
                pageNumber: 1,
                text: "General security commitments apply to all vendor systems."
              }
            ]
          },
          {
            artifactId: "art_iso_cert",
            name: "ISO Certification.pdf",
            type: "certification" as const,
            pages: [
              {
                pageNumber: 1,
                text: "Certificate of Registration: Vendor conforms to ISO 27001 standards. Valid through 2028."
              }
            ]
          }
        ]
      };

      const multiIngest = ingestDossier(multiArtifactPayload);
      if (!multiIngest.success) throw new Error("Setup failed");

      const engine = createCitationEngine(multiIngest.data);
      const results = engine.retrieve("ISO 27001 certification standards", { topK: 1 });

      expect(results).toHaveLength(1);
      expect(results[0].artifactId).toBe("art_iso_cert");
      expect(results[0].pageNumber).toBe(1);
      expect(results[0].text).toContain("ISO 27001");
    });
  });
});

import { describe, it, expect } from "vitest";
import { ingestDossier } from "./ingest-dossier.js";

describe("ingestDossier (Seam)", () => {
  it("successfully ingests a valid raw payload into an immutable Dossier with page hashes", () => {
    const rawPayload = {
      dossierId: "dos_12345",
      vendorId: "vnd_98765",
      submittedAt: "2026-10-01T12:00:00.000Z",
      artifacts: [
        {
          artifactId: "art_001",
          name: "Master Services Agreement.pdf",
          type: "contract",
          pages: [
            {
              pageNumber: 1,
              text: "Section 1: Data retention period shall be 180 days."
            }
          ]
        }
      ]
    };

    const result = ingestDossier(rawPayload);

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.dossierId).toBe("dos_12345");
    expect(result.data.vendorId).toBe("vnd_98765");
    expect(result.data.artifacts).toHaveLength(1);

    const artifact = result.data.artifacts[0];
    expect(artifact.artifactId).toBe("art_001");
    expect(artifact.pages).toHaveLength(1);
    expect(artifact.pages[0].pageNumber).toBe(1);
    expect(artifact.pages[0].text).toBe("Section 1: Data retention period shall be 180 days.");
    // Hash should be 64-character SHA-256 hex string
    expect(artifact.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects payload when artifacts array is empty", () => {
    const emptyArtifactsPayload = {
      dossierId: "dos_empty",
      vendorId: "vnd_98765",
      submittedAt: "2026-10-01T12:00:00.000Z",
      artifacts: []
    };

    const result = ingestDossier(emptyArtifactsPayload);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toBe("Invalid dossier payload format");
  });

  it("normalizes irregular whitespace across page texts for reproducible provenance", () => {
    const rawPayload = {
      dossierId: "dos_messy",
      vendorId: "vnd_98765",
      submittedAt: "2026-10-01T12:00:00.000Z",
      artifacts: [
        {
          artifactId: "art_messy",
          name: "Security Addendum.pdf",
          type: "contract",
          pages: [
            {
              pageNumber: 1,
              text: "   Clause 5.1:    Vendor must retain audit logs for \r\n 365 days.   "
            }
          ]
        }
      ]
    };

    const result = ingestDossier(rawPayload);

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.artifacts[0].pages[0].text).toBe(
      "Clause 5.1: Vendor must retain audit logs for 365 days."
    );
  });
});

import { createHash } from "node:crypto";
import { z } from "zod";
import type { Dossier, IngestionResult } from "../domain/dossier.js";

const PageSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string().min(1)
});

const ArtifactInputSchema = z.object({
  artifactId: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["contract", "certification", "sla", "policy", "other"]),
  pages: z.array(PageSchema).min(1)
});

const DossierInputSchema = z.object({
  dossierId: z.string().min(1),
  vendorId: z.string().min(1),
  submittedAt: z.string().datetime(),
  artifacts: z.array(ArtifactInputSchema).min(1)
});

export function ingestDossier(rawPayload: unknown): IngestionResult {
  const parseResult = DossierInputSchema.safeParse(rawPayload);

  if (!parseResult.success) {
    return {
      success: false,
      error: "Invalid dossier payload format",
      details: parseResult.error.issues
    };
  }

  const { dossierId, vendorId, submittedAt, artifacts } = parseResult.data;

  const processedArtifacts = artifacts.map((art) => {
    // Clean and normalize page text (collapse irregular whitespaces and linebreaks)
    const normalizedPages = art.pages.map((p) => ({
      pageNumber: p.pageNumber,
      text: p.text.replace(/\s+/g, " ").trim()
    }));

    // Deterministic content hash from ordered normalized page texts
    const hasher = createHash("sha256");
    for (const page of normalizedPages) {
      hasher.update(`[page:${page.pageNumber}]${page.text}`);
    }
    const contentHash = hasher.digest("hex");

    return {
      artifactId: art.artifactId,
      name: art.name,
      type: art.type,
      pages: Object.freeze(normalizedPages.map((p) => Object.freeze({ ...p }))),
      contentHash
    };
  });

  const dossier: Dossier = Object.freeze({
    dossierId,
    vendorId,
    submittedAt,
    artifacts: Object.freeze(processedArtifacts)
  });

  return {
    success: true,
    data: dossier
  };
}

export interface Page {
  readonly pageNumber: number;
  readonly text: string;
}

export type ArtifactType = "contract" | "certification" | "sla" | "policy" | "other";

export interface Artifact {
  readonly artifactId: string;
  readonly name: string;
  readonly type: ArtifactType;
  readonly pages: readonly Page[];
  readonly contentHash: string; // SHA-256 hex
}

export interface Dossier {
  readonly dossierId: string;
  readonly vendorId: string;
  readonly submittedAt: string;
  readonly artifacts: readonly Artifact[];
}

export type IngestionResult =
  | { readonly success: true; readonly data: Dossier }
  | { readonly success: false; readonly error: string; readonly details?: unknown };

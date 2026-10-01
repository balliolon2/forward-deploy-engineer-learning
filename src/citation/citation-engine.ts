import type { Dossier } from "../domain/dossier.js";

export interface Citation {
  readonly artifactId: string;
  readonly pageNumber: number;
  readonly exactQuote: string;
}

export interface VerificationResult {
  readonly valid: boolean;
  readonly matchedOffset?: number;
  readonly reason?: string;
}

export interface RetrievedChunk {
  readonly artifactId: string;
  readonly pageNumber: number;
  readonly chunkIndex: number;
  readonly text: string;
  readonly score: number;
}

export interface CitationEngine {
  retrieve(query: string, options?: { topK?: number }): readonly RetrievedChunk[];
  verifyCitation(citation: Citation): VerificationResult;
}

interface InternalChunk {
  readonly artifactId: string;
  readonly pageNumber: number;
  readonly chunkIndex: number;
  readonly text: string;
  readonly tokens: readonly string[];
  readonly termFrequencies: Map<string, number>;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

export function createCitationEngine(dossier: Dossier): CitationEngine {
  // 1. Build fast immutable lookup for pages by artifactId and pageNumber
  const pageMap = new Map<string, Map<number, string>>();
  const allChunks: InternalChunk[] = [];

  for (const artifact of dossier.artifacts) {
    const pagesForArtifact = new Map<number, string>();
    for (const page of artifact.pages) {
      pagesForArtifact.set(page.pageNumber, page.text);

      // 2. Generate Page-Bounded Chunks (Never crossing page boundaries)
      // Split by sentence boundaries, or fallback to single text if short
      const sentenceRegex = /[^.!?]+[.!?]+|\S+/g;
      const sentences = page.text.match(sentenceRegex) ?? [page.text];

      let chunkIdx = 0;
      let currentChunkText = "";

      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (!trimmed) continue;

        if (currentChunkText.length + trimmed.length > 300 && currentChunkText.length > 0) {
          const tokens = tokenize(currentChunkText);
          const tfMap = new Map<string, number>();
          for (const tok of tokens) {
            tfMap.set(tok, (tfMap.get(tok) ?? 0) + 1);
          }

          allChunks.push({
            artifactId: artifact.artifactId,
            pageNumber: page.pageNumber,
            chunkIndex: chunkIdx++,
            text: currentChunkText,
            tokens,
            termFrequencies: tfMap
          });

          currentChunkText = trimmed;
        } else {
          currentChunkText = currentChunkText ? `${currentChunkText} ${trimmed}` : trimmed;
        }
      }

      if (currentChunkText.length > 0) {
        const tokens = tokenize(currentChunkText);
        const tfMap = new Map<string, number>();
        for (const tok of tokens) {
          tfMap.set(tok, (tfMap.get(tok) ?? 0) + 1);
        }

        allChunks.push({
          artifactId: artifact.artifactId,
          pageNumber: page.pageNumber,
          chunkIndex: chunkIdx++,
          text: currentChunkText,
          tokens,
          termFrequencies: tfMap
        });
      }
    }
    pageMap.set(artifact.artifactId, pagesForArtifact);
  }

  // Precompute document frequencies for BM25
  const docFrequency = new Map<string, number>();
  let totalLength = 0;

  for (const chunk of allChunks) {
    totalLength += chunk.tokens.length;
    const uniqueTokens = new Set(chunk.tokens);
    for (const token of uniqueTokens) {
      docFrequency.set(token, (docFrequency.get(token) ?? 0) + 1);
    }
  }

  const N = allChunks.length;
  const avgDocLength = N > 0 ? totalLength / N : 1;
  const k1 = 1.2;
  const b = 0.75;

  return {
    verifyCitation(citation: Citation): VerificationResult {
      const artifactPages = pageMap.get(citation.artifactId);
      if (!artifactPages) {
        return {
          valid: false,
          reason: `Artifact not found: ${citation.artifactId}`
        };
      }

      const pageText = artifactPages.get(citation.pageNumber);
      if (pageText === undefined) {
        return {
          valid: false,
          reason: `Page not found: ${citation.pageNumber} in artifact ${citation.artifactId}`
        };
      }

      const offset = pageText.indexOf(citation.exactQuote);
      if (offset === -1) {
        return {
          valid: false,
          reason: "Quote not found in specified page text"
        };
      }

      return {
        valid: true,
        matchedOffset: offset
      };
    },

    retrieve(query: string, options?: { topK?: number }): readonly RetrievedChunk[] {
      const topK = options?.topK ?? 3;
      const queryTokens = tokenize(query);

      if (queryTokens.length === 0 || allChunks.length === 0) {
        return [];
      }

      const scoredChunks: RetrievedChunk[] = [];

      for (const chunk of allChunks) {
        let bm25Score = 0;
        const docLen = chunk.tokens.length;

        for (const qToken of queryTokens) {
          const tf = chunk.termFrequencies.get(qToken) ?? 0;
          if (tf === 0) continue;

          const df = docFrequency.get(qToken) ?? 0;
          const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
          const num = tf * (k1 + 1);
          const denom = tf + k1 * (1 - b + b * (docLen / avgDocLength));

          bm25Score += idf * (num / denom);
        }

        if (bm25Score > 0) {
          scoredChunks.push({
            artifactId: chunk.artifactId,
            pageNumber: chunk.pageNumber,
            chunkIndex: chunk.chunkIndex,
            text: chunk.text,
            score: Number(bm25Score.toFixed(4))
          });
        }
      }

      // Sort descending by score
      scoredChunks.sort((a, b) => b.score - a.score);

      return scoredChunks.slice(0, topK);
    }
  };
}

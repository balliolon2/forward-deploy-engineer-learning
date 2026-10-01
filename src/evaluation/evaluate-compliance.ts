import type { Dossier } from "../domain/dossier.js";
import type { Citation, CitationEngine, RetrievedChunk } from "../citation/citation-engine.js";
import type { Criterion, Finding, FindingStatus, Policy } from "../domain/policy.js";

export interface FindingProposal {
  readonly status: FindingStatus;
  readonly confidence: number;
  readonly reasoning: string;
  readonly citations: readonly Citation[];
}

export interface CriterionEvaluator {
  evaluate(
    criterion: Criterion,
    retrievedChunks: readonly RetrievedChunk[]
  ): Promise<FindingProposal> | FindingProposal;
}

/**
 * Built-in Rule & Pattern Evaluator for deterministic compliance assessment.
 */
class DefaultRuleEvaluator implements CriterionEvaluator {
  evaluate(criterion: Criterion, retrievedChunks: readonly RetrievedChunk[]): FindingProposal {
    if (retrievedChunks.length === 0) {
      return {
        status: "inconclusive",
        confidence: 0.9,
        reasoning: `No evidence found matching query: "${criterion.query}"`,
        citations: []
      };
    }

    const topChunk = retrievedChunks[0];
    const text = topChunk.text;

    // Check for day numbers in retention rules
    const daysMatch = text.match(/(\d+)\s*days/i);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      const minRequired = criterion.minDaysRequired ?? 180;

      // Extract a tight exact quote around the retention statement
      const sentenceMatch = text.match(/([^.!?]*\d+\s*days[^.!?]*[.!?]?)/i);
      const exactQuote = sentenceMatch ? sentenceMatch[1].trim() : daysMatch[0];

      const citation: Citation = {
        artifactId: topChunk.artifactId,
        pageNumber: topChunk.pageNumber,
        exactQuote
      };

      if (days >= minRequired) {
        return {
          status: "pass",
          confidence: 0.95,
          reasoning: `Vendor commitment of ${days} days satisfies minimum requirement of ${minRequired} days.`,
          citations: [citation]
        };
      } else {
        return {
          status: "flagged",
          confidence: 0.95,
          reasoning: `Vendor commitment of ${days} days breaches minimum policy requirement of ${minRequired} days.`,
          citations: [citation]
        };
      }
    }

    // Fallback: chunk found but no numerical match
    return {
      status: "inconclusive",
      confidence: 0.6,
      reasoning: "Relevant document found but exact numerical compliance could not be verified automatically.",
      citations: [
        {
          artifactId: topChunk.artifactId,
          pageNumber: topChunk.pageNumber,
          exactQuote: topChunk.text.slice(0, 80)
        }
      ]
    };
  }
}

export async function evaluateCompliance(
  _dossier: Dossier,
  policy: Policy,
  engine: CitationEngine,
  evaluator?: CriterionEvaluator
): Promise<readonly Finding[]> {
  const activeEvaluator = evaluator ?? new DefaultRuleEvaluator();
  const findings: Finding[] = [];

  for (let i = 0; i < policy.criteria.length; i++) {
    const criterion = policy.criteria[i];
    const retrievedChunks = engine.retrieve(criterion.query, { topK: 3 });

    const proposal = await activeEvaluator.evaluate(criterion, retrievedChunks);

    // Mandatory Grounding Gatekeeper (ADR-0003)
    let allCitationsGrounded = proposal.citations.length > 0;
    const failedCitations: string[] = [];

    for (const citation of proposal.citations) {
      const verification = engine.verifyCitation(citation);
      if (!verification.valid) {
        allCitationsGrounded = false;
        failedCitations.push(verification.reason ?? "Quote not found on page");
      }
    }

    let finalStatus = proposal.status;
    let finalReasoning = proposal.reasoning;

    // If an evaluator claimed pass/flagged but citations failed verification:
    if (!allCitationsGrounded && proposal.citations.length > 0) {
      finalStatus = "inconclusive";
      finalReasoning = `${proposal.reasoning} [Grounding violation: citation failed verification - ${failedCitations.join("; ")}]`;
    }

    findings.push({
      findingId: `fnd_${criterion.criterionId}_${i + 1}`,
      criterionId: criterion.criterionId,
      status: finalStatus,
      confidence: proposal.confidence,
      reasoning: finalReasoning,
      citations: proposal.citations,
      groundingVerified: allCitationsGrounded
    });
  }

  return Object.freeze(findings);
}

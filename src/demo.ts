import { ingestDossier } from "./ingestion/ingest-dossier.js";
import { createCitationEngine } from "./citation/citation-engine.js";
import { evaluateCompliance } from "./evaluation/evaluate-compliance.js";
import { routeDossierFindings, transitionCase } from "./workflow/case-router.js";
import {
  executeDetermination,
  InMemoryAuditStore,
  inspectEvidenceContext,
} from "./dashboard/operator-action.js";
import { Policy } from "./domain/policy.js";

async function runEndToEndDemo() {
  console.log("================================================================================");
  console.log(" 🚀 DocuAudit: Enterprise AI & Vendor Compliance - End-to-End Pipeline Demo");
  console.log("================================================================================\n");

  // -------------------------------------------------------------------------
  // STAGE 02: Ingestion Pipeline & Document Normalization
  // -------------------------------------------------------------------------
  console.log("📦 [STAGE 02] Ingesting Vendor Contract Dossier with Cryptographic Provenance...");
  const rawPayload = {
    dossierId: "dos_demo_fintech",
    vendorId: "acme-cloud-services",
    submittedAt: "2026-10-01T10:00:00.000Z",
    artifacts: [
      {
        artifactId: "art_msa_2026",
        name: "Master Services Agreement",
        type: "contract" as const,
        pages: [
          {
            pageNumber: 1,
            text: "Article 1. Scope: Cloud hosting infrastructure and database services.",
          },
          {
            pageNumber: 2,
            text: "Article 4.3 Data Retention: Vendor retains customer security audit logs for a minimum of 60 days.",
          },
        ],
      },
    ],
  };

  const ingestionResult = ingestDossier(rawPayload);
  if (!ingestionResult.success) {
    throw new Error("Ingestion failed: " + JSON.stringify(ingestionResult.errors));
  }
  const dossier = ingestionResult.data;
  console.log(`   ✅ Ingested Dossier: ${dossier.dossierId}`);
  console.log(`   🔐 SHA-256 Provenance Fingerprint: ${dossier.artifacts[0].contentHash.substring(0, 32)}...\n`);

  // -------------------------------------------------------------------------
  // STAGE 03: Hybrid RAG & Exact Citation Engine
  // -------------------------------------------------------------------------
  console.log("🔍 [STAGE 03] Building BM25 Citation Engine & Lexical Index...");
  const engine = createCitationEngine(dossier);
  const hits = engine.retrieve("retention customer audit logs", { topK: 1 });
  console.log(`   ✅ BM25 Top Match Score: ${hits[0]?.score.toFixed(3)} on Page ${hits[0]?.pageNumber}`);
  console.log(`   📑 Snippet: "${hits[0]?.text.trim()}"\n`);

  // -------------------------------------------------------------------------
  // STAGE 04: Compliance Evaluation & Grounding Gatekeeper
  // -------------------------------------------------------------------------
  console.log("⚖️  [STAGE 04] Evaluating Compliance against Corporate Governance Policy...");
  const corporatePolicy: Policy = {
    policyId: "POL-SEC-2026",
    name: "Corporate Data Security & Audit Governance",
    criteria: [
      {
        criterionId: "CRIT-LOG-180",
        title: "Audit Log Retention Minimum",
        description: "Vendor must retain all access and audit logs for a minimum of 180 days.",
        query: "audit logs retention days",
        severity: "critical",
        minDaysRequired: 180,
      },
    ],
  };

  const findings = await evaluateCompliance(dossier, corporatePolicy, engine);
  const logFinding = findings[0];
  console.log(`   🚨 Finding: ${logFinding.criterionId} ➔ Status: [${logFinding.status.toUpperCase()}]`);
  console.log(`   🛡️  Grounding Verified: ${logFinding.groundingVerified}`);
  console.log(`   💡 Reasoning: ${logFinding.reasoning}\n`);

  // -------------------------------------------------------------------------
  // STAGE 05: Agentic Workflow & Exception-Based Triage
  // -------------------------------------------------------------------------
  console.log("🤖 [STAGE 05] Routing Findings through Exception-Based State Machine...");
  const routing = routeDossierFindings(dossier, findings);
  if (routing.autoApproved) {
    console.log("   🎉 Auto-Approved: All criteria passed without exceptions.");
    return;
  }

  const openCase = routing.caseItem;
  console.log(`   ⚠️  Created Operational Case: ${openCase.caseId}`);
  console.log(`   🏷️  Canonical Triage Role: [${openCase.triageRole}] (Escalated to human reviewer)`);
  console.log(`   🔄 Case Initial State: [${openCase.state}]\n`);

  // Reviewer claims the case
  console.log("👤 Reviewer Sarah (CISO) claims the case...");
  const claimedCase = transitionCase(openCase, {
    type: "CLAIM",
    reviewerId: "rev_sarah_ciso",
    timestamp: new Date().toISOString(),
  });
  console.log(`   🔄 Case State: [${claimedCase.state}] (Assigned to: ${claimedCase.assignedReviewerId})\n`);

  // -------------------------------------------------------------------------
  // STAGE 06: Operator Action Dashboard & Tamper-Proof Audit Trail
  // -------------------------------------------------------------------------
  console.log("🖥️  [STAGE 06] Operator Action Workspace: Split-Screen Evidence Inspection & Determination...");
  const auditStore = new InMemoryAuditStore();

  // Inspect in-situ offset
  const citation = logFinding.citations[0];
  const evidenceView = inspectEvidenceContext(dossier.artifacts[0], citation.pageNumber, citation);
  console.log(`   📍 Citation In-Situ Coordinates: Page ${evidenceView.pageNumber}, charOffset: ${evidenceView.charOffsetStart}-${evidenceView.charOffsetEnd}`);
  console.log(`   🔍 Verbatim Match Quote: "${evidenceView.exactQuote}"`);

  // Record Determination
  console.log("\n✍️  Executing CISO Executive Override with mandatory justification...");
  const { resolvedCase, auditEvent } = await executeDetermination(
    claimedCase,
    {
      reviewerId: "rev_sarah_ciso",
      type: "approved_override",
      rationale: "CISO executive exception granted: Vendor maintains secondary immutable AWS S3 Glacier archive.",
    },
    auditStore
  );

  console.log(`   🏁 Final Case State: [${resolvedCase.state}]`);
  console.log(`   ⚖️  Determination Type: [${resolvedCase.determination?.type}]`);
  console.log(`   📝 Justification: "${resolvedCase.determination?.rationale}"`);
  console.log(`   🔐 Audit Event ID: ${auditEvent.eventId} (${auditEvent.eventType})`);

  // Verify Audit Ledger
  const ledger = await auditStore.getEventsByCase(openCase.caseId);
  console.log(`\n📜 [Tamper-Proof Audit Ledger] Total Events: ${ledger.length}`);
  ledger.forEach((ev, i) => {
    console.log(`   [${i + 1}] ${ev.timestamp} | ${ev.eventType} | Actor: ${ev.actorId} | Case: ${ev.caseId}`);
  });

  console.log("\n================================================================================");
  console.log(" ✨ Full 6-Stage Enterprise Lifecycle Successfully Executed & Verified!");
  console.log("================================================================================");
}

runEndToEndDemo().catch((err) => {
  console.error("Demo failed with error:", err);
  process.exit(1);
});

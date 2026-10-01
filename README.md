# Forward Deployed Engineer (FDE) Learning Project: DocuAudit

A frontline, enterprise-grade system for verifying vendor contracts and certifications against corporate compliance policies, evaluating discrepancies via Hybrid RAG, orchestrating human-in-the-loop review, and recording tamper-proof audit trails.

---

## ⚡ วิธีใช้งาน Project (Quick Start)

โปรเจกต์นี้มีช่องทางการใช้งานและการเรียนรู้ **3 รูปแบบหลัก**:

### 1. 🖥️ Interactive Web Portal & Reviewer Workbench (เปิดผ่าน Browser)
เปิดไฟล์ [`index.html`](./index.html) ในเบราว์เซอร์ของคุณ (ไม่ต้องเปิดเซิร์ฟเวอร์ใดๆ):
- **Curriculum & Roadmap**: ติดตามความคืบหน้า 6/6 Stages
- **Deep Dive & Theory**: กดอ่านเบื้องหลังทางวิศวกรรม, การตัดสินใจเชิงสถาปัตยกรรม (ADRs), และหลักการของ FDE แต่ละ Stage
- **Live Operator Workbench (STAGE 06)**: หน้าต่างจำลอง Reviewer แบบ Split-Screen ด้านซ้ายแสดงสัญญาต้นฉบับพร้อมชี้พิกัดไฮไลต์ ด้านขวาให้คุณทดลองกดคำวินิจฉัย (`Approve with CISO Override`, `Reject`, `Request Info`) และสังเกตการบันทึก **Append-Only Tamper-Proof Audit Trail** แบบเรียลไทม์

```bash
# หรือเปิดผ่านคำสั่งบน Windows PowerShell:
Start-Process index.html
```

---

### 2. 🚀 รัน End-to-End Pipeline Demo บน Terminal
ทดสอบรันวงจรการทำงานเต็มรูปแบบตั้งแต่ Stage 02 ถึง Stage 06 ผ่านคำสั่งเดียว:

```bash
npm run demo
```

**สิ่งที่ระบบจะรันให้เห็นแบบสดๆ ใน Terminal**:
1. **[STAGE 02] Ingestion**: รับข้อมูลดิบ แปลงข้อความให้สะอาด และสร้างลายนิ้วมือ SHA-256 Provenance
2. **[STAGE 03] Hybrid RAG**: สร้าง BM25 Lexical Index ค้นหาคำย่อและตัวเลขในสัญญาระดับหน้า
3. **[STAGE 04] Compliance Evaluation**: ตรวจสอบเกณฑ์การเก็บ Log และผ่าน **Grounding Gatekeeper**
4. **[STAGE 05] Agentic Workflow**: คัดกรองแบบ Exception Routing สร้าง `Case` พร้อมแท็ก `ready-for-human` และเปลี่ยนสถานะ FSM
5. **[STAGE 06] Operator Action**: คำนวณพิกัด `charOffset`, บันทึก `Determination`, และปล่อย `AuditEvent` เข้าสู่ Audit Ledger ที่ห้ามแก้ไขย้อนหลัง

---

### 3. 🧪 รัน Automated Test Suite (Test-Driven Development)
รันชุดทดสอบ Vitest ครอบคลุมทั้ง 24 Test Cases แบบ Zero-Mock Leaks:

```bash
# รันเทสต์ทั้งหมดแบบครั้งเดียว
npm test

# รันเทสต์แบบ Watch Mode (อัปเดตอัตโนมัติเมื่อแก้โค้ด)
npm run test:watch
```

---

## 🏗️ โครงสร้าง Codebase & Public Seams

```text
forward-deploy-engineer-learning/
├── GLOSSARY.md                    # Ubiquitous Language แม่บท (ห้ามมี technical jargon)
├── AGENTS.md                      # ระเบียบปฏิบัติของ AI Agent และ Skills
├── docs/
│   ├── adr/                       # Architectural Decision Records (ADR-0001 ถึง ADR-0005)
│   └── agents/                    # คู่มือ Triage Labels, Issue Tracker, Domain Docs
├── src/
│   ├── domain/                    # Pure Domain Models & Ubiquitous Types
│   │   ├── dossier.ts             # Dossier & Artifact schemas
│   │   ├── policy.ts              # Policy, Criterion & Finding types
│   │   ├── case.ts                # Case, FSM State Machine & Determination types
│   │   └── audit.ts               # AuditEvent & AuditStore interface
│   ├── ingestion/                 # STAGE 02: Ingestion Pipeline & Normalization
│   │   ├── ingest-dossier.ts      # Seam: ingestDossier()
│   │   └── ingest-dossier.test.ts
│   ├── citation/                  # STAGE 03: Hybrid RAG & Verbatim Grounding
│   │   ├── citation-engine.ts     # Seam: createCitationEngine()
│   │   └── citation-engine.test.ts
│   ├── evaluation/                # STAGE 04: Compliance Evaluation & Grounding Gate
│   │   ├── evaluate-compliance.ts # Seam: evaluateCompliance()
│   │   └── evaluate-compliance.test.ts
│   ├── workflow/                  # STAGE 05: Agentic Routing & Triage State Machine
│   │   ├── case-router.ts         # Seams: routeDossierFindings(), transitionCase()
│   │   └── case-router.test.ts
│   ├── dashboard/                 # STAGE 06: Reviewer Workbench & Audit Trail
│   │   ├── operator-action.ts     # Seams: executeDetermination(), inspectEvidenceContext()
│   │   └── operator-action.test.ts
│   └── demo.ts                    # End-to-End Pipeline Execution Script
└── index.html                     # Interactive Learning & Simulation Portal
```

---

## 📑 รายการ Architectural Decision Records (ADR)

1. [ADR-0001: Dossiers as Immutable Page-Indexed Bundles with Cryptographic Content Hashing](docs/adr/0001-dossiers-as-immutable-page-indexed-bundles.md)
2. [ADR-0002: Page-Bounded Chunking and Verbatim Grounding for Compliance Retrieval](docs/adr/0002-page-bounded-chunking-and-verbatim-citations.md)
3. [ADR-0003: Schema-Enforced Tri-State Findings and Grounding Gatekeeper](docs/adr/0003-schema-enforced-tri-state-findings-and-grounding-gate.md)
4. [ADR-0004: Exception-Based Case Generation and Triage State Machine](docs/adr/0004-exception-based-case-generation-and-triage-state-machine.md)
5. [ADR-0005: Split-Screen Evidence Inspection and Tamper-Proof Audit Trail](docs/adr/0005-split-screen-evidence-inspection-and-tamper-proof-audit-trail.md)
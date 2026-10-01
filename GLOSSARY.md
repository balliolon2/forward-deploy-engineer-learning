# Vendor Compliance & Contract Assurance

A frontline operational system for verifying vendor contracts and certifications against corporate compliance policies, evaluating discrepancies, and orchestrating human-in-the-loop review.

## Language

### Intake & Documents

**Dossier**:
A bundled collection of vendor-submitted contracts, certifications, and metadata submitted for a single compliance review cycle.
_Avoid_: Upload, Ticket, Request, File, Submission

**Artifact**:
An individual document or attachment within a Dossier, such as an SLA contract or ISO certificate.
_Avoid_: File, Attachment, PDF

### Rules & Assessment

**Policy**:
A formal governance document specifying mandatory operational, legal, and security standards required of vendors.
_Avoid_: Guideline, Rulebook, Standard

**Criterion**:
A single, testable requirement extracted from a Policy against which an Artifact is evaluated.
_Avoid_: Rule, Condition, Check, Prompt

**Finding**:
An assessment output for a single Criterion, containing an evaluation status (Pass, Flagged, Inconclusive), confidence level, and supporting citations.
_Avoid_: Output, Result, Answer, Score, Verdict

**Citation**:
An exact reference to a page, clause, or text excerpt within an Artifact that provides evidence for a Finding.
_Avoid_: Source, Link, Excerpt, Reference

### Operations & Review

**Case**:
An operational work item created when one or more Findings require human evaluation or intervention.
_Avoid_: Task, Job, Ticket, Issue

**Reviewer**:
A compliance officer or domain specialist authorized to assess a Case and deliver an official outcome.
_Avoid_: User, Admin, Operator, Auditor

**Determination**:
The authoritative decision rendered by a Reviewer on a Case (such as Approved, Rejected, Escalated, or Information Requested).
_Avoid_: Verdict, Resolution, Status, Action

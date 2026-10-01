export type AuditEventType =
  | "CASE_CREATED"
  | "CASE_CLAIMED"
  | "DETERMINATION_RECORDED"
  | "EVIDENCE_INSPECTED";

export interface AuditEvent {
  readonly eventId: string;
  readonly timestamp: string;
  readonly eventType: AuditEventType;
  readonly actorId: string;
  readonly dossierId: string;
  readonly caseId?: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface AuditStore {
  append(event: AuditEvent): Promise<void> | void;
  getEventsByCase(caseId: string): Promise<readonly AuditEvent[]> | readonly AuditEvent[];
  getAllEvents(): Promise<readonly AuditEvent[]> | readonly AuditEvent[];
}

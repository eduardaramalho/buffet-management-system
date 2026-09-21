import type { AuditRepository } from "../domain/user-management.types.js";

export class AuditService {
  constructor(private readonly audits: AuditRepository) {}

  record(input: Parameters<AuditRepository["record"]>[0]) {
    return this.audits.record(input);
  }
}
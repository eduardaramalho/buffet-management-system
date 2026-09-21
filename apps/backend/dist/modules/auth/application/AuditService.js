export class AuditService {
    audits;
    constructor(audits) {
        this.audits = audits;
    }
    record(input) {
        return this.audits.record(input);
    }
}

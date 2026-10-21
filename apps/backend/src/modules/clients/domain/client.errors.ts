// Errors live in the domain (not in the service file, as in older modules) because the repository also
// raises ClientConflictError when the database unique index catches a duplicate document.

/** Business rule violation (mapped to HTTP 400). */
export class ClientManagementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientManagementError";
  }
}

/** Conflict with the current state: duplicated document or client with open events (mapped to HTTP 409). */
export class ClientConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientConflictError";
  }
}

// Minimal structured-logger port (matches pino's call shape: fields object, then message) so
// application services can log without depending on pino directly; tests inject a plain stub.
export interface Logger {
  error(fields: Record<string, unknown>, message: string): void;
}

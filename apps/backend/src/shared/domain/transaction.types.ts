// Opaque transactional handle threaded through repository writes (Task, RuleApplication,
// EventTeam assignment) so one rule application commits or rolls back atomically. Kept as
// `unknown` here, instead of importing Prisma's TransactionClient, so domain/application code
// in every module stays framework-agnostic; only the Prisma repository implementations know how
// to unwrap it back into a real Prisma client.
export type TransactionClient = unknown;

export interface TransactionRunner {
  run<T>(work: (tx: TransactionClient) => Promise<T>): Promise<T>;
}

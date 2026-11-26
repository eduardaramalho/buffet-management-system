// Runs one unit of work atomically (e.g. one rule application: Task, RuleApplication and EventTeam
// writes commit or roll back together). The `tx` handed to `work` is deliberately typed as `unknown`
// instead of Prisma's TransactionClient, so domain/application code in every module stays
// framework-agnostic: it only threads the handle through to repository writes, and only the Prisma
// repository implementations know how to unwrap it back into a real Prisma client.
export interface TransactionRunner {
  run<T>(work: (tx: unknown) => Promise<T>): Promise<T>;
}

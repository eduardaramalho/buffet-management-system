import type { PrismaClient } from "../../generated/client.js";
import type { TransactionClient, TransactionRunner } from "../domain/transaction.types.js";

export class PrismaTransactionRunner implements TransactionRunner {
  constructor(private readonly prisma: PrismaClient) {}

  run<T>(work: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(tx));
  }
}

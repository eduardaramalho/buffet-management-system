// Seed entry point. Lives in src/ so it is compiled into dist/ and runs in the production image,
// which has no dev dependencies (ADR 0011): `node dist/seed.js`. In development: `npm run db:seed`.
import { prisma } from "./shared/config/database.js";
import { logger } from "./shared/config/logger.js";
import { BcryptHasher } from "./modules/auth/infrastructure/providers/BcryptHasher.js";
import { DatabaseSeeder } from "./shared/seed/DatabaseSeeder.js";
import { PrismaSeedRepository } from "./shared/seed/PrismaSeedRepository.js";

const seeder = new DatabaseSeeder(new PrismaSeedRepository(prisma), new BcryptHasher());

try {
  const result = await seeder.run({ adminInitialPassword: process.env.ADMIN_INITIAL_PASSWORD });
  logger.info(result, "Seed concluído");
} catch (error) {
  logger.error({ err: error }, "Falha ao executar o seed");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

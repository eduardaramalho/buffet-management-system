-- Contract step of the expand/contract migration started in 20261021200000_add_clients (ADR 0005).
-- Precondition: no row in `events` has a NULL client_id (soft-deleted rows included); otherwise
-- MySQL aborts with error 1138. Check before deploying:
--   SELECT id, name, deleted_at FROM events WHERE client_id IS NULL;

-- DropForeignKey
ALTER TABLE `events` DROP FOREIGN KEY `events_client_id_fkey`;

-- AlterTable
ALTER TABLE `events` MODIFY `client_id` CHAR(36) NOT NULL;

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

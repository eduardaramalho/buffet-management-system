-- RF25 (ADR 0008): lineage of replicated events and copied manual tasks.
-- Additive only: both columns are nullable, existing rows need no backfill.

-- AlterTable
ALTER TABLE `events` ADD COLUMN `source_event_id` CHAR(36) NULL;

-- AlterTable
ALTER TABLE `tasks` ADD COLUMN `source_task_id` CHAR(36) NULL;

-- CreateIndex
CREATE INDEX `events_source_event_id_idx` ON `events`(`source_event_id`);

-- CreateIndex
CREATE INDEX `tasks_source_task_id_idx` ON `tasks`(`source_task_id`);

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_source_event_id_fkey` FOREIGN KEY (`source_event_id`) REFERENCES `events`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_source_task_id_fkey` FOREIGN KEY (`source_task_id`) REFERENCES `tasks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

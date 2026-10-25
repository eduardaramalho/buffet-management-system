-- RFC 3.1 (ADR 0010): automatic assignment of generated tasks to the allocated team of a specialty.
-- Additive only: nullable column, existing templates keep generating unassigned tasks.

-- AlterTable
ALTER TABLE `rule_task_templates` ADD COLUMN `specialty` ENUM('COZINHA', 'SALAO', 'BAR', 'DECORACAO', 'LIMPEZA', 'CERIMONIAL', 'OUTRO') NULL;

-- CreateTable
CREATE TABLE `rules` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `condition_service_type_in` JSON NULL,
    `condition_min_guests` INTEGER NULL,
    `condition_max_guests` INTEGER NULL,
    `condition_required_service_ids` JSON NULL,
    `created_by_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `rules_created_by_id_idx`(`created_by_id`),
    INDEX `rules_is_active_idx`(`is_active`),
    INDEX `rules_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rule_resource_requirements` (
    `id` CHAR(36) NOT NULL,
    `rule_id` CHAR(36) NOT NULL,
    `specialty` ENUM('COZINHA', 'SALAO', 'BAR', 'DECORACAO', 'LIMPEZA', 'CERIMONIAL', 'OUTRO') NOT NULL,
    `min_quantity` INTEGER NOT NULL DEFAULT 1,

    INDEX `rule_resource_requirements_rule_id_idx`(`rule_id`),
    INDEX `rule_resource_requirements_specialty_idx`(`specialty`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `rules` ADD CONSTRAINT `rules_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rule_resource_requirements` ADD CONSTRAINT `rule_resource_requirements_rule_id_fkey` FOREIGN KEY (`rule_id`) REFERENCES `rules`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

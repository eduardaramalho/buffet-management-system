-- CreateTable
CREATE TABLE `clients` (
    `id` CHAR(36) NOT NULL,
    `type` ENUM('PF', 'PJ') NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `document` VARCHAR(14) NULL,
    `email` VARCHAR(150) NULL,
    `phone` VARCHAR(30) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `clients_document_key`(`document`),
    INDEX `clients_name_idx`(`name`),
    INDEX `clients_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable (expand step: nullable, existing events keep working without a client)
ALTER TABLE `events` ADD COLUMN `client_id` CHAR(36) NULL;

-- CreateIndex
CREATE INDEX `events_client_id_idx` ON `events`(`client_id`);

-- AddForeignKey
ALTER TABLE `events` ADD CONSTRAINT `events_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

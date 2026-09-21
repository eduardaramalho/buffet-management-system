ALTER TABLE `roles` ADD COLUMN `is_protected` BOOLEAN NOT NULL DEFAULT false;

UPDATE `roles` SET `is_protected` = true WHERE `name` = 'admin';
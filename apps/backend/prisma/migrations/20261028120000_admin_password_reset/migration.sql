-- ADR 0012: recuperação de senha por redefinição administrativa.
-- Aditivo em `users`: usuários existentes recebem must_change_password = false e seguem entrando normalmente.
-- A tabela password_reset_tokens pertencia ao fluxo por e-mail, que nunca chegou a enviar mensagens
-- (o provider só escrevia o token no log) e foi removido; ela guardava apenas tokens de uso único e curta duração.

-- AlterTable
ALTER TABLE `users` ADD COLUMN `must_change_password` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `temp_password_expires_at` DATETIME(3) NULL;

-- DropForeignKey
ALTER TABLE `password_reset_tokens` DROP FOREIGN KEY `password_reset_tokens_user_id_fkey`;

-- DropTable
DROP TABLE `password_reset_tokens`;

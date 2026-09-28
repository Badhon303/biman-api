-- CreateEnum
CREATE TYPE "NotificationEntity" AS ENUM ('TICKET', 'REQUEST', 'SCHEDULE', 'EQUIPMENT');

-- AlterTable
ALTER TABLE "app_notifications" ADD COLUMN "entity_type" "NotificationEntity",
ADD COLUMN "entity_id" UUID;

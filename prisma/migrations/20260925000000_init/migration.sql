-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Super Admin', 'Manager', 'Engineer', 'Biman Admin');

-- CreateEnum
CREATE TYPE "Organization" AS ENUM ('NGGL', 'Biman');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('Active', 'Inactive');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('Available', 'Under Maintenance', 'Out of Service', 'Inactive');

-- CreateEnum
CREATE TYPE "ServiceKind" AS ENUM ('F-Service', 'B-Service', 'C-Service', 'D-Service', 'E-Service', 'V-Service', 'Others');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('F-Service', 'B-Service', 'C-Service', 'D-Service', 'E-Service', 'V-Service', 'Others', 'Breakdown', 'General', 'Washing');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('Open', 'Assigned', 'In Progress', 'Awaiting Parts', 'Awaiting Verification', 'Completed', 'Closed');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('Low', 'Medium', 'High', 'Critical');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('Pending', 'Approved', 'Rejected', 'Received');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('Scheduled', 'Due soon', 'Overdue');

-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('EQUIPMENT_PHOTO', 'WORK_IMAGE', 'FEEDBACK_IMAGE', 'EQUIPMENT_DOCUMENT');

-- CreateEnum
CREATE TYPE "FileStatus" AS ENUM ('PENDING', 'ATTACHED');

-- CreateEnum
CREATE TYPE "PhotoSlot" AS ENUM ('PRIMARY', 'FRONT', 'SIDE', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "organization" "Organization" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'Active',
    "must_change_password" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_types" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_type_services" (
    "id" UUID NOT NULL,
    "equipment_type_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ServiceKind" NOT NULL,
    "min_hours" DOUBLE PRECISION,
    "max_hours" DOUBLE PRECISION,
    "months" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_type_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "asset_no" TEXT NOT NULL,
    "equipment_type_id" UUID NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "engine_model" TEXT,
    "engine_serial_no" TEXT,
    "biman_serial_no" TEXT,
    "tld_serial_no" TEXT,
    "location" TEXT NOT NULL,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'Available',
    "hour_meter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_service_check_at" TIMESTAMP(3),
    "actual_gt_date" TIMESTAMP(3),
    "ship_date" TIMESTAMP(3),
    "shipping_status" TEXT,
    "emission_rating" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_specifications" (
    "id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_specifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_photos" (
    "id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "file_asset_id" UUID NOT NULL,
    "slot" "PhotoSlot" NOT NULL DEFAULT 'OTHER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_documents" (
    "id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "file_asset_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expiry_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hour_meter_readings" (
    "id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_user_id" UUID NOT NULL,

    CONSTRAINT "hour_meter_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_checks" (
    "id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "equipment_type_service_id" UUID NOT NULL,
    "threshold_hours" DOUBLE PRECISION NOT NULL,
    "ticket_id" UUID,
    "triggered_by_user_id" UUID NOT NULL,
    "previous_value" DOUBLE PRECISION NOT NULL,
    "current_value" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_template_items" (
    "id" UUID NOT NULL,
    "service_type" "ServiceKind" NOT NULL,
    "equipment_type_service_id" UUID,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "checklist_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "ticket_no" TEXT NOT NULL,
    "service_type" "TicketType" NOT NULL,
    "pm_service_id" UUID,
    "equipment_id" UUID NOT NULL,
    "fault_description" TEXT,
    "priority" "TicketPriority" NOT NULL DEFAULT 'Medium',
    "status" "TicketStatus" NOT NULL DEFAULT 'Open',
    "due_date" TIMESTAMP(3) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "assigned_engineer_id" UUID,
    "requesting_party" TEXT,
    "closed_date" TIMESTAMP(3),
    "downtime_hours" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "problem_description" TEXT,
    "parts_used" TEXT,
    "labour_hours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "functional_test_passed" BOOLEAN,
    "safety_check_passed" BOOLEAN,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" UUID NOT NULL,
    "maintenance_record_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_images" (
    "id" UUID NOT NULL,
    "maintenance_record_id" UUID NOT NULL,
    "file_asset_id" UUID NOT NULL,

    CONSTRAINT "work_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_history" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_feedback" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body_html" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback_images" (
    "id" UUID NOT NULL,
    "feedback_id" UUID NOT NULL,
    "file_asset_id" UUID NOT NULL,

    CONSTRAINT "feedback_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_requests" (
    "id" UUID NOT NULL,
    "request_no" TEXT NOT NULL,
    "ticket_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "item" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'Pending',
    "requested_by_user_id" UUID NOT NULL,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_schedules" (
    "id" UUID NOT NULL,
    "schedule_no" TEXT NOT NULL,
    "equipment_id" UUID NOT NULL,
    "last_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'Scheduled',
    "ticket_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_assets" (
    "id" UUID NOT NULL,
    "relative_path" TEXT NOT NULL,
    "thumbnail_relative_path" TEXT,
    "purpose" "FilePurpose" NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "thumbnail_size_bytes" INTEGER,
    "original_size_bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sha256" TEXT NOT NULL,
    "status" "FileStatus" NOT NULL DEFAULT 'PENDING',
    "uploaded_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attached_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "file_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_expires_at_idx" ON "refresh_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_types_name_key" ON "equipment_types"("name");

-- CreateIndex
CREATE INDEX "equipment_type_services_equipment_type_id_sort_order_idx" ON "equipment_type_services"("equipment_type_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_asset_no_key" ON "equipment"("asset_no");

-- CreateIndex
CREATE INDEX "equipment_equipment_type_id_status_idx" ON "equipment"("equipment_type_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_photos_file_asset_id_key" ON "equipment_photos"("file_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_documents_file_asset_id_key" ON "equipment_documents"("file_asset_id");

-- CreateIndex
CREATE INDEX "hour_meter_readings_equipment_id_recorded_at_idx" ON "hour_meter_readings"("equipment_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "service_checks_ticket_id_key" ON "service_checks"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_checks_equipment_id_equipment_type_service_id_thres_key" ON "service_checks"("equipment_id", "equipment_type_service_id", "threshold_hours");

-- CreateIndex
CREATE INDEX "checklist_template_items_service_type_equipment_type_servic_idx" ON "checklist_template_items"("service_type", "equipment_type_service_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_no_key" ON "tickets"("ticket_no");

-- CreateIndex
CREATE INDEX "tickets_status_due_date_idx" ON "tickets"("status", "due_date");

-- CreateIndex
CREATE INDEX "tickets_equipment_id_created_at_idx" ON "tickets"("equipment_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_records_ticket_id_key" ON "maintenance_records"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_images_file_asset_id_key" ON "work_images"("file_asset_id");

-- CreateIndex
CREATE INDEX "ticket_history_ticket_id_created_at_idx" ON "ticket_history"("ticket_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "feedback_images_file_asset_id_key" ON "feedback_images"("file_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_requests_request_no_key" ON "equipment_requests"("request_no");

-- CreateIndex
CREATE INDEX "equipment_requests_status_created_at_idx" ON "equipment_requests"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_schedules_schedule_no_key" ON "maintenance_schedules"("schedule_no");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_schedules_ticket_id_key" ON "maintenance_schedules"("ticket_id");

-- CreateIndex
CREATE INDEX "maintenance_schedules_due_date_status_idx" ON "maintenance_schedules"("due_date", "status");

-- CreateIndex
CREATE INDEX "app_notifications_user_id_read_created_at_idx" ON "app_notifications"("user_id", "read", "created_at");

-- CreateIndex
CREATE INDEX "file_assets_status_created_at_idx" ON "file_assets"("status", "created_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_type_services" ADD CONSTRAINT "equipment_type_services_equipment_type_id_fkey" FOREIGN KEY ("equipment_type_id") REFERENCES "equipment_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_equipment_type_id_fkey" FOREIGN KEY ("equipment_type_id") REFERENCES "equipment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_specifications" ADD CONSTRAINT "equipment_specifications_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_photos" ADD CONSTRAINT "equipment_photos_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_photos" ADD CONSTRAINT "equipment_photos_file_asset_id_fkey" FOREIGN KEY ("file_asset_id") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_documents" ADD CONSTRAINT "equipment_documents_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_documents" ADD CONSTRAINT "equipment_documents_file_asset_id_fkey" FOREIGN KEY ("file_asset_id") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_meter_readings" ADD CONSTRAINT "hour_meter_readings_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hour_meter_readings" ADD CONSTRAINT "hour_meter_readings_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_checks" ADD CONSTRAINT "service_checks_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_checks" ADD CONSTRAINT "service_checks_equipment_type_service_id_fkey" FOREIGN KEY ("equipment_type_service_id") REFERENCES "equipment_type_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_checks" ADD CONSTRAINT "service_checks_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_checks" ADD CONSTRAINT "service_checks_triggered_by_user_id_fkey" FOREIGN KEY ("triggered_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_equipment_type_service_id_fkey" FOREIGN KEY ("equipment_type_service_id") REFERENCES "equipment_type_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_pm_service_id_fkey" FOREIGN KEY ("pm_service_id") REFERENCES "equipment_type_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_engineer_id_fkey" FOREIGN KEY ("assigned_engineer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_maintenance_record_id_fkey" FOREIGN KEY ("maintenance_record_id") REFERENCES "maintenance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_images" ADD CONSTRAINT "work_images_maintenance_record_id_fkey" FOREIGN KEY ("maintenance_record_id") REFERENCES "maintenance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_images" ADD CONSTRAINT "work_images_file_asset_id_fkey" FOREIGN KEY ("file_asset_id") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_history" ADD CONSTRAINT "ticket_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_feedback" ADD CONSTRAINT "ticket_feedback_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_feedback" ADD CONSTRAINT "ticket_feedback_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_images" ADD CONSTRAINT "feedback_images_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "ticket_feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback_images" ADD CONSTRAINT "feedback_images_file_asset_id_fkey" FOREIGN KEY ("file_asset_id") REFERENCES "file_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_requests" ADD CONSTRAINT "equipment_requests_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_requests" ADD CONSTRAINT "equipment_requests_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_requests" ADD CONSTRAINT "equipment_requests_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_requests" ADD CONSTRAINT "equipment_requests_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

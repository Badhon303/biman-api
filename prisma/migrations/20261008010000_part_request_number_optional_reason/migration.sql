ALTER TABLE "equipment_requests" ALTER COLUMN "reason" DROP NOT NULL;
ALTER TABLE "equipment_requests" ADD COLUMN "part_number" INTEGER;

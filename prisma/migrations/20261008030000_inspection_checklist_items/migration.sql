CREATE TABLE "inspection_checklist_items" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "excluded_services" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inspection_checklist_items_sort_order_idx" ON "inspection_checklist_items"("sort_order");

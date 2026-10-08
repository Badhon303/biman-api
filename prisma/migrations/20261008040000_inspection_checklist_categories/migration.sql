DROP TABLE "inspection_checklist_items";

CREATE TABLE "inspection_checklist_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_checklist_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inspection_checklist_categories_name_key" ON "inspection_checklist_categories"("name");

CREATE TABLE "inspection_checklist_items" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspection_checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inspection_checklist_items_category_id_sort_order_idx" ON "inspection_checklist_items"("category_id", "sort_order");

ALTER TABLE "inspection_checklist_items" ADD CONSTRAINT "inspection_checklist_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "inspection_checklist_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

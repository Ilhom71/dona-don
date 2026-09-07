ALTER TABLE "partners" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "archived_at" timestamp;
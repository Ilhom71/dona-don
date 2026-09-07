ALTER TYPE "public"."movement_source" ADD VALUE 'purchase_reversal' BEFORE 'sale';--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "cancel_reason" text;
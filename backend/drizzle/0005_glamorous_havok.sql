ALTER TYPE "public"."movement_source" ADD VALUE 'sale_reversal' BEFORE 'transfer';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "freight_cost_uzs" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "cancel_reason" text;
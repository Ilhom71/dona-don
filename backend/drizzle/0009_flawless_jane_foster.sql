ALTER TABLE "cash_transactions" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "cancel_reason" text;
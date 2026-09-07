ALTER TABLE "cash_transactions" ADD COLUMN "partner_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
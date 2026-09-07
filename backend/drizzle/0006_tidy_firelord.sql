CREATE TYPE "public"."expense_category" AS ENUM('supplier_payment', 'salary', 'rent', 'transport', 'utilities', 'other');--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "expense_category" DEFAULT 'other' NOT NULL,
	"partner_id" uuid,
	"amount" numeric(16, 2) NOT NULL,
	"currency" "currency" DEFAULT 'UZS' NOT NULL,
	"exchange_rate_snapshot" numeric(14, 4) NOT NULL,
	"amount_uzs" numeric(16, 2) NOT NULL,
	"method" "payment_method" DEFAULT 'cash' NOT NULL,
	"description" text NOT NULL,
	"expense_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category");
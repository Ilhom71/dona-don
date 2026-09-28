CREATE TYPE "public"."cash_tx_purpose" AS ENUM('regular', 'funding');--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD COLUMN "purpose" "cash_tx_purpose" DEFAULT 'regular' NOT NULL;
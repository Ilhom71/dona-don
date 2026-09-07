CREATE TYPE "public"."cash_account" AS ENUM('kassa', 'buxgalteriya');--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD COLUMN "account" "cash_account" DEFAULT 'kassa' NOT NULL;
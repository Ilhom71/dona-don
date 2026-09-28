CREATE TYPE "public"."sms_credit_type" AS ENUM('topup', 'usage', 'refund');--> statement-breakpoint
CREATE TABLE "sms_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sms_admins_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "sms_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "sms_credit_type" NOT NULL,
	"amount" integer NOT NULL,
	"price_per_sms_uzs" numeric(12, 2),
	"total_uzs" numeric(14, 2),
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sms_credits_created_at_idx" ON "sms_credits" USING btree ("created_at");
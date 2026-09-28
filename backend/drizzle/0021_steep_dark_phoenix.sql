CREATE TYPE "public"."sms_status" AS ENUM('sent', 'failed');--> statement-breakpoint
CREATE TABLE "sms_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid,
	"partner_name" varchar(255) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"message" text NOT NULL,
	"status" "sms_status" NOT NULL,
	"textup_sms_id" varchar(128),
	"error_message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sms_logs" ADD CONSTRAINT "sms_logs_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sms_logs_sent_at_idx" ON "sms_logs" USING btree ("sent_at");
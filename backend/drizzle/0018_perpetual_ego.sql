CREATE TABLE "day_openings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opening_date" varchar(10) NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"note" text,
	CONSTRAINT "day_openings_opening_date_unique" UNIQUE("opening_date")
);

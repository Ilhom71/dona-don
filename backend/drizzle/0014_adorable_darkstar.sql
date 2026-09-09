CREATE TABLE "day_closings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"closing_date" varchar(10) NOT NULL,
	"kassa_balance_uzs" numeric(16, 2) NOT NULL,
	"warehouse_stock_value_uzs" numeric(16, 2) NOT NULL,
	"today_sales_uzs" numeric(16, 2) NOT NULL,
	"period_in_uzs" numeric(16, 2) NOT NULL,
	"period_out_uzs" numeric(16, 2) NOT NULL,
	"note" text,
	"closed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "day_closings_closing_date_unique" UNIQUE("closing_date")
);
--> statement-breakpoint
CREATE TABLE "stock_lot_consumptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_cost_uzs" numeric(14, 2) NOT NULL,
	"sale_item_id" uuid,
	"movement_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"unit_cost_uzs" numeric(14, 2) NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"remaining_quantity" numeric(14, 3) NOT NULL,
	"source" "movement_source" NOT NULL,
	"purchase_id" uuid,
	"movement_id" uuid,
	"received_at" timestamp NOT NULL,
	"cancelled_at" timestamp,
	"cancel_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stock_lot_consumptions" ADD CONSTRAINT "stock_lot_consumptions_lot_id_stock_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."stock_lots"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_lot_consumptions" ADD CONSTRAINT "stock_lot_consumptions_sale_item_id_sale_items_id_fk" FOREIGN KEY ("sale_item_id") REFERENCES "public"."sale_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_lot_consumptions" ADD CONSTRAINT "stock_lot_consumptions_movement_id_stock_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_movement_id_stock_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_lot_consumptions_lot_idx" ON "stock_lot_consumptions" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "stock_lots_product_warehouse_idx" ON "stock_lots" USING btree ("product_id","warehouse_id","received_at");
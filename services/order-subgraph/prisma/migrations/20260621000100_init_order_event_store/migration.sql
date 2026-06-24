-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "order_events" (
    "id" UUID NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_data" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_read" (
    "order_id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "seller_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL,
    "inventory_status" TEXT NOT NULL,
    "payment_status" TEXT NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_read_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "order_items_read" (
    "line_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "title_snapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,

    CONSTRAINT "order_items_read_pkey" PRIMARY KEY ("line_id")
);

-- CreateTable
CREATE TABLE "order_outbox" (
    "id" UUID NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "headers" JSONB NOT NULL DEFAULT '{}',
    "published_at" TIMESTAMPTZ(6),
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_events_aggregate_id_idx" ON "order_events"("aggregate_id");

-- CreateIndex
CREATE INDEX "order_events_event_type_idx" ON "order_events"("event_type");

-- CreateIndex
CREATE INDEX "order_events_occurred_at_idx" ON "order_events"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_events_aggregate_id_sequence_key" ON "order_events"("aggregate_id", "sequence");

-- CreateIndex
CREATE INDEX "orders_read_buyer_id_idx" ON "orders_read"("buyer_id");

-- CreateIndex
CREATE INDEX "order_items_read_order_id_idx" ON "order_items_read"("order_id");

-- CreateIndex
CREATE INDEX "order_outbox_published_at_idx" ON "order_outbox"("published_at");

-- CreateIndex
CREATE INDEX "order_outbox_aggregate_id_idx" ON "order_outbox"("aggregate_id");

-- CreateIndex
CREATE INDEX "order_outbox_created_at_idx" ON "order_outbox"("created_at");

-- AddForeignKey
ALTER TABLE "order_items_read" ADD CONSTRAINT "order_items_read_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders_read"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;

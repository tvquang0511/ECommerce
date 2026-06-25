-- DropIndex
DROP INDEX IF EXISTS "order_outbox_published_at_idx";

-- CreateIndex
CREATE INDEX "order_outbox_published_at_created_at_idx"
ON "order_outbox"("published_at", "created_at");

-- CreateIndex
CREATE INDEX "order_outbox_event_type_idx"
ON "order_outbox"("event_type");

-- CreateIndex
CREATE INDEX "order_outbox_pending_created_at_idx"
ON "order_outbox"("created_at")
WHERE "published_at" IS NULL;

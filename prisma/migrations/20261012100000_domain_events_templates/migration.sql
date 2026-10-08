-- Faz 3.1/3.2: transactional outbox (domain_events + per-subscriber event_deliveries)
-- and admin notification template overrides with version history. New tables only;
-- safe on a live DB (no existing rows touched).

-- CreateEnum
CREATE TYPE "EventDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "domain_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "actorId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,

    CONSTRAINT "domain_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_deliveries" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "subscriber" TEXT NOT NULL,
    "status" "EventDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "result" JSONB,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'tr',
    "subject" TEXT NOT NULL DEFAULT '',
    "bodyHtml" TEXT NOT NULL DEFAULT '',
    "bodyText" TEXT NOT NULL DEFAULT '',
    "variables" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_template_versions" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "bodyHtml" TEXT NOT NULL DEFAULT '',
    "bodyText" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "action" TEXT NOT NULL DEFAULT 'save',
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "domain_events_processedAt_occurredAt_idx" ON "domain_events"("processedAt", "occurredAt");

-- CreateIndex
CREATE INDEX "domain_events_type_occurredAt_idx" ON "domain_events"("type", "occurredAt");

-- CreateIndex
CREATE INDEX "domain_events_aggregateType_aggregateId_idx" ON "domain_events"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "domain_events_occurredAt_idx" ON "domain_events"("occurredAt");

-- CreateIndex
CREATE INDEX "event_deliveries_status_updatedAt_idx" ON "event_deliveries"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "event_deliveries_eventId_subscriber_key" ON "event_deliveries"("eventId", "subscriber");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_key_channel_locale_key" ON "notification_templates"("key", "channel", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "notification_template_versions_templateId_version_key" ON "notification_template_versions"("templateId", "version");

-- AddForeignKey
ALTER TABLE "event_deliveries" ADD CONSTRAINT "event_deliveries_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "domain_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_template_versions" ADD CONSTRAINT "notification_template_versions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "notification_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

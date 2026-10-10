-- CreateTable
CREATE TABLE "ticket_presence" (
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "typingAt" TIMESTAMP(3),

    CONSTRAINT "ticket_presence_pkey" PRIMARY KEY ("ticketId","userId")
);

-- CreateTable
CREATE TABLE "saved_filters" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "list" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "params" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_filters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_presence_lastSeenAt_idx" ON "ticket_presence"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "saved_filters_userId_list_name_key" ON "saved_filters"("userId", "list", "name");

-- AddForeignKey
ALTER TABLE "ticket_presence" ADD CONSTRAINT "ticket_presence_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_presence" ADD CONSTRAINT "ticket_presence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_filters" ADD CONSTRAINT "saved_filters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (customer 360 timeline: a customer's own rows and rows about them)
CREATE INDEX "activity_logs_userId_createdAt_idx" ON "activity_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_entityId_createdAt_idx" ON "activity_logs"("entityId", "createdAt");

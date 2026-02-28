-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'CORPORATE');

-- CreateEnum
CREATE TYPE "ProductCategorySlug" AS ENUM ('hosting', 'vds', 'vps', 'server', 'domain', 'ssl', 'email');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('monthly', 'quarterly', 'semiannual', 'yearly', 'biennial', 'triennial');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CREDIT_CARD', 'BANK_TRANSFER', 'BALANCE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'CUSTOMER_REPLY', 'ADMIN_REPLY', 'WAITING', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketDepartment" AS ENUM ('GENERAL', 'TECHNICAL', 'BILLING', 'SALES');

-- CreateEnum
CREATE TYPE "DnsRecordType" AS ENUM ('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV');

-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'TRANSFERRING', 'PENDING');

-- CreateEnum
CREATE TYPE "SslStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'PENDING', 'REVOKED');

-- CreateEnum
CREATE TYPE "SslType" AS ENUM ('DV', 'OV', 'EV', 'WILDCARD');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('COMPLETED', 'IN_PROGRESS', 'FAILED', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('FULL', 'INCREMENTAL', 'DATABASE', 'FILES');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'PAYMENT', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PromoCodeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INFO', 'WARNING', 'ERROR', 'SUCCESS');

-- CreateEnum
CREATE TYPE "SystemStatusType" AS ENUM ('OPERATIONAL', 'DEGRADED', 'PARTIAL_OUTAGE', 'MAJOR_OUTAGE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KbArticleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AffiliatePaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surname" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "customerType" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "companyName" TEXT,
    "taxNumber" TEXT,
    "taxOffice" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Türkiye',
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "affiliateCode" TEXT,
    "referredById" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "slug" "ProductCategorySlug" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'Package',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL DEFAULT '',
    "longDescription" TEXT NOT NULL DEFAULT '',
    "features" JSONB NOT NULL DEFAULT '[]',
    "includedFeatures" JSONB NOT NULL DEFAULT '[]',
    "resourceLimits" JSONB NOT NULL DEFAULT '{}',
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "badge" TEXT,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "stockQuantity" INTEGER NOT NULL DEFAULT -1,
    "isInStock" BOOLEAN NOT NULL DEFAULT true,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_tiers" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "period" "BillingPeriod" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "discountedPrice" DOUBLE PRECISION,
    "setupFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "renewalPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "domain" TEXT,
    "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'monthly',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "promoCodeId" TEXT,
    "setupFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "processingStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "refundedAt" TIMESTAMP(3),
    "refundAmount" DOUBLE PRECISION,
    "serviceId" TEXT,
    "invoiceId" TEXT,
    "customerNotes" TEXT,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productSku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "configuration" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_activities" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "domain" TEXT,
    "username" TEXT,
    "ipAddress" TEXT,
    "serverName" TEXT,
    "diskUsed" DOUBLE PRECISION,
    "diskLimit" DOUBLE PRECISION,
    "bandwidthUsed" DOUBLE PRECISION,
    "bandwidthLimit" DOUBLE PRECISION,
    "cpuUsage" DOUBLE PRECISION,
    "ramUsage" DOUBLE PRECISION,
    "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'monthly',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nextDueDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "status" "ServiceStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspendedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "suspendReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domains" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registrar" TEXT NOT NULL DEFAULT 'KLEACORE',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "privacyEnabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "DomainStatus" NOT NULL DEFAULT 'ACTIVE',
    "nameservers" JSONB NOT NULL DEFAULT '[]',
    "whoisName" TEXT,
    "whoisEmail" TEXT,
    "whoisPhone" TEXT,
    "whoisAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dns_records" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "type" "DnsRecordType" NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "ttl" INTEGER NOT NULL DEFAULT 3600,
    "priority" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dns_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "department" "TicketDepartment" NOT NULL DEFAULT 'GENERAL',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "assignedTo" TEXT,
    "relatedServiceId" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderRole" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "message" TEXT NOT NULL,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ssl_certificates" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "type" "SslType" NOT NULL DEFAULT 'DV',
    "provider" TEXT NOT NULL DEFAULT 'KLEACORE',
    "status" "SslStatus" NOT NULL DEFAULT 'PENDING',
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ssl_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backups" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "BackupType" NOT NULL DEFAULT 'FULL',
    "status" "BackupStatus" NOT NULL DEFAULT 'SCHEDULED',
    "size" DOUBLE PRECISION,
    "filePath" TEXT,
    "scheduleId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_schedules" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'daily',
    "retention" INTEGER NOT NULL DEFAULT 7,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT 'İstanbul, TR',
    "provider" TEXT NOT NULL DEFAULT 'KLEACORE',
    "cpuModel" TEXT,
    "cpuCores" INTEGER NOT NULL DEFAULT 0,
    "ramTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diskTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpuUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ramUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diskUsage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOnline" BOOLEAN NOT NULL DEFAULT true,
    "uptime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceBefore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "applicableCategories" JSONB NOT NULL DEFAULT '[]',
    "applicableProducts" JSONB NOT NULL DEFAULT '[]',
    "applicablePeriods" JSONB NOT NULL DEFAULT '[]',
    "maxUses" INTEGER NOT NULL DEFAULT 0,
    "maxUsesPerCustomer" INTEGER NOT NULL DEFAULT 1,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "minOrderAmount" DOUBLE PRECISION,
    "isFirstOrderOnly" BOOLEAN NOT NULL DEFAULT false,
    "isNewCustomerOnly" BOOLEAN NOT NULL DEFAULT false,
    "status" "PromoCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "coverImage" TEXT,
    "author" TEXT NOT NULL DEFAULT 'KLEACORE',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'Book',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kb_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_articles" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "status" "KbArticleStatus" NOT NULL DEFAULT 'DRAFT',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "notHelpfulCount" INTEGER NOT NULL DEFAULT 0,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kb_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_referrals" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "commission" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_payments" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "AffiliatePaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'general',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'string',
    "label" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_statuses" (
    "id" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "status" "SystemStatusType" NOT NULL DEFAULT 'OPERATIONAL',
    "description" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_incidents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "severity" "IncidentSeverity" NOT NULL DEFAULT 'MINOR',
    "status" "IncidentStatus" NOT NULL DEFAULT 'INVESTIGATING',
    "serviceName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "updates" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_affiliateCode_key" ON "users"("affiliateCode");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_slug_key" ON "product_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_tiers_productId_period_key" ON "pricing_tiers"("productId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "domains_name_key" ON "domains"("name");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_orderId_key" ON "invoices"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticketNumber_key" ON "support_tickets"("ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "servers_hostname_key" ON "servers"("hostname");

-- CreateIndex
CREATE UNIQUE INDEX "promotion_codes_code_key" ON "promotion_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "blog_categories_slug_key" ON "blog_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "kb_categories_slug_key" ON "kb_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "kb_articles_slug_key" ON "kb_articles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_tiers" ADD CONSTRAINT "pricing_tiers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promotion_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_activities" ADD CONSTRAINT "order_activities_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dns_records" ADD CONSTRAINT "dns_records_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ssl_certificates" ADD CONSTRAINT "ssl_certificates_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backups" ADD CONSTRAINT "backups_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backups" ADD CONSTRAINT "backups_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backups" ADD CONSTRAINT "backups_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "backup_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "blog_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_articles" ADD CONSTRAINT "kb_articles_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "kb_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

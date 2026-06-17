import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paginationParams = [
  { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
  {
    name: "perPage",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 10 },
  },
  { name: "search", in: "query", schema: { type: "string" } },
  { name: "sortBy", in: "query", schema: { type: "string" } },
  {
    name: "sortOrder",
    in: "query",
    schema: { type: "string", enum: ["asc", "desc"], default: "desc" },
  },
];

const successEnvelope = {
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    data: { type: "object" },
  },
  required: ["success", "data"],
};

const errorEnvelope = {
  type: "object",
  properties: {
    success: { type: "boolean", example: false },
    error: { type: "string" },
    errors: {
      type: "object",
      additionalProperties: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
  required: ["success", "error"],
};

function buildOpenApiSpec(baseUrl: string) {
  const security = [{ bearerAuth: [] }, { apiKeyAuth: [] }];

  return {
    openapi: "3.0.3",
    info: {
      title: "KLEACORE Public API",
      version: "1.0.0",
      description:
        "KLEACORE müşteri API'si. Tüm istekler API anahtarı ile yetkilendirilir.",
    },
    servers: [{ url: `${baseUrl}/api/v1` }],
    tags: [
      { name: "Invoices" },
      { name: "Tickets" },
      { name: "Services" },
      { name: "Orders" },
      { name: "Domains" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API Key",
        },
        apiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "x-api-key",
        },
      },
      schemas: {
        SuccessResponse: successEnvelope,
        ErrorResponse: errorEnvelope,
        Pagination: {
          type: "object",
          properties: {
            total: { type: "integer" },
            page: { type: "integer" },
            perPage: { type: "integer" },
            totalPages: { type: "integer" },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: "Geçersiz veya eksik API anahtarı",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        RateLimited: {
          description: "Rate limit aşıldı (30 istek / 10 dakika)",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
      },
    },
    paths: {
      "/invoices": {
        get: {
          tags: ["Invoices"],
          summary: "Fatura listesi",
          security,
          parameters: [
            ...paginationParams,
            {
              name: "status",
              in: "query",
              schema: {
                type: "string",
                enum: ["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED"],
              },
            },
          ],
          responses: {
            "200": {
              description: "Fatura listesi",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SuccessResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/invoices/{id}": {
        get: {
          tags: ["Invoices"],
          summary: "Fatura detayı",
          security,
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Fatura detayı",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SuccessResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { description: "Fatura bulunamadı" },
          },
        },
      },
      "/tickets": {
        get: {
          tags: ["Tickets"],
          summary: "Destek talepleri listesi",
          security,
          parameters: [
            ...paginationParams,
            {
              name: "status",
              in: "query",
              schema: {
                type: "string",
                enum: ["OPEN", "CUSTOMER_REPLY", "ADMIN_REPLY", "WAITING", "CLOSED"],
              },
            },
            {
              name: "priority",
              in: "query",
              schema: {
                type: "string",
                enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
              },
            },
            {
              name: "department",
              in: "query",
              schema: {
                type: "string",
                enum: ["GENERAL", "TECHNICAL", "BILLING", "SALES"],
              },
            },
          ],
          responses: {
            "200": {
              description: "Destek talepleri",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SuccessResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          tags: ["Tickets"],
          summary: "Yeni destek talebi oluştur",
          security,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["subject", "message"],
                  properties: {
                    subject: { type: "string" },
                    message: { type: "string" },
                    department: {
                      type: "string",
                      enum: ["GENERAL", "TECHNICAL", "BILLING", "SALES"],
                    },
                    priority: {
                      type: "string",
                      enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
                    },
                    relatedServiceId: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Oluşturulan destek talebi",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SuccessResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "422": { description: "Doğrulama hatası" },
          },
        },
      },
      "/services": {
        get: {
          tags: ["Services"],
          summary: "Hizmet listesi",
          security,
          parameters: [
            ...paginationParams,
            {
              name: "status",
              in: "query",
              schema: {
                type: "string",
                enum: ["ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"],
              },
            },
            {
              name: "category",
              in: "query",
              schema: {
                type: "string",
                enum: [
                  "hosting",
                  "vds",
                  "vps",
                  "server",
                  "cloud",
                  "datacenter",
                  "domain",
                  "ssl",
                  "email",
                ],
              },
            },
          ],
          responses: {
            "200": {
              description: "Hizmet listesi",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SuccessResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "429": { $ref: "#/components/responses/RateLimited" },
          },
        },
      },
      "/services/{id}": {
        get: {
          tags: ["Services"],
          summary: "Hizmet detayı",
          security,
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Hizmet detayı",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SuccessResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { description: "Erişim reddedildi" },
            "404": { description: "Hizmet bulunamadı" },
            "429": { $ref: "#/components/responses/RateLimited" },
          },
        },
      },
      "/orders": {
        get: {
          tags: ["Orders"],
          summary: "Sipariş listesi",
          security,
          parameters: [
            ...paginationParams,
            {
              name: "status",
              in: "query",
              schema: {
                type: "string",
                enum: [
                  "PENDING",
                  "APPROVED",
                  "PROCESSING",
                  "COMPLETED",
                  "CANCELLED",
                  "REFUNDED",
                ],
              },
            },
          ],
          responses: {
            "200": {
              description: "Sipariş listesi",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SuccessResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "429": { $ref: "#/components/responses/RateLimited" },
          },
        },
      },
      "/orders/{id}": {
        get: {
          tags: ["Orders"],
          summary: "Sipariş detayı",
          security,
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Sipariş detayı",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SuccessResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { description: "Erişim reddedildi" },
            "404": { description: "Sipariş bulunamadı" },
            "429": { $ref: "#/components/responses/RateLimited" },
          },
        },
      },
      "/domains": {
        get: {
          tags: ["Domains"],
          summary: "Domain listesi",
          security,
          parameters: [
            ...paginationParams,
            {
              name: "status",
              in: "query",
              schema: {
                type: "string",
                enum: ["ACTIVE", "EXPIRED", "TRANSFERRING", "PENDING"],
              },
            },
          ],
          responses: {
            "200": {
              description: "Domain listesi",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SuccessResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "429": { $ref: "#/components/responses/RateLimited" },
          },
        },
      },
      "/domains/{id}": {
        get: {
          tags: ["Domains"],
          summary: "Domain detayı (ID veya domain adı)",
          security,
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "Domain ID veya tam domain adı (ör. example.com)",
            },
          ],
          responses: {
            "200": {
              description: "Domain detayı",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/SuccessResponse" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "403": { description: "Erişim reddedildi" },
            "404": { description: "Domain bulunamadı" },
            "429": { $ref: "#/components/responses/RateLimited" },
          },
        },
      },
    },
  };
}

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const spec = buildOpenApiSpec(origin);

  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=300",
    },
  });
}
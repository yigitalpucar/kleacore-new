import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod/v4";
import { createCustomerAccount, updateCustomerProfile } from "@/lib/customers/admin";
import { db } from "@/lib/db";
import { ApiError, failure } from "../errors";
import { defineOperation } from "../operation";
import { keyset, pageOf, paginationQuery } from "../pagination";
import { dateTimeSchema, decimal, idParams, iso, moneySchema } from "../schemas";

const TAG = "Customers";

const customerSelect = {
  id: true,
  email: true,
  name: true,
  surname: true,
  phone: true,
  status: true,
  customerType: true,
  companyName: true,
  taxNumber: true,
  taxOffice: true,
  address: true,
  city: true,
  country: true,
  balance: true,
  emailVerifiedAt: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type CustomerRow = Prisma.UserGetPayload<{ select: typeof customerSelect }>;

export const customerSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  surname: z.string(),
  phone: z.string().nullable(),
  status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]),
  customerType: z.enum(["INDIVIDUAL", "CORPORATE"]),
  companyName: z.string().nullable(),
  taxNumber: z.string().nullable(),
  taxOffice: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  country: z.string(),
  balance: moneySchema,
  emailVerified: z.boolean(),
  lastLoginAt: dateTimeSchema.nullable(),
  createdAt: dateTimeSchema,
});

function serializeCustomer(row: CustomerRow): z.infer<typeof customerSchema> {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    surname: row.surname,
    phone: row.phone,
    status: row.status,
    customerType: row.customerType,
    companyName: row.companyName,
    taxNumber: row.taxNumber,
    taxOffice: row.taxOffice,
    address: row.address,
    city: row.city,
    country: row.country,
    balance: decimal(row.balance)!,
    emailVerified: row.emailVerifiedAt !== null,
    lastLoginAt: iso(row.lastLoginAt),
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadCustomer(id: string) {
  const row = await db.user.findFirst({ where: { id, role: "CUSTOMER" }, select: customerSelect });
  if (!row) throw new ApiError(404, "not_found", "Müşteri bulunamadı");
  return row;
}

export const listCustomers = defineOperation({
  id: "listCustomers",
  method: "GET",
  path: "/customers",
  tag: TAG,
  summary: "Müşterileri listele / ara",
  description: "En yeni kayıt önce. `q` e-posta, ad, soyad, firma ve telefonda arar.",
  permission: "customers.view",
  query: z.object({
    q: z.string().trim().max(200).optional().describe("Arama metni"),
    status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]).optional(),
    ...paginationQuery,
  }),
  response: customerSchema,
  list: true,
  handler: async ({ query }) => {
    const page = keyset("createdAt", query);
    const search: Prisma.UserWhereInput = query.q
      ? {
          OR: ["email", "name", "surname", "companyName", "phone"].map((field) => ({
            [field]: { contains: query.q, mode: "insensitive" },
          })),
        }
      : {};
    const rows = await db.user.findMany({
      where: { AND: [{ role: "CUSTOMER" }, query.status ? { status: query.status } : {}, search, page.where] },
      orderBy: page.orderBy,
      take: page.take,
      select: customerSelect,
    });
    const { items, pagination } = pageOf(rows, query.limit, (row) => row.createdAt);
    return { data: items.map(serializeCustomer), pagination };
  },
});

export const getCustomer = defineOperation({
  id: "getCustomer",
  method: "GET",
  path: "/customers/{id}",
  tag: TAG,
  summary: "Müşteri detayı",
  description: "Müşteri bilgileri + hizmet / açık fatura / açık talep sayıları.",
  permission: "customers.view",
  params: idParams,
  response: customerSchema.extend({
    counts: z.object({ services: z.number().int(), activeServices: z.number().int(), domains: z.number().int(), openInvoices: z.number().int(), openTickets: z.number().int() }),
    outstanding: moneySchema.describe("Ödenmemiş faturaların kalan toplamı"),
  }),
  handler: async ({ params }) => {
    const row = await loadCustomer(params.id);
    const [services, activeServices, domains, openInvoices, openTickets, outstanding] = await Promise.all([
      db.service.count({ where: { customerId: row.id } }),
      db.service.count({ where: { customerId: row.id, status: "ACTIVE" } }),
      db.domain.count({ where: { customerId: row.id } }),
      db.invoice.count({ where: { customerId: row.id, status: { in: ["PENDING", "OVERDUE"] } } }),
      db.supportTicket.count({ where: { customerId: row.id, status: { not: "CLOSED" } } }),
      db.invoice.aggregate({
        where: { customerId: row.id, status: { in: ["PENDING", "OVERDUE"] } },
        _sum: { totalAmount: true, paidAmount: true },
      }),
    ]);
    const open = decimal(outstanding._sum.totalAmount ?? 0)!;
    const paid = decimal(outstanding._sum.paidAmount ?? 0)!;
    return {
      data: {
        ...serializeCustomer(row),
        counts: { services, activeServices, domains, openInvoices, openTickets },
        outstanding: (Number(open) - Number(paid)).toFixed(2),
      },
    };
  },
});

const profileFields = {
  phone: z.string().trim().max(40).nullable().optional(),
  customerType: z.enum(["INDIVIDUAL", "CORPORATE"]).optional(),
  companyName: z.string().trim().max(200).nullable().optional(),
  taxNumber: z.string().trim().max(20).nullable().optional(),
  taxOffice: z.string().trim().max(100).nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
};

export const createCustomer = defineOperation({
  id: "createCustomer",
  method: "POST",
  path: "/customers",
  tag: TAG,
  summary: "Müşteri oluştur",
  description:
    "E-posta doğrulanmış sayılır (yönetici oluşturdu). `password` verilmezse rastgele bir şifre atanır; müşteri \"şifremi unuttum\" ile belirler. Idempotency-Key önerilir.",
  permission: "customers.edit",
  body: z.object({
    email: z.email().max(254),
    password: z.string().min(8).max(200).optional(),
    name: z.string().trim().min(1).max(100),
    surname: z.string().trim().max(100).optional(),
    ...profileFields,
  }),
  response: customerSchema,
  successStatus: 201,
  handler: async ({ body, context }) => {
    const result = await createCustomerAccount(context.owner.id, {
      ...body,
      password: body.password ?? randomBytes(24).toString("base64url"),
    });
    if (!result.success) throw failure(result);
    return { data: serializeCustomer(await loadCustomer(result.data.id)) };
  },
});

export const updateCustomer = defineOperation({
  id: "updateCustomer",
  method: "PATCH",
  path: "/customers/{id}",
  tag: TAG,
  summary: "Müşteri bilgilerini güncelle",
  description: "Yalnızca gönderilen alanlar değişir; `null` alanı temizler. E-posta ve şifre bu uçtan değiştirilmez.",
  permission: "customers.edit",
  params: idParams,
  body: z
    .object({
      name: z.string().trim().min(1).max(100).optional(),
      surname: z.string().trim().min(1).max(100).optional(),
      ...profileFields,
    })
    .refine((value) => Object.keys(value).length > 0, "En az bir alan gönderin"),
  response: customerSchema,
  handler: async ({ params, body }) => {
    await loadCustomer(params.id);
    const result = await updateCustomerProfile(params.id, body);
    if (!result.success) throw failure(result);
    return { data: serializeCustomer(await loadCustomer(params.id)) };
  },
});

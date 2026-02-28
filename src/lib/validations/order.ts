import { z } from "zod";

export const orderCreateSchema = z.object({
  customerId: z.string().min(1),
  productId: z.string().min(1),
  domain: z.string().optional(),
  billingPeriod: z
    .enum(["monthly", "quarterly", "semiannual", "yearly", "biennial", "triennial"])
    .optional(),
  quantity: z.number().min(1).optional(),
  customerNotes: z.string().optional(),
  promoCode: z.string().optional(),
});

export const orderStatusUpdateSchema = z.object({
  status: z.enum([
    "PENDING",
    "APPROVED",
    "PROCESSING",
    "COMPLETED",
    "CANCELLED",
    "REFUNDED",
  ]),
  adminNotes: z.string().optional(),
  cancellationReason: z.string().optional(),
});

export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type OrderStatusUpdateInput = z.infer<typeof orderStatusUpdateSchema>;

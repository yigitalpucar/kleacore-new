import { z } from "zod";

export const serviceCreateSchema = z.object({
  customerId: z.string().min(1, "Musteri seciniz"),
  productId: z.string().min(1, "Urun seciniz"),
  label: z.string().optional(),
  domain: z.string().optional(),
  username: z.string().optional(),
  ipAddress: z.string().optional(),
  serverName: z.string().optional(),
  billingPeriod: z
    .enum(["monthly", "quarterly", "semiannual", "yearly", "biennial", "triennial"])
    .optional(),
  amount: z.number().min(0, "Tutar negatif olamaz").optional(),
  nextDueDate: z.string().optional(),
  expiresAt: z.string().optional(),
  diskLimit: z.number().int().min(0).optional(),
  bandwidthLimit: z.number().int().min(0).optional(),
});

export const serviceSuspendSchema = z.object({
  id: z.string().min(1, "Hizmet ID gerekli"),
  reason: z.string().min(1, "Askiya alma nedeni bos olamaz"),
});

export const serviceIdSchema = z.object({
  id: z.string().min(1, "Hizmet ID gerekli"),
});

export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;
export type ServiceSuspendInput = z.infer<typeof serviceSuspendSchema>;
export type ServiceIdInput = z.infer<typeof serviceIdSchema>;

import { z } from "zod";
import { DATA_REQUEST_TYPES } from "@/lib/privacy/labels";

const details = z
  .string()
  .trim()
  .min(10, "Talebinizi en az 10 karakterle açıklayın")
  .max(5000, "Açıklama en fazla 5000 karakter olabilir");

export const panelDataRequestSchema = z.object({
  type: z.enum(DATA_REQUEST_TYPES, { errorMap: () => ({ message: "Talep türünü seçin" }) }),
  details,
});

export const publicDataRequestSchema = panelDataRequestSchema.extend({
  name: z.string().trim().min(3, "Adınızı ve soyadınızı girin").max(120),
  email: z.string().trim().email("Geçerli bir e-posta adresi girin").max(254),
  phone: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((value) => value || undefined),
  confirm: z.literal("true", { errorMap: () => ({ message: "Beyanı onaylayın" }) }),
});

export const dataRequestResponseSchema = z.object({
  outcome: z.enum(["COMPLETED", "REJECTED"]),
  responseText: z.string().trim().min(10, "Yanıt metni çok kısa").max(10000),
});

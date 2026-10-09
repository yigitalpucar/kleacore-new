import { z } from "zod";
import { audienceFilterSchema } from "./audience";
import { MAX_BODY, MAX_SMS, MAX_SUBJECT, validateBroadcastContent } from "./content";

/** Compose form (/yonetim/duyurular/yeni) → Broadcast row. */
export const broadcastInputSchema = z
  .object({
    kind: z.enum(["SERVICE", "MARKETING"], { errorMap: () => ({ message: "Duyuru türünü seçin" }) }),
    subject: z.string().trim().min(3, "Konu en az 3 karakter olmalı").max(MAX_SUBJECT, `Konu en fazla ${MAX_SUBJECT} karakter olabilir`),
    bodyHtml: z.string().trim().min(1, "E-posta metni boş olamaz").max(MAX_BODY, "E-posta metni çok uzun"),
    bodyText: z.string().max(MAX_BODY, "Düz metin çok uzun").default(""),
    smsText: z.string().trim().max(MAX_SMS, `SMS en fazla ${MAX_SMS} karakter olabilir`).default(""),
    channels: z.array(z.enum(["EMAIL", "SMS"])).min(1, "En az bir kanal seçin"),
    audience: audienceFilterSchema,
  })
  .superRefine((value, ctx) => {
    if (value.channels.includes("SMS") && !value.smsText.trim()) {
      ctx.addIssue({ code: "custom", path: ["smsText"], message: "SMS kanalı için SMS metni yazın" });
    }
    for (const error of validateBroadcastContent(value)) {
      ctx.addIssue({ code: "custom", path: [error.field], message: error.message });
    }
  });

export type BroadcastInput = z.input<typeof broadcastInputSchema>;
export type ParsedBroadcastInput = z.output<typeof broadcastInputSchema>;

const isoDate = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Geçerli bir tarih girin");

/** "Sistem durumu olayı olarak da yayınla": maintenance window on a status page component. */
export const incidentOptionSchema = z
  .object({
    componentId: z.string().min(1, "Durum sayfası bileşenini seçin"),
    start: isoDate,
    end: isoDate,
  })
  .refine((value) => Date.parse(value.end) > Date.parse(value.start), {
    message: "Bakım bitişi başlangıçtan sonra olmalı",
    path: ["end"],
  });

export const startOptionsSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("draft") }),
  z.object({ mode: z.literal("now"), incident: incidentOptionSchema.optional() }),
  z.object({
    mode: z.literal("schedule"),
    scheduledAt: isoDate,
    incident: incidentOptionSchema.optional(),
  }),
]);

export type StartOptions = z.input<typeof startOptionsSchema>;

export function firstError(error: z.ZodError, fallback = "Geçersiz bilgiler") {
  return error.errors[0]?.message ?? fallback;
}

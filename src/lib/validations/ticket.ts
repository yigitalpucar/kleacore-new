import { z } from "zod";

export const ticketCreateSchema = z.object({
  subject: z.string().min(5, "Konu en az 5 karakter olmalı"),
  department: z.enum(["GENERAL", "TECHNICAL", "BILLING", "SALES"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  message: z.string().min(10, "Mesaj en az 10 karakter olmalı"),
  relatedServiceId: z.string().optional(),
});

export const ticketMessageCreateSchema = z.object({
  message: z.string().min(1, "Mesaj boş olamaz"),
});

export type TicketCreateInput = z.infer<typeof ticketCreateSchema>;
export type TicketMessageCreateInput = z.infer<typeof ticketMessageCreateSchema>;

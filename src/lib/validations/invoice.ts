import { z } from "zod";

export const invoiceItemSchema = z.object({
  description: z.string().min(1, "Kalem aciklamasi bos olamaz"),
  quantity: z.number().int().min(1, "Miktar en az 1 olmali"),
  unitPrice: z.number().min(0, "Birim fiyat negatif olamaz"),
  totalPrice: z.number().min(0, "Toplam fiyat negatif olamaz"),
});

export const invoiceCreateSchema = z.object({
  customerId: z.string().min(1, "Musteri seciniz"),
  orderId: z.string().optional(),
  subtotal: z.number().min(0, "Ara toplam negatif olamaz"),
  taxRate: z.number().min(0).max(100).optional(),
  taxAmount: z.number().min(0, "Vergi tutari negatif olamaz"),
  totalAmount: z.number().min(0, "Toplam tutar negatif olamaz"),
  dueDate: z.string().min(1, "Son odeme tarihi gerekli"),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, "En az bir fatura kalemi gerekli"),
});

export const invoiceIdSchema = z.object({
  id: z.string().min(1, "Fatura ID gerekli"),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>;
export type InvoiceIdInput = z.infer<typeof invoiceIdSchema>;

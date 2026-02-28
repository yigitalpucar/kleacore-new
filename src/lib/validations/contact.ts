import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(2, "Ad en az 2 karakter olmali"),
  email: z.string().email("Gecerli bir e-posta adresi girin"),
  phone: z.string().optional(),
  subject: z.string().min(2, "Konu en az 2 karakter olmali"),
  message: z.string().min(10, "Mesaj en az 10 karakter olmali"),
});

export type ContactInput = z.infer<typeof contactSchema>;

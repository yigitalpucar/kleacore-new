import { z } from "zod";

export const profileUpdateSchema = z.object({
  name: z.string().min(2, "Ad en az 2 karakter olmalı"),
  surname: z.string().min(2, "Soyad en az 2 karakter olmalı"),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  companyName: z.string().optional(),
  taxNumber: z.string().optional(),
  taxOffice: z.string().optional(),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Mevcut şifrenizi girin"),
    newPassword: z.string().min(6, "Yeni şifre en az 6 karakter olmalı"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
  });

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

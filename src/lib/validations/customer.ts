import { z } from "zod";
import { passwordSchema } from "@/lib/validations/auth";

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
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
  });

export const apiKeyCreateSchema = z.object({
  name: z
    .string()
    .min(1, "Anahtar adı gerekli")
    .max(100, "Anahtar adı en fazla 100 karakter olabilir"),
});

export const apiKeyIdSchema = z.object({
  id: z.string().min(1, "Geçersiz API anahtarı"),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateSchema>;
export type ApiKeyIdInput = z.infer<typeof apiKeyIdSchema>;

import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin"),
  password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "Ad en az 2 karakter olmalı"),
    surname: z.string().min(2, "Soyad en az 2 karakter olmalı"),
    email: z.string().email("Geçerli bir e-posta adresi girin"),
    phone: z.string().optional(),
    password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
  });

export const passwordResetRequestSchema = z.object({
  email: z.string().email("Geçerli bir e-posta adresi girin"),
});

export const passwordResetSchema = z
  .object({
    token: z.string().min(1, "Geçersiz şifre sıfırlama bağlantısı"),
    password: z.string().min(6, "Şifre en az 6 karakter olmalı"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

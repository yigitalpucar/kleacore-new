import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalı")
  .regex(/[a-z]/, "Şifre en az bir küçük harf içermeli")
  .regex(/[A-Z]/, "Şifre en az bir büyük harf içermeli")
  .regex(/[0-9]/, "Şifre en az bir rakam içermeli");

export const emailSchema = z
  .string({ required_error: "E-posta gerekli", invalid_type_error: "Geçerli bir e-posta adresi girin" })
  .trim()
  .toLowerCase()
  .max(254, "E-posta adresi çok uzun")
  .email("Geçerli bir e-posta adresi girin");

const personNameSchema = (label: string) =>
  z
    .string({ required_error: `${label} gerekli`, invalid_type_error: `${label} geçersiz` })
    .trim()
    .min(2, `${label} en az 2 karakter olmalı`)
    .max(80, `${label} en fazla 80 karakter olabilir`);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Şifre gerekli"),
});

export const registerSchema = z
  .object({
    name: personNameSchema("Ad"),
    surname: personNameSchema("Soyad"),
    email: emailSchema,
    phone: z.string().trim().max(32, "Telefon numarası çok uzun").optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Şifreler eşleşmiyor",
    path: ["confirmPassword"],
  });

/** JSON body of POST /api/auth/register. */
export const registerApiSchema = z.object({
  name: personNameSchema("Ad"),
  surname: personNameSchema("Soyad"),
  email: emailSchema,
  password: passwordSchema,
});

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordResetSchema = z
  .object({
    token: z.string().min(1, "Geçersiz şifre sıfırlama bağlantısı"),
    password: passwordSchema,
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
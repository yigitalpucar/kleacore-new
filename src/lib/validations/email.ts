import { z } from "zod";

const LOCAL_PART_REGEX = /^[a-z0-9._-]+$/i;
const DOMAIN_REGEX =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export const emailAccountCreateSchema = z.object({
  localPart: z
    .string()
    .min(2, "Kullanici adi en az 2 karakter olmali")
    .max(64, "Kullanici adi en fazla 64 karakter olmali")
    .regex(
      LOCAL_PART_REGEX,
      "Kullanici adi sadece harf, sayi, nokta, tire ve alt cizgi icerebilir"
    ),
  domain: z
    .string()
    .min(1, "Domain seciniz")
    .regex(DOMAIN_REGEX, "Gecerli bir domain girin"),
  quotaMb: z
    .number()
    .int()
    .refine((v) => [512, 1024, 2048, 5120, 10240].includes(v), {
      message: "Gecersiz kota degeri",
    })
    .optional(),
});

export const emailAccountStatusSchema = z.object({
  accountId: z.string().min(1, "Hesap ID gerekli"),
  status: z.enum(["ACTIVE", "SUSPENDED"], {
    required_error: "Durum degeri gerekli",
  }),
});

export const emailAccountIdSchema = z.object({
  accountId: z.string().min(1, "Hesap ID gerekli"),
});

export const emailMessageIdSchema = z.object({
  emailId: z.string().min(1, "E-posta ID gerekli"),
});

export type EmailAccountCreateInput = z.infer<typeof emailAccountCreateSchema>;
export type EmailAccountStatusInput = z.infer<typeof emailAccountStatusSchema>;
export type EmailAccountIdInput = z.infer<typeof emailAccountIdSchema>;
export type EmailMessageIdInput = z.infer<typeof emailMessageIdSchema>;

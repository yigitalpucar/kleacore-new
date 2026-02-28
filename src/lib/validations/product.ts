import { z } from "zod";

export const productCreateSchema = z.object({
  categoryId: z.string().min(1, "Kategori seçiniz"),
  sku: z.string().min(1, "SKU gerekli"),
  name: z.string().min(2, "Ürün adı en az 2 karakter olmalı"),
  slug: z.string().min(2, "Slug gerekli"),
  shortDescription: z.string().optional(),
  longDescription: z.string().optional(),
  features: z.any().optional(),
  includedFeatures: z.any().optional(),
  resourceLimits: z.any().optional(),
  basePrice: z.number().min(0),
  badge: z.string().optional(),
  isPopular: z.boolean().optional(),
  displayOrder: z.number().optional(),
  stockQuantity: z.number().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "DRAFT", "ARCHIVED"]).optional(),
  isVisible: z.boolean().optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
});

export const categoryCreateSchema = z.object({
  slug: z.enum(["hosting", "vds", "vps", "server", "domain", "ssl", "email"]),
  name: z.string().min(2),
  description: z.string().optional(),
  icon: z.string().optional(),
  displayOrder: z.number().optional(),
  isActive: z.boolean().optional(),
});

export const promotionCreateSchema = z.object({
  code: z.string().min(3, "Kod en az 3 karakter olmalı"),
  name: z.string().min(2),
  description: z.string().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().min(0),
  maxUses: z.number().min(0).optional(),
  maxUsesPerCustomer: z.number().min(1).optional(),
  validFrom: z.string(),
  validUntil: z.string(),
  minOrderAmount: z.number().optional(),
  isFirstOrderOnly: z.boolean().optional(),
  isNewCustomerOnly: z.boolean().optional(),
});

export const productFeatureCreateSchema = z.object({
  categoryId: z.enum(["hosting", "vds", "vps", "server", "domain", "ssl", "email"]),
  name: z.string().min(2, "Özellik adı en az 2 karakter olmalı"),
  slug: z
    .string()
    .min(2, "Slug en az 2 karakter olmalı")
    .regex(/^[a-z0-9-]+$/, "Slug sadece küçük harf, sayı ve tire içerebilir"),
  unit: z.string().max(32).optional(),
  icon: z.string().max(64).optional(),
  isHighlighted: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type PromotionCreateInput = z.infer<typeof promotionCreateSchema>;
export type ProductFeatureCreateInput = z.infer<typeof productFeatureCreateSchema>;

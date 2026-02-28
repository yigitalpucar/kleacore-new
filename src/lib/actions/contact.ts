"use server";

import { db } from "@/lib/db";
import { contactSchema } from "@/lib/validations/contact";
import { z } from "zod";

export async function submitContactForm(formData: FormData) {
  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    phone: (formData.get("phone") as string) || undefined,
    subject: formData.get("subject") as string,
    message: formData.get("message") as string,
  };

  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Gecersiz bilgiler",
    };
  }

  try {
    await db.contactMessage.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        subject: parsed.data.subject,
        message: parsed.data.message,
      },
    });

    return { success: true };
  } catch {
    return { success: false, error: "Mesaj gönderilirken bir hata oluştu" };
  }
}

const newsletterSchema = z.object({
  email: z.string().email("Gecerli bir e-posta adresi girin"),
  source: z.enum(["blog", "system-status"]).default("blog"),
});

const newsletterSourceLabels: Record<z.infer<typeof newsletterSchema>["source"], string> = {
  blog: "Blog Bulteni",
  "system-status": "Sistem Durum Bildirimleri",
};

export async function subscribeNewsletter(email: string, source: "blog" | "system-status" = "blog") {
  const parsed = newsletterSchema.safeParse({ email, source });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Gecersiz bilgiler",
    };
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const sourceLabel = newsletterSourceLabels[parsed.data.source];

  try {
    const existingSubscription = await db.contactMessage.findFirst({
      where: {
        email: normalizedEmail,
        subject: `Abonelik: ${sourceLabel}`,
      },
      select: { id: true },
    });

    if (existingSubscription) {
      return {
        success: true,
        message: "Bu e-posta adresi zaten abone.",
      };
    }

    await db.contactMessage.create({
      data: {
        name: "Newsletter Subscriber",
        email: normalizedEmail,
        subject: `Abonelik: ${sourceLabel}`,
        message: `${sourceLabel} icin abonelik talebi alindi.`,
      },
    });

    return {
      success: true,
      message: "Abonelik basariyla tamamlandi.",
    };
  } catch {
    return {
      success: false,
      error: "Abonelik islenirken bir hata olustu",
    };
  }
}

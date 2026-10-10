/**
 * First-login checklist on the customer panel home: e-mail verified →
 * profile/billing details → first service → 2FA. Conditions come from the
 * real account (users / services rows); the customer can hide the list
 * (users.onboardingDismissedAt) and it disappears by itself when complete.
 */
import { db } from "@/lib/db";
import { isTwoFactorGloballyEnabled } from "@/lib/auth/two-factor-settings";

export type OnboardingStepId = "email" | "profile" | "service" | "twoFactor";

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  done: boolean;
  /** Where to do it (null when the step has an inline action instead, e.g. resend e-mail). */
  href: string | null;
  cta: string;
}

export interface OnboardingUser {
  name: string | null;
  surname: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  customerType: string;
  companyName: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
  emailVerifiedAt: Date | null;
  twoFactorEnabled: boolean;
}

const filled = (value: string | null | undefined) => Boolean(value && value.trim());

/** Fields an invoice needs; corporate customers also need company + tax details. */
export function missingBillingFields(user: OnboardingUser): string[] {
  const missing: string[] = [];
  if (!filled(user.name) || !filled(user.surname)) missing.push("ad soyad");
  if (!filled(user.phone)) missing.push("telefon");
  if (!filled(user.address) || !filled(user.city)) missing.push("adres");
  if (user.customerType === "CORPORATE") {
    if (!filled(user.companyName)) missing.push("şirket adı");
    if (!filled(user.taxNumber) || !filled(user.taxOffice)) missing.push("vergi bilgileri");
  }
  return missing;
}

export function buildOnboardingSteps(
  user: OnboardingUser,
  context: { serviceCount: number; twoFactorAvailable: boolean }
): OnboardingStep[] {
  const missing = missingBillingFields(user);
  const steps: OnboardingStep[] = [
    {
      id: "email",
      title: "E-posta adresinizi doğrulayın",
      description: "Sipariş verebilmek ve ödeme yapabilmek için e-postanızdaki bağlantıya tıklayın.",
      done: Boolean(user.emailVerifiedAt),
      href: null,
      cta: "Doğrulama e-postasını gönder",
    },
    {
      id: "profile",
      title: "Profil ve fatura bilgilerinizi tamamlayın",
      description: missing.length
        ? `Faturalarınızın doğru düzenlenmesi için eksik bilgiler: ${missing.join(", ")}.`
        : "Faturalarınız bu bilgilerle düzenlenir.",
      done: missing.length === 0,
      href: "/musteri/panel/ayarlar",
      cta: "Bilgileri tamamla",
    },
    {
      id: "service",
      title: "İlk hizmetinizi alın",
      description: "Hosting, sunucu, alan adı veya SSL paketlerinden birini seçerek başlayın.",
      done: context.serviceCount > 0,
      href: "/hosting/linux",
      cta: "Paketleri incele",
    },
  ];
  if (context.twoFactorAvailable || user.twoFactorEnabled) {
    steps.push({
      id: "twoFactor",
      title: "İki adımlı doğrulamayı açın",
      description: "Girişte telefonunuzdaki kod da sorulur; şifreniz ele geçse bile hesabınız korunur.",
      done: user.twoFactorEnabled,
      href: "/musteri/panel/ayarlar?sekme=guvenlik",
      cta: "2FA'yı aç",
    });
  }
  return steps;
}

export interface CustomerOnboarding {
  steps: OnboardingStep[];
  completed: number;
  total: number;
}

/** Checklist for the panel home, or null when dismissed / complete / not a customer. */
export async function getCustomerOnboarding(userId: string): Promise<CustomerOnboarding | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      name: true,
      surname: true,
      phone: true,
      address: true,
      city: true,
      customerType: true,
      companyName: true,
      taxNumber: true,
      taxOffice: true,
      emailVerifiedAt: true,
      twoFactorEnabled: true,
      onboardingDismissedAt: true,
    },
  });
  if (!user || user.role !== "CUSTOMER" || user.onboardingDismissedAt) return null;
  const [serviceCount, twoFactorAvailable] = await Promise.all([
    db.service.count({ where: { customerId: userId } }),
    isTwoFactorGloballyEnabled(),
  ]);
  const steps = buildOnboardingSteps(user, { serviceCount, twoFactorAvailable });
  const completed = steps.filter((s) => s.done).length;
  if (completed === steps.length) return null;
  return { steps, completed, total: steps.length };
}

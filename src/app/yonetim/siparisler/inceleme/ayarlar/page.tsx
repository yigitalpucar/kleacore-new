import type { Metadata } from "next";
import { PageHeader } from "@/components/app";
import { DEFAULT_RULE_WEIGHTS, FRAUD_RULE_IDS, FRAUD_RULE_LABELS } from "@/lib/fraud/rules";
import { getFraudConfig } from "@/lib/fraud/settings";
import { getKycConfig } from "@/lib/kyc/settings";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { FraudSettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "İnceleme ayarları" };

export default async function FraudSettingsPage() {
  await requirePermission("settings.manage");
  const [config, kyc] = await Promise.all([getFraudConfig(), getKycConfig()]);

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/siparisler/inceleme", label: "Sipariş incelemesi" }}
        eyebrow="Siparişler"
        title="Risk kuralları ve kimlik doğrulama"
        description="Eşleşen kuralların puanları toplanır. Toplam inceleme eşiğine ulaşırsa sipariş “İnceleme bekliyor” olur: ödeme alınabilir ama kurulum onaya kadar bekler. Engelleme eşiği (0 = kapalı) aşılırsa onaya kadar ödeme de alınmaz."
      />
      <FraudSettingsForm
        initial={{
          enabled: config.enabled,
          trustCfHeader: config.trustCfHeader,
          reviewThreshold: config.reviewThreshold,
          blockThreshold: config.blockThreshold,
          sameIpLimit: config.sameIpLimit,
          weights: config.weights,
          kycCategories: kyc.requiredCategories.join(", "),
          rejectedRetentionDays: kyc.rejectedRetentionDays,
          approvedRetentionDays: kyc.approvedRetentionDaysAfterServiceEnd,
        }}
        rules={FRAUD_RULE_IDS.map((rule) => ({ id: rule, label: FRAUD_RULE_LABELS[rule], defaultWeight: DEFAULT_RULE_WEIGHTS[rule] }))}
      />
    </>
  );
}

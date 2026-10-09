import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { DetailList, PageHeader, SectionCard, StatusBadge } from "@/components/app";
import { WaitingOrdersNotice } from "@/components/panel/waiting-orders-notice";
import { getCustomerKycView } from "@/lib/dal/review";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { KYC_DOCUMENT_LABELS, KYC_FILE_HINT, KYC_ACCEPT } from "@/lib/kyc/documents";
import { getKycConfig } from "@/lib/kyc/settings";
import { getCurrentLegalDocument } from "@/lib/legal/documents";
import { renderStaticLegalTemplate } from "@/lib/legal/render";
import { KycUploadForm } from "./upload-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Kimlik doğrulama" };

const CATEGORY_NAMES: Record<string, string> = {
  vds: "VDS",
  vps: "VPS",
  server: "fiziksel sunucu",
  cloud: "bulut sunucu",
  datacenter: "veri merkezi (colocation)",
  hosting: "hosting",
};

export default async function KimlikDogrulamaPage() {
  const session = await auth();
  const userId = session!.user.id;
  const [view, config, consent] = await Promise.all([
    getCustomerKycView(userId),
    getKycConfig(),
    getCurrentLegalDocument("KYC_CONSENT"),
  ]);
  if (!view) return null;

  const canSubmit = view.kycStatus === "NONE" || view.kycStatus === "REJECTED";
  const categories = config.requiredCategories.map((slug) => CATEGORY_NAMES[slug] ?? slug).join(", ");

  return (
    <>
      <PageHeader
        title="Kimlik doğrulama"
        description="Sunucu hizmetlerinin kurulumu için kimliğinizi bir kez doğrulamanız yeterli."
        meta={<StatusBadge kind="kyc" status={view.kycStatus} size="md" />}
      />

      <WaitingOrdersNotice userId={userId} />

      <SectionCard title="Neden istiyoruz?">
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-foreground">5651 sayılı Kanun</strong> ve ilgili yönetmelikler gereği, sunucu hizmeti
            verdiğimiz kişileri gerektiğinde yetkili makamlara bildirebilmek için tespit edebilmemiz gerekiyor. Bu nedenle{" "}
            {categories ? <strong className="text-foreground">{categories}</strong> : "sunucu"} siparişlerinde kurulum, kimlik
            doğrulamanız onaylandıktan sonra başlar. Doğrulama, sunucuların kötüye kullanımını (dolandırıcılık, saldırı, spam)
            önlememize de yardımcı olur.
          </p>
          <p>
            <strong className="text-foreground">KVKK:</strong> Belgeleriniz herkese kapalı bir alanda saklanır ve yalnızca kimlik
            doğrulama yetkisi olan personelimiz tarafından görüntülenir; her görüntüleme kayıt altına alınır. Reddedilen belgeler{" "}
            {config.rejectedRetentionDays} gün sonra otomatik olarak silinir. Onaylanan belgeler sunucu hizmetiniz sürdüğü
            sürece saklanır; son sunucu hizmetiniz sona erdikten {config.approvedRetentionDaysAfterServiceEnd} gün sonra
            dosyalar otomatik olarak silinir (yalnızca doğrulama kararının kaydı kalır). Belgelerinizi yalnızca bu amaçla kullanırız.
          </p>
          <p>
            Bireysel hesaplarda kimlik kartınızın <strong className="text-foreground">ön ve arka yüzünü</strong>, kurumsal
            hesaplarda <strong className="text-foreground">vergi levhasını</strong> (veya yetkilinin kimliğini) yükleyin.
            İsterseniz kimliğinizi elinizde tuttuğunuz bir fotoğraf ekleyerek incelemeyi hızlandırabilirsiniz. {KYC_FILE_HINT}.
          </p>
        </div>
      </SectionCard>

      {view.kycStatus === "REJECTED" && view.kycRejectionReason ? (
        <SectionCard title="Önceki başvurunuz onaylanmadı">
          <p className="text-sm">{view.kycRejectionReason}</p>
          <p className="mt-2 text-xs text-muted-foreground">Lütfen açıklamayı dikkate alarak belgelerinizi yeniden yükleyin.</p>
        </SectionCard>
      ) : null}

      {view.kycStatus === "PENDING" || view.kycStatus === "APPROVED" ? (
        <SectionCard
          title={view.kycStatus === "APPROVED" ? "Kimliğiniz doğrulandı" : "Belgeleriniz inceleniyor"}
          description={
            view.kycStatus === "APPROVED"
              ? "Sunucu siparişleriniz ek bir doğrulama beklemeden işleme alınır."
              : "İnceleme genellikle mesai saatleri içinde birkaç saat sürer. Sonucu e-postayla bildireceğiz."
          }
        >
          <DetailList
            items={[
              { label: "Gönderim", value: view.kycSubmittedAt ? formatDateTime(view.kycSubmittedAt) : null },
              { label: "Onay", value: view.kycStatus === "APPROVED" && view.kycReviewedAt ? formatDateTime(view.kycReviewedAt) : null },
              ...view.kycDocuments
                .filter((document) => !document.deleteAfter)
                .map((document) => ({
                  label: KYC_DOCUMENT_LABELS[document.type],
                  value: `${document.fileName} · ${formatDate(document.uploadedAt)}`,
                })),
            ]}
          />
        </SectionCard>
      ) : null}

      {canSubmit ? (
        <KycUploadForm
          corporate={view.customerType === "CORPORATE"}
          accept={KYC_ACCEPT}
          consent={{
            title: consent.title,
            version: consent.version,
            html: renderStaticLegalTemplate(consent.content),
          }}
        />
      ) : null}
    </>
  );
}

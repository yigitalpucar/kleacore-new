import { FormField, FormSection, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { saveSmsIntegrationSettings, testSmsConnection } from "@/lib/actions/admin/integrations";
import { FieldGrid, ToggleRow, inputClass, selectClass } from "./shared";
import type { SmsConfig } from "./types";

export function SmsSection({ sms }: { sms: SmsConfig }) {
  return (
    <form action={saveSmsIntegrationSettings} className="space-y-8">
      <FormSection title="SMS" description="Netgsm veya İleti Merkezi ile müşteri SMS bildirimleri.">
        <FieldGrid>
          <FormField label="Durum" htmlFor="sms_enabled">
            <select id="sms_enabled" name="sms_enabled" defaultValue={sms.enabled ? "true" : "false"} className={selectClass}>
              <option value="false">Pasif</option>
              <option value="true">Aktif</option>
            </select>
          </FormField>
          <FormField label="Sağlayıcı" htmlFor="sms_provider">
            <select id="sms_provider" name="sms_provider" defaultValue={sms.provider} className={selectClass}>
              <option value="disabled">Pasif</option>
              <option value="netgsm">Netgsm</option>
              <option value="iletimerkezi">İleti Merkezi</option>
            </select>
          </FormField>
        </FieldGrid>
        <ToggleRow
          title="SMS bildirimleri"
          description="Kapalıyken ödeme ve gecikmiş fatura SMS'leri gönderilmez."
          fieldName="sms_notifications"
          defaultChecked={sms.notificationsEnabled}
        />
      </FormSection>

      <FormSection title="Netgsm" description="Kullanıcı kodu, şifre ve onaylı SMS başlığı.">
        <FieldGrid>
          <FormField label="Kullanıcı kodu" htmlFor="sms_netgsm_usercode">
            <Input
              id="sms_netgsm_usercode"
              name="sms_netgsm_usercode"
              defaultValue={sms.netgsm.usercode}
              placeholder="Netgsm usercode"
              autoComplete="off"
              className={inputClass}
            />
          </FormField>
          <FormField label="Şifre" htmlFor="sms_netgsm_password">
            <Input
              id="sms_netgsm_password"
              name="sms_netgsm_password"
              type="password"
              defaultValue={sms.netgsm.hasPassword ? "********" : ""}
              autoComplete="new-password"
              className={inputClass}
            />
          </FormField>
        </FieldGrid>
        <FormField label="Başlık (header)" htmlFor="sms_netgsm_header">
          <Input
            id="sms_netgsm_header"
            name="sms_netgsm_header"
            defaultValue={sms.netgsm.header}
            placeholder="KLEACORE"
            className={inputClass}
          />
        </FormField>
      </FormSection>

      <FormSection
        title="İleti Merkezi"
        description="API anahtarı, hash ve gönderici adı."
        footer={
          <>
            <button type="submit" formAction={testSmsConnection} className={appButton({ variant: "outline" })}>
              Bağlantıyı test et
            </button>
            <button type="submit" className={appButton()}>
              Kaydet
            </button>
          </>
        }
      >
        <FieldGrid>
          <FormField label="API anahtarı" htmlFor="sms_iletimerkezi_api_key">
            <Input
              id="sms_iletimerkezi_api_key"
              name="sms_iletimerkezi_api_key"
              defaultValue={sms.iletimerkezi.apiKey}
              placeholder="API anahtarı"
              autoComplete="off"
              className={inputClass}
            />
          </FormField>
          <FormField label="API secret (hash)" htmlFor="sms_iletimerkezi_secret">
            <Input
              id="sms_iletimerkezi_secret"
              name="sms_iletimerkezi_secret"
              type="password"
              defaultValue={sms.iletimerkezi.hasSecret ? "********" : ""}
              autoComplete="new-password"
              className={inputClass}
            />
          </FormField>
        </FieldGrid>
        <FormField label="Gönderici (sender)" htmlFor="sms_iletimerkezi_sender">
          <Input
            id="sms_iletimerkezi_sender"
            name="sms_iletimerkezi_sender"
            defaultValue={sms.iletimerkezi.sender}
            placeholder="KLEACORE"
            className={inputClass}
          />
        </FormField>
      </FormSection>
    </form>
  );
}

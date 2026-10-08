import { FormField, FormSection, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { saveSslIntegrationSettings, testSslConnection } from "@/lib/actions/admin/integrations";
import { FieldGrid, Note, inputClass, selectClass } from "./shared";
import type { SslConfig } from "./types";

export function SslSection({ ssl }: { ssl: SslConfig }) {
  return (
    <form action={saveSslIntegrationSettings} className="space-y-8">
      <FormSection
        title="SSL sertifikası"
        description="Sipariş sonrası SSL sağlama: Let's Encrypt veya Sectigo."
        footer={
          <>
            <button type="submit" formAction={testSslConnection} className={appButton({ variant: "outline" })}>
              Bağlantıyı test et
            </button>
            <button type="submit" className={appButton()}>
              Kaydet
            </button>
          </>
        }
      >
        <FieldGrid>
          <FormField label="Durum" htmlFor="ssl_enabled">
            <select id="ssl_enabled" name="ssl_enabled" defaultValue={ssl.enabled ? "true" : "false"} className={selectClass}>
              <option value="false">Pasif</option>
              <option value="true">Aktif</option>
            </select>
          </FormField>
          <FormField label="Sağlayıcı" htmlFor="ssl_provider">
            <select id="ssl_provider" name="ssl_provider" defaultValue={ssl.provider} className={selectClass}>
              <option value="disabled">Pasif</option>
              <option value="letsencrypt">Let&apos;s Encrypt (ACME)</option>
              <option value="sectigo">Sectigo (Yakında)</option>
            </select>
          </FormField>
        </FieldGrid>

        <FormField label="ACME e-posta (Let's Encrypt)" htmlFor="ssl_acme_email">
          <Input
            id="ssl_acme_email"
            name="ssl_acme_email"
            type="email"
            defaultValue={ssl.acmeEmail}
            placeholder="ssl@example.com"
            className={inputClass}
          />
        </FormField>

        <FormField label="Sectigo API anahtarı" htmlFor="ssl_sectigo_api_key">
          <Input
            id="ssl_sectigo_api_key"
            name="ssl_sectigo_api_key"
            type="password"
            defaultValue={ssl.hasSectigoApiKey ? "********" : ""}
            placeholder="Sectigo API anahtarı"
            autoComplete="new-password"
            className={inputClass}
          />
        </FormField>

        <Note>
          SSL siparişleri tamamlandığında sertifika kaydı oluşturulur ve seçili sağlayıcı üzerinden sağlama başlatılır.
          Mock sağlayıcı 90 günlük test sertifikası üretir.
        </Note>
      </FormSection>
    </form>
  );
}

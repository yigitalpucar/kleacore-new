import { FormField, FormSection, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { saveVpsVdsIntegrationSettings, testVpsVdsConnection } from "@/lib/actions/admin/integrations";
import { FieldGrid, Note, inputClass, selectClass } from "./shared";
import type { VpsVdsConfig } from "./types";

export function VpsVdsSection({ vpsVds }: { vpsVds: VpsVdsConfig }) {
  return (
    <form action={saveVpsVdsIntegrationSettings} className="space-y-8">
      <FormSection
        title="VPS / VDS yönetimi"
        description="VPS, VDS, bulut ve fiziksel sunucu ürünleri için panel entegrasyonu."
      >
        <FieldGrid>
          <FormField label="Durum" htmlFor="vps_vds_enabled">
            <select
              id="vps_vds_enabled"
              name="vps_vds_enabled"
              defaultValue={vpsVds.enabled ? "true" : "false"}
              className={selectClass}
            >
              <option value="false">Pasif</option>
              <option value="true">Aktif</option>
            </select>
          </FormField>
          <FormField label="Panel" htmlFor="vps_vds_provider">
            <select
              id="vps_vds_provider"
              name="vps_vds_provider"
              defaultValue={vpsVds.provider}
              className={selectClass}
            >
              <option value="disabled">Pasif</option>
              <option value="virtualizor">Virtualizor</option>
              <option value="generic-http">Generic HTTP</option>
            </select>
          </FormField>
        </FieldGrid>
        <Note>
          Ürün SKU değeri Virtualizor plan ID (plid) olarak kullanılır. Oluşturulan VPS ID hizmet kaydının serverName
          alanına yazılır.
        </Note>
      </FormSection>

      <FormSection
        title="Panel bağlantısı"
        description="Panel adresi ve API kimlik bilgileri. Kayıtlı parola yıldızla gösterilir."
        footer={
          <>
            <button type="submit" formAction={testVpsVdsConnection} className={appButton({ variant: "outline" })}>
              Bağlantıyı test et
            </button>
            <button type="submit" className={appButton()}>
              Kaydet
            </button>
          </>
        }
      >
        <FormField label="Panel URL" htmlFor="vps_vds_api_url">
          <Input
            id="vps_vds_api_url"
            name="vps_vds_api_url"
            defaultValue={vpsVds.apiUrl}
            placeholder="https://panel.example.com:4085"
            className={inputClass}
          />
        </FormField>
        <FieldGrid>
          <FormField label="API anahtarı" htmlFor="vps_vds_api_key">
            <Input
              id="vps_vds_api_key"
              name="vps_vds_api_key"
              type="password"
              defaultValue={vpsVds.apiKey}
              placeholder="Virtualizor API Key"
              autoComplete="new-password"
              className={inputClass}
            />
          </FormField>
          <FormField label="API parolası" htmlFor="vps_vds_api_password">
            <Input
              id="vps_vds_api_password"
              name="vps_vds_api_password"
              type="password"
              defaultValue={vpsVds.hasApiPassword ? "********" : ""}
              placeholder="Virtualizor API Password"
              autoComplete="new-password"
              className={inputClass}
            />
          </FormField>
        </FieldGrid>
        <FormField label="API kullanıcı adı" htmlFor="vps_vds_api_username" hint="İsteğe bağlı; Generic HTTP için.">
          <Input
            id="vps_vds_api_username"
            name="vps_vds_api_username"
            defaultValue={vpsVds.apiUsername}
            placeholder="Generic HTTP için"
            autoComplete="off"
            className={inputClass}
          />
        </FormField>
      </FormSection>
    </form>
  );
}

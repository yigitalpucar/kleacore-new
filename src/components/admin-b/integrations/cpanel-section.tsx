import { FormField, FormSection, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { saveCpanelWhmIntegrationSettings, testCpanelWhmConnection } from "@/lib/actions/admin/integrations";
import { FieldGrid, Note, inputClass, selectClass } from "./shared";
import type { CpanelConfig } from "./types";

export function CpanelSection({ cpanel }: { cpanel: CpanelConfig }) {
  return (
    <form action={saveCpanelWhmIntegrationSettings} className="space-y-8">
      <FormSection
        title="cPanel / WHM"
        description="Hosting ve e-posta ürünleri için WHM API ile hesap yönetimi."
      >
        <FieldGrid>
          <FormField label="Durum" htmlFor="cpanel_enabled">
            <select
              id="cpanel_enabled"
              name="cpanel_enabled"
              defaultValue={cpanel.enabled ? "true" : "false"}
              className={selectClass}
            >
              <option value="false">Pasif</option>
              <option value="true">Aktif</option>
            </select>
          </FormField>
          <FormField label="Varsayılan paket" htmlFor="cpanel_default_plan">
            <Input
              id="cpanel_default_plan"
              name="cpanel_default_plan"
              defaultValue={cpanel.defaultPlan}
              placeholder="default"
              className={inputClass}
            />
          </FormField>
          <FormField label="SSL kullan" htmlFor="cpanel_use_ssl">
            <select
              id="cpanel_use_ssl"
              name="cpanel_use_ssl"
              defaultValue={cpanel.useSsl ? "true" : "false"}
              className={selectClass}
            >
              <option value="true">Evet (önerilen)</option>
              <option value="false">Hayır</option>
            </select>
          </FormField>
          <FormField label="Yedekleme" htmlFor="backup_enabled">
            <select
              id="backup_enabled"
              name="backup_enabled"
              defaultValue={cpanel.backupEnabled ? "true" : "false"}
              className={selectClass}
            >
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </select>
          </FormField>
        </FieldGrid>
        <Note>
          Ürün SKU değeri WHM paket adı olarak kullanılır. Hosting ve e-posta kategorilerinde otomatik tetiklenir.
        </Note>
      </FormSection>

      <FormSection
        title="Sunucu bağlantısı"
        description="WHM sunucu adresi ve API token. Kayıtlı token yıldızla gösterilir."
        footer={
          <>
            <button type="submit" formAction={testCpanelWhmConnection} className={appButton({ variant: "outline" })}>
              Bağlantıyı test et
            </button>
            <button type="submit" className={appButton()}>
              Kaydet
            </button>
          </>
        }
      >
        <FieldGrid>
          <FormField label="WHM host" htmlFor="cpanel_host">
            <Input
              id="cpanel_host"
              name="cpanel_host"
              defaultValue={cpanel.host}
              placeholder="whm.example.com"
              className={inputClass}
            />
          </FormField>
          <FormField label="Port" htmlFor="cpanel_port">
            <Input
              id="cpanel_port"
              name="cpanel_port"
              defaultValue={cpanel.port}
              placeholder="2087"
              inputMode="numeric"
              className={inputClass}
            />
          </FormField>
          <FormField label="WHM kullanıcı adı" htmlFor="cpanel_username">
            <Input
              id="cpanel_username"
              name="cpanel_username"
              defaultValue={cpanel.username}
              placeholder="root"
              autoComplete="off"
              className={inputClass}
            />
          </FormField>
          <FormField label="API token" htmlFor="cpanel_api_token">
            <Input
              id="cpanel_api_token"
              name="cpanel_api_token"
              type="password"
              defaultValue={cpanel.hasApiToken ? "********" : ""}
              autoComplete="new-password"
              className={inputClass}
            />
          </FormField>
        </FieldGrid>
      </FormSection>
    </form>
  );
}

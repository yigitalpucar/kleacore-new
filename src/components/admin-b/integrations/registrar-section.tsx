import { RefreshCw } from "lucide-react";
import { FormField, FormSection, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import {
  importGriTldPricingFromIntegrations,
  saveRegistrarIntegrationSettings,
  testRegistrarConnection,
} from "@/lib/actions/admin/integrations";
import { FieldGrid, inputClass, selectClass } from "./shared";
import type { RegistrarConfig } from "./types";

export function RegistrarSection({ registrar }: { registrar: RegistrarConfig }) {
  return (
    <form action={saveRegistrarIntegrationSettings} className="space-y-8">
      <FormSection
        title="Domain registrar"
        description="Domain kayıt, nameserver ve DNS işlemleri için sağlayıcı bağlantısı."
      >
        <FieldGrid>
          <FormField label="Durum" htmlFor="registrar_enabled">
            <select
              id="registrar_enabled"
              name="registrar_enabled"
              defaultValue={registrar.enabled ? "true" : "false"}
              className={selectClass}
            >
              <option value="false">Pasif</option>
              <option value="true">Aktif</option>
            </select>
          </FormField>
          <FormField label="Sağlayıcı" htmlFor="registrar_provider">
            <select
              id="registrar_provider"
              name="registrar_provider"
              defaultValue={registrar.provider}
              className={selectClass}
            >
              <option value="disabled">Pasif</option>
              <option value="gri">Gri (B2B API)</option>
              <option value="generic-http">Generic HTTP</option>
            </select>
          </FormField>
          <FormField label="Ortam" htmlFor="registrar_test_mode">
            <select
              id="registrar_test_mode"
              name="registrar_test_mode"
              defaultValue={registrar.testMode ? "true" : "false"}
              className={selectClass}
            >
              <option value="false">Canlı (production)</option>
              <option value="true">Sandbox</option>
            </select>
          </FormField>
          <FormField label="API URL" htmlFor="registrar_api_url" hint="İsteğe bağlı. Boş bırakılırsa Gri varsayılan URL kullanılır.">
            <Input
              id="registrar_api_url"
              name="registrar_api_url"
              defaultValue={registrar.apiUrl}
              placeholder="Boş = Gri varsayılan URL"
              className={inputClass}
            />
          </FormField>
        </FieldGrid>
      </FormSection>

      <FormSection
        title="Kimlik bilgileri"
        description="Kayıtlı parolalar ve gizli anahtarlar yıldızla gösterilir; değiştirmezseniz korunur."
        footer={
          <>
            {registrar.provider === "gri" && (
              <button
                type="submit"
                formAction={importGriTldPricingFromIntegrations}
                className={appButton({ variant: "outline" })}
              >
                <RefreshCw aria-hidden />
                Gri TLD fiyatlarını içe aktar
              </button>
            )}
            <button type="submit" formAction={testRegistrarConnection} className={appButton({ variant: "outline" })}>
              Bağlantıyı test et
            </button>
            <button type="submit" className={appButton()}>
              Kaydet
            </button>
          </>
        }
      >
        <FieldGrid>
          <FormField label="Kullanıcı adı" htmlFor="registrar_username">
            <Input
              id="registrar_username"
              name="registrar_username"
              defaultValue={registrar.username}
              autoComplete="off"
              className={inputClass}
            />
          </FormField>
          <FormField label="Parola" htmlFor="registrar_password">
            <Input
              id="registrar_password"
              name="registrar_password"
              type="password"
              defaultValue={registrar.hasPassword ? "********" : ""}
              autoComplete="new-password"
              className={inputClass}
            />
          </FormField>
          <FormField label="Client ID" htmlFor="registrar_client_id">
            <Input
              id="registrar_client_id"
              name="registrar_client_id"
              defaultValue={registrar.clientId}
              autoComplete="off"
              className={inputClass}
            />
          </FormField>
          <FormField label="Client secret" htmlFor="registrar_client_secret">
            <Input
              id="registrar_client_secret"
              name="registrar_client_secret"
              type="password"
              defaultValue={registrar.hasClientSecret ? "********" : ""}
              autoComplete="new-password"
              className={inputClass}
            />
          </FormField>
        </FieldGrid>
        <FormField label="Generic HTTP API anahtarı" htmlFor="registrar_api_key" hint="Yalnızca Generic HTTP sağlayıcısı için.">
          <Input
            id="registrar_api_key"
            name="registrar_api_key"
            type="password"
            defaultValue={registrar.apiKey}
            placeholder="Sadece generic-http için"
            autoComplete="new-password"
            className={inputClass}
          />
        </FormField>
      </FormSection>
    </form>
  );
}

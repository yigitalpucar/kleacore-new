import Link from "next/link";
import { FormField, FormSection, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { saveEfaturaIntegrationSettings, testEfaturaConnection } from "@/lib/actions/admin/integrations";
import { FieldGrid, Note, inputClass, selectClass } from "./shared";
import type { EfaturaConfig } from "./types";

export function EfaturaSection({ efatura }: { efatura: EfaturaConfig }) {
  return (
    <form action={saveEfaturaIntegrationSettings} className="space-y-8">
      <FormSection
        title="E-Fatura / E-Arşiv"
        description="Ödenen faturalar için UBL-TR taslak oluşturma ve gönderim."
        footer={
          <>
            <button type="submit" formAction={testEfaturaConnection} className={appButton({ variant: "outline" })}>
              Bağlantıyı test et
            </button>
            <button type="submit" className={appButton()}>
              Kaydet
            </button>
          </>
        }
      >
        <FieldGrid>
          <FormField label="Durum" htmlFor="efatura_enabled">
            <select
              id="efatura_enabled"
              name="efatura_enabled"
              defaultValue={efatura.enabled ? "true" : "false"}
              className={selectClass}
            >
              <option value="false">Pasif</option>
              <option value="true">Aktif</option>
            </select>
          </FormField>
          <FormField label="Sağlayıcı" htmlFor="efatura_provider">
            <select
              id="efatura_provider"
              name="efatura_provider"
              defaultValue={efatura.provider}
              className={selectClass}
            >
              <option value="disabled">Pasif</option>
              <option value="parasut">Paraşüt</option>
            </select>
          </FormField>
        </FieldGrid>

        <FormField label="Şirket VKN" htmlFor="efatura_company_vkn">
          <Input
            id="efatura_company_vkn"
            name="efatura_company_vkn"
            defaultValue={efatura.companyVkn}
            placeholder="1234567890"
            inputMode="numeric"
            className={inputClass}
          />
        </FormField>

        <FormField
          label="API kimlik bilgileri (Paraşüt)"
          htmlFor="efatura_api_key"
          hint="Örnek JSON: clientId, clientSecret, username, password, companyId alanları."
        >
          <Input
            id="efatura_api_key"
            name="efatura_api_key"
            type="password"
            defaultValue={efatura.hasApiKey ? "********" : ""}
            placeholder="JSON veya clientId:clientSecret:username:password:companyId"
            autoComplete="new-password"
            className={inputClass}
          />
        </FormField>

        <Note>
          Ödeme tamamlandığında e-fatura taslakları otomatik kuyruğa alınır. Kayıtları{" "}
          <Link href="/yonetim/efatura" className="font-medium text-foreground underline underline-offset-4">
            E-Fatura listesinden
          </Link>{" "}
          takip edebilirsiniz.
        </Note>
      </FormSection>
    </form>
  );
}

import Link from "next/link";
import { FormField, FormSection, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { saveEfaturaIntegrationSettings, testEfaturaConnection } from "@/lib/actions/admin/integrations";
import { FieldGrid, Note, ToggleRow, inputClass, selectClass } from "./shared";
import type { EfaturaConfig } from "./types";

function TextField({
  name,
  label,
  defaultValue,
  hint,
  placeholder,
  inputMode,
  maxLength,
}: {
  name: string;
  label: string;
  defaultValue: string;
  hint?: string;
  placeholder?: string;
  inputMode?: "numeric" | "email" | "url" | "tel";
  maxLength?: number;
}) {
  return (
    <FormField label={label} htmlFor={name} hint={hint}>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        inputMode={inputMode}
        maxLength={maxLength}
        className={inputClass}
      />
    </FormField>
  );
}

export function EfaturaSection({ efatura }: { efatura: EfaturaConfig }) {
  const { uyumsoft, supplier } = efatura;
  const actions = (
    <>
      <button type="submit" formAction={testEfaturaConnection} className={appButton({ variant: "outline" })}>
        Bağlantıyı test et
      </button>
      <button type="submit" className={appButton()}>
        Kaydet
      </button>
    </>
  );

  return (
    <form action={saveEfaturaIntegrationSettings} className="space-y-8">
      <FormSection
        title="E-Fatura / E-Arşiv"
        description="Ödenen faturalar için resmi e-belge. Müşterinin VKN/TCKN'si e-Fatura mükellefiyse e-Fatura, değilse e-Arşiv kesilir."
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
              defaultValue={efatura.provider === "disabled" ? "uyumsoft" : efatura.provider}
              className={selectClass}
            >
              <option value="uyumsoft">Uyumsoft (entegratör)</option>
              <option value="parasut">Paraşüt</option>
            </select>
          </FormField>
          <TextField
            name="efatura_company_vkn"
            label="Şirket VKN / TCKN"
            defaultValue={efatura.companyVkn}
            placeholder="1234567890"
            inputMode="numeric"
            maxLength={11}
          />
          <FormField
            label="e-Fatura senaryosu"
            htmlFor="efatura_default_profile"
            hint="Ticari faturaya alıcı 8 gün içinde kabul/red yanıtı verebilir."
          >
            <select
              id="efatura_default_profile"
              name="efatura_default_profile"
              defaultValue={efatura.defaultProfile}
              className={selectClass}
            >
              <option value="TEMELFATURA">Temel fatura</option>
              <option value="TICARIFATURA">Ticari fatura</option>
            </select>
          </FormField>
        </FieldGrid>
        {efatura.problem ? (
          <Note>Gönderim kapalı: {efatura.problem}</Note>
        ) : (
          <Note>
            Ödeme tamamlandığında e-belge otomatik kesilir. Kayıtları{" "}
            <Link href="/yonetim/efatura" className="font-medium text-foreground underline underline-offset-4">
              E-Fatura listesinden
            </Link>{" "}
            takip edebilirsiniz.
          </Note>
        )}
      </FormSection>

      <FormSection
        title="Uyumsoft"
        description="Uyumsoft entegrasyon web servisi kullanıcısı. Test ortamı için Uyumsoft'un herkese açık test kullanıcısı (Uyumsoft / Uyumsoft) kullanılabilir."
        footer={actions}
      >
        <FieldGrid>
          <TextField name="efatura_uyumsoft_username" label="Kullanıcı adı" defaultValue={uyumsoft.username} />
          <FormField label="Şifre" htmlFor="efatura_uyumsoft_password">
            <Input
              id="efatura_uyumsoft_password"
              name="efatura_uyumsoft_password"
              type="password"
              defaultValue={uyumsoft.hasPassword ? "********" : ""}
              autoComplete="new-password"
              className={inputClass}
            />
          </FormField>
          <TextField
            name="efatura_uyumsoft_earsiv_prefix"
            label="e-Arşiv seri öneki"
            defaultValue={uyumsoft.earsivPrefix}
            placeholder="Boş: Uyumsoft numaralar"
            hint="3 karakter (ör. KLE). Boş bırakılırsa numarayı Uyumsoft portalındaki varsayılan seriden verir."
            maxLength={3}
          />
          <TextField
            name="efatura_uyumsoft_efatura_prefix"
            label="e-Fatura seri öneki"
            defaultValue={uyumsoft.efaturaPrefix}
            placeholder="Boş: Uyumsoft numaralar"
            hint="Önek girilirse numara KLEACORE'da SSSYYYY000000001 biçiminde sırayla üretilir."
            maxLength={3}
          />
        </FieldGrid>
        <ToggleRow
          title="Test ortamı"
          description="Açıkken belgeler efatura-test.uyumsoft.com.tr'ye gider ve yasal geçerliliği yoktur."
          fieldName="efatura_uyumsoft_test_mode"
          defaultChecked={uyumsoft.testMode}
        />
      </FormSection>

      <FormSection
        title="Fatura kesen bilgileri"
        description="UBL belgesindeki satıcı tarafı. Unvan ve VKN, entegratördeki hesapla aynı olmalıdır."
      >
        <FieldGrid>
          <TextField name="efatura_company_name" label="Unvan" defaultValue={supplier.name} />
          <TextField name="efatura_company_tax_office" label="Vergi dairesi" defaultValue={supplier.taxOffice} />
          <TextField name="efatura_company_street" label="Adres (cadde, no)" defaultValue={supplier.street} />
          <TextField name="efatura_company_district" label="İlçe" defaultValue={supplier.district} />
          <TextField name="efatura_company_city" label="İl" defaultValue={supplier.city} />
          <TextField name="efatura_company_postal_zone" label="Posta kodu" defaultValue={supplier.postalZone} inputMode="numeric" />
          <TextField name="efatura_company_phone" label="Telefon" defaultValue={supplier.phone} inputMode="tel" />
          <TextField name="efatura_company_email" label="E-posta" defaultValue={supplier.email} inputMode="email" />
          <TextField name="efatura_company_website" label="Web sitesi" defaultValue={supplier.website} inputMode="url" hint="e-Arşiv internet satışı bilgisinde kullanılır." />
          <TextField name="efatura_company_mersis" label="MERSİS no (isteğe bağlı)" defaultValue={supplier.mersisNo} inputMode="numeric" />
        </FieldGrid>
      </FormSection>

      <FormSection
        title="Paraşüt (isteğe bağlı)"
        description="Sağlayıcı olarak Paraşüt seçilirse kullanılır. Durum takibi ve PDF Paraşüt panelinden yapılır."
        footer={actions}
      >
        <FormField
          label="API kimlik bilgileri"
          htmlFor="efatura_api_key"
          hint="JSON: clientId, clientSecret, username, password, companyId alanları."
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
      </FormSection>
    </form>
  );
}

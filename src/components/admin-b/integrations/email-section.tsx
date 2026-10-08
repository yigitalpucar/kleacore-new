import { FormField, FormSection, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { saveSmtpIntegrationSettings, testSmtpConnection } from "@/lib/actions/admin/integrations";
import { FieldGrid, Note, ToggleRow, inputClass } from "./shared";
import type { SmtpConfig } from "./types";

export function EmailSection({ smtp }: { smtp: SmtpConfig }) {
  return (
    <form action={saveSmtpIntegrationSettings} className="space-y-8">
      <FormSection
        title="SMTP"
        description="Bildirim e-postaları için SMTP sunucu yapılandırması."
        footer={
          <>
            <button type="submit" formAction={testSmtpConnection} className={appButton({ variant: "outline" })}>
              Bağlantıyı test et
            </button>
            <button type="submit" className={appButton()}>
              Kaydet
            </button>
          </>
        }
      >
        <FieldGrid>
          <FormField label="SMTP sunucu" htmlFor="int_smtp_server">
            <Input id="int_smtp_server" name="smtp_server" defaultValue={smtp.server} className={inputClass} />
          </FormField>
          <FormField label="Port" htmlFor="int_smtp_port">
            <Input id="int_smtp_port" name="smtp_port" defaultValue={smtp.port} inputMode="numeric" className={inputClass} />
          </FormField>
          <FormField label="Kullanıcı adı" htmlFor="int_smtp_username">
            <Input
              id="int_smtp_username"
              name="smtp_username"
              defaultValue={smtp.username}
              autoComplete="off"
              className={inputClass}
            />
          </FormField>
          <FormField label="Şifre" htmlFor="int_smtp_password">
            <Input
              id="int_smtp_password"
              name="smtp_password"
              type="password"
              defaultValue={smtp.hasPassword ? "********" : ""}
              autoComplete="new-password"
              className={inputClass}
            />
          </FormField>
        </FieldGrid>
        <ToggleRow
          title="E-posta bildirimleri"
          description="Kapalıyken sistem e-posta göndermez."
          fieldName="email_notifications"
          defaultChecked={smtp.notificationsEnabled}
        />
        <Note>
          Alternatif: <code className="font-mono text-xs">SMTP_HOST</code>, <code className="font-mono text-xs">SMTP_PORT</code>,{" "}
          <code className="font-mono text-xs">SMTP_USER</code>, <code className="font-mono text-xs">SMTP_PASSWORD</code> ortam
          değişkenleri.
        </Note>
      </FormSection>
    </form>
  );
}

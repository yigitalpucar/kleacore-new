"use client";

import { ToggleRow } from "@/components/admin-b/integrations/shared";

interface SettingsSwitchesProps {
  emailNotifications: boolean;
  smsNotifications: boolean;
  autoInvoice: boolean;
  emailFieldName?: string;
  smsFieldName?: string;
  autoInvoiceFieldName?: string;
}

export function NotificationSwitches({
  emailNotifications,
  smsNotifications,
  autoInvoice,
  emailFieldName = "email_notifications",
  smsFieldName = "sms_notifications",
  autoInvoiceFieldName = "auto_invoice",
}: SettingsSwitchesProps) {
  return (
    <div className="space-y-3">
      <ToggleRow
        title="E-posta bildirimleri"
        description="Önemli güncellemeler için e-posta alın."
        fieldName={emailFieldName}
        defaultChecked={emailNotifications}
      />
      <ToggleRow
        title="SMS bildirimleri"
        description="Kritik durumlar için SMS alın."
        fieldName={smsFieldName}
        defaultChecked={smsNotifications}
      />
      <ToggleRow
        title="Otomatik faturalama"
        description="Faturaları otomatik oluştur ve gönder."
        fieldName={autoInvoiceFieldName}
        defaultChecked={autoInvoice}
      />
    </div>
  );
}

interface SecuritySwitchProps {
  twoFactor: boolean;
  twoFactorFieldName?: string;
}

export function SecuritySwitch({ twoFactor, twoFactorFieldName = "two_factor" }: SecuritySwitchProps) {
  return (
    <ToggleRow
      title="İki faktörlü doğrulama"
      description="Giriş için ek güvenlik katmanı."
      fieldName={twoFactorFieldName}
      defaultChecked={twoFactor}
    />
  );
}

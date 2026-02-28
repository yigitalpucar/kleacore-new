"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

interface SettingsSwitchesProps {
  emailNotifications: boolean;
  smsNotifications: boolean;
  autoInvoice: boolean;
  emailFieldName?: string;
  smsFieldName?: string;
  autoInvoiceFieldName?: string;
}

export function NotificationSwitches({
  emailNotifications: initialEmail,
  smsNotifications: initialSms,
  autoInvoice: initialAutoInvoice,
  emailFieldName = "email_notifications",
  smsFieldName = "sms_notifications",
  autoInvoiceFieldName = "auto_invoice",
}: SettingsSwitchesProps) {
  const [emailNotifications, setEmailNotifications] = useState(initialEmail);
  const [smsNotifications, setSmsNotifications] = useState(initialSms);
  const [autoInvoice, setAutoInvoice] = useState(initialAutoInvoice);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-white">E-posta Bildirimleri</p>
          <p className="text-xs text-zinc-500">Önemli güncellemeler için e-posta alın</p>
        </div>
        <Switch
          checked={emailNotifications}
          onCheckedChange={setEmailNotifications}
        />
        <input
          type="hidden"
          name={emailFieldName}
          value={emailNotifications ? "true" : "false"}
        />
      </div>
      <Separator className="bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-white">SMS Bildirimleri</p>
          <p className="text-xs text-zinc-500">Kritik durumlar için SMS alın</p>
        </div>
        <Switch
          checked={smsNotifications}
          onCheckedChange={setSmsNotifications}
        />
        <input
          type="hidden"
          name={smsFieldName}
          value={smsNotifications ? "true" : "false"}
        />
      </div>
      <Separator className="bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-white">Otomatik Faturalama</p>
          <p className="text-xs text-zinc-500">Faturaları otomatik oluştur ve gönder</p>
        </div>
        <Switch
          checked={autoInvoice}
          onCheckedChange={setAutoInvoice}
        />
        <input
          type="hidden"
          name={autoInvoiceFieldName}
          value={autoInvoice ? "true" : "false"}
        />
      </div>
    </div>
  );
}

interface SecuritySwitchProps {
  twoFactor: boolean;
  twoFactorFieldName?: string;
}

export function SecuritySwitch({
  twoFactor: initialTwoFactor,
  twoFactorFieldName = "two_factor",
}: SecuritySwitchProps) {
  const [twoFactor, setTwoFactor] = useState(initialTwoFactor);

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-zinc-900 dark:text-white">İki Faktörlü Doğrulama</p>
        <p className="text-xs text-zinc-500">Giriş için ek güvenlik katmanı</p>
      </div>
      <Switch
        checked={twoFactor}
        onCheckedChange={setTwoFactor}
      />
      <input
        type="hidden"
        name={twoFactorFieldName}
        value={twoFactor ? "true" : "false"}
      />
    </div>
  );
}

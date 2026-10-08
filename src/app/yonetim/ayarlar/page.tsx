import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CreditCard, Key, Landmark, Mail, Upload, UserPlus, Users } from "lucide-react";
import { redirect } from "next/navigation";
import {
  EmptyState,
  FormField,
  FormSection,
  IconTile,
  PageHeader,
  SectionCard,
  StatusBadge,
  UnavailableAction,
  appButton,
} from "@/components/app";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AyarlarTabBar } from "@/components/admin-b/ayarlar/settings-tab-bar";
import { FieldGrid, inputClass } from "@/components/admin-b/integrations/shared";
import { formatDate } from "@/lib/format/date";
import { getSettings, getAdminUsers, getApiKeys } from "@/lib/dal/settings";
import { updateSettings } from "@/lib/actions/admin/settings";
import { revokeApiKeyByAdmin } from "@/lib/actions/admin/api-keys";
import { NotificationSwitches, SecuritySwitch } from "./settings-switches";
import { SettingsFeedbackToast } from "./settings-feedback-toast";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Ayarlar" };

const allowedTabs = [
  "general",
  "email",
  "notifications",
  "payment",
  "security",
  "users",
  "api",
] as const;

type SettingsTab = (typeof allowedTabs)[number];

// Settings key'den value al, yoksa default dondur
function getSettingValue(
  settings: { key: string; value: string }[],
  key: string,
  defaultValue: string = ""
): string {
  return settings.find((s) => s.key === key)?.value ?? defaultValue;
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.substring(0, 7) + "****" + key.substring(key.length - 4);
}

function getFormValue(formData: FormData, key: string, fallback = "") {
  const value = formData.get(key);
  return typeof value === "string" ? value : fallback;
}

async function saveGeneralSettings(formData: FormData) {
  "use server";

  const result = await updateSettings([
    { key: "company_name", value: getFormValue(formData, "company_name") },
    { key: "tax_number", value: getFormValue(formData, "tax_number") },
    { key: "address", value: getFormValue(formData, "address") },
    { key: "company_email", value: getFormValue(formData, "company_email") },
    { key: "company_phone", value: getFormValue(formData, "company_phone") },
  ]);

  const params = new URLSearchParams({
    tab: "general",
    status: result.success ? "success" : "error",
    message: result.success
      ? "Genel ayarlar kaydedildi."
      : result.error ?? "Genel ayarlar kaydedilemedi.",
  });
  redirect(`/yonetim/ayarlar?${params.toString()}`);
}

async function saveEmailSettings(formData: FormData) {
  "use server";

  const settings = await getSettings();
  const currentSmtpPassword = getSettingValue(settings, "smtp_password", "");
  const smtpPassword = getFormValue(formData, "smtp_password");
  const resolvedSmtpPassword =
    !smtpPassword || smtpPassword === "********"
      ? currentSmtpPassword
      : smtpPassword;

  const result = await updateSettings([
    { key: "smtp_server", value: getFormValue(formData, "smtp_server") },
    { key: "smtp_port", value: getFormValue(formData, "smtp_port") },
    { key: "smtp_username", value: getFormValue(formData, "smtp_username") },
    { key: "smtp_password", value: resolvedSmtpPassword },
  ]);

  const params = new URLSearchParams({
    tab: "email",
    status: result.success ? "success" : "error",
    message: result.success
      ? "SMTP ayarları kaydedildi."
      : result.error ?? "SMTP ayarları kaydedilemedi.",
  });
  redirect(`/yonetim/ayarlar?${params.toString()}`);
}

async function saveNotificationSettings(formData: FormData) {
  "use server";

  const result = await updateSettings([
    {
      key: "email_notifications",
      value: getFormValue(formData, "email_notifications", "false"),
    },
    {
      key: "sms_notifications",
      value: getFormValue(formData, "sms_notifications", "false"),
    },
    {
      key: "auto_invoice",
      value: getFormValue(formData, "auto_invoice", "false"),
    },
  ]);

  const params = new URLSearchParams({
    tab: "notifications",
    status: result.success ? "success" : "error",
    message: result.success
      ? "Bildirim ayarları kaydedildi."
      : result.error ?? "Bildirim ayarları kaydedilemedi.",
  });
  redirect(`/yonetim/ayarlar?${params.toString()}`);
}

async function saveSecuritySettings(formData: FormData) {
  "use server";

  const result = await updateSettings([
    { key: "two_factor", value: getFormValue(formData, "two_factor", "false") },
    { key: "turnstile_site_key", value: getFormValue(formData, "turnstile_site_key").trim() },
    // "********" / empty keeps the stored (encrypted) secret.
    { key: "turnstile_secret_key", value: getFormValue(formData, "turnstile_secret_key").trim() },
  ]);

  const params = new URLSearchParams({
    tab: "security",
    status: result.success ? "success" : "error",
    message: result.success
      ? "Güvenlik ayarları kaydedildi."
      : result.error ?? "Güvenlik ayarları kaydedilemedi.",
  });
  redirect(`/yonetim/ayarlar?${params.toString()}`);
}

async function revokeAdminApiKey(formData: FormData) {
  "use server";

  const result = await revokeApiKeyByAdmin(formData);

  const params = new URLSearchParams({
    tab: "api",
    status: result.success ? "success" : "error",
    message: result.success
      ? "API anahtarı iptal edildi."
      : result.error ?? "API anahtarı iptal edilemedi.",
  });
  redirect(`/yonetim/ayarlar?${params.toString()}`);
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];
  return typeof value === "string" ? value : undefined;
}

function isSettingsTab(value: string | undefined): value is SettingsTab {
  return value ? allowedTabs.includes(value as SettingsTab) : false;
}

interface SettingsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const sp = await searchParams;
  const activeTab = readSearchParam(sp, "tab");

  if (activeTab === "integrations") {
    redirect("/yonetim/entegrasyonlar");
  }

  const toastStatus = readSearchParam(sp, "status");
  const toastMessage = readSearchParam(sp, "message");
  const defaultTab: SettingsTab = isSettingsTab(activeTab) ? activeTab : "general";

  const [settings, adminUsers, apiKeys] = await Promise.all([
    getSettings(),
    getAdminUsers(),
    getApiKeys(),
  ]);

  // Settings'ten degerler
  const companyName = getSettingValue(settings, "company_name", "KLEACORE");
  const taxNumber = getSettingValue(settings, "tax_number", "");
  const address = getSettingValue(settings, "address", "");
  const companyEmail = getSettingValue(settings, "company_email", "");
  const companyPhone = getSettingValue(settings, "company_phone", "");
  const smtpServer = getSettingValue(settings, "smtp_server", "");
  const smtpPort = getSettingValue(settings, "smtp_port", "587");
  const smtpUsername = getSettingValue(settings, "smtp_username", "");
  const smtpPassword = getSettingValue(settings, "smtp_password", "")
    ? "********"
    : "";
  const emailNotifications = getSettingValue(settings, "email_notifications", "true") === "true";
  const smsNotifications = getSettingValue(settings, "sms_notifications", "false") === "true";
  const autoInvoice = getSettingValue(settings, "auto_invoice", "true") === "true";
  const twoFactor = getSettingValue(settings, "two_factor", "true") === "true";
  const turnstileSiteKey = getSettingValue(settings, "turnstile_site_key", "");
  const turnstileSecretSet = Boolean(getSettingValue(settings, "turnstile_secret_key", ""));
  const turnstileFromEnv = Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
  const paymentProvider = getSettingValue(settings, "payment_gateway_provider", "stripe");
  const paymentProviderLabel =
    ({ stripe: "Stripe", iyzico: "iyzico", paytr: "PayTR", kuveytturk: "Kuveyt Türk" } as Record<string, string>)[paymentProvider] ?? paymentProvider;
  const emailTemplates = [
    { name: "Hoş geldiniz", description: "Yeni kayıt sonrası gönderilir" },
    { name: "Fatura bildirimi", description: "Yeni fatura oluşturulduğunda" },
    { name: "Ödeme hatırlatma", description: "Vadesi yaklaşan faturalar için" },
    { name: "Hizmet yenileme", description: "Süre bitimi yaklaşırken" },
    { name: "Destek yanıtı", description: "Destek talebine yanıt verildiğinde" },
  ];

  const paymentMethods = [
    {
      name: "Kredi kartı",
      provider: `Aktif sağlayıcı: ${paymentProviderLabel}`,
      icon: <CreditCard />,
    },
    { name: "Banka havalesi", provider: "Manuel onay", icon: <Landmark /> },
  ];

  const tabPanel = "mt-6 space-y-8 focus-visible:ring-offset-0";

  // AppShell already provides a TooltipProvider; this keeps UnavailableAction safe in any shell.
  return (
    <TooltipProvider delayDuration={200}>
      <SettingsFeedbackToast status={toastStatus} message={toastMessage} activeTab={defaultTab} />

      <PageHeader title="Ayarlar" description="Şirket bilgileri, e-posta, bildirim, güvenlik ve API ayarlarını yönetin." />

      <Tabs defaultValue={defaultTab} className="w-full">
        <AyarlarTabBar />

        {/* General */}
        <TabsContent value="general" className={tabPanel}>
          <form action={saveGeneralSettings} className="space-y-8">
            <FormSection
              title="Şirket bilgileri"
              description="Faturalarda ve e-postalarda kullanılan temel şirket bilgileri."
              footer={
                <button type="submit" className={appButton()}>
                  Değişiklikleri kaydet
                </button>
              }
            >
              <FieldGrid>
                <FormField label="Şirket adı" htmlFor="company_name">
                  <Input id="company_name" name="company_name" defaultValue={companyName} className={inputClass} />
                </FormField>
                <FormField label="Vergi numarası" htmlFor="tax_number">
                  <Input id="tax_number" name="tax_number" defaultValue={taxNumber} inputMode="numeric" className={inputClass} />
                </FormField>
              </FieldGrid>
              <FormField label="Adres" htmlFor="address">
                <Textarea id="address" name="address" defaultValue={address} className="min-h-20 shadow-sm" />
              </FormField>
              <FieldGrid>
                <FormField label="E-posta" htmlFor="company_email">
                  <Input
                    id="company_email"
                    name="company_email"
                    type="text"
                    inputMode="email"
                    defaultValue={companyEmail}
                    className={inputClass}
                  />
                </FormField>
                <FormField label="Telefon" htmlFor="company_phone">
                  <Input
                    id="company_phone"
                    name="company_phone"
                    type="text"
                    inputMode="tel"
                    defaultValue={companyPhone}
                    className={inputClass}
                  />
                </FormField>
              </FieldGrid>
            </FormSection>
          </form>

          <FormSection title="Logo" description="Site logonuzu güncelleyin.">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-32 items-center justify-center rounded-md border border-dashed bg-muted/30 px-2">
                <span className="truncate text-sm font-semibold tracking-tight">{companyName}</span>
              </div>
              <UnavailableAction label="Logo yükle" icon={<Upload aria-hidden />} />
            </div>
          </FormSection>
        </TabsContent>

        {/* Email */}
        <TabsContent value="email" className={tabPanel}>
          <form action={saveEmailSettings}>
            <FormSection
              title="SMTP ayarları"
              description="E-posta gönderimi için SMTP sunucunuzu yapılandırın. Kayıtlı şifre yıldızla gösterilir."
              footer={
                <button type="submit" className={appButton()}>
                  SMTP ayarlarını kaydet
                </button>
              }
            >
              <FieldGrid>
                <FormField label="SMTP sunucu" htmlFor="smtp_server">
                  <Input id="smtp_server" name="smtp_server" defaultValue={smtpServer} className={inputClass} />
                </FormField>
                <FormField label="Port" htmlFor="smtp_port">
                  <Input id="smtp_port" name="smtp_port" defaultValue={smtpPort} inputMode="numeric" className={inputClass} />
                </FormField>
                <FormField label="Kullanıcı adı" htmlFor="smtp_username">
                  <Input
                    id="smtp_username"
                    name="smtp_username"
                    defaultValue={smtpUsername}
                    autoComplete="off"
                    className={inputClass}
                  />
                </FormField>
                <FormField label="Şifre" htmlFor="smtp_password">
                  <Input
                    id="smtp_password"
                    name="smtp_password"
                    type="password"
                    defaultValue={smtpPassword}
                    autoComplete="new-password"
                    className={inputClass}
                  />
                </FormField>
              </FieldGrid>
            </FormSection>
          </form>

          <FormSection title="E-posta şablonları" description="Otomatik gönderilen e-postaların içerikleri.">
            <ul className="-mx-4 -my-4 divide-y md:-mx-5 md:-my-5">
              {emailTemplates.map((template) => (
                <li key={template.name} className="flex items-center gap-3 px-4 py-3 md:px-5">
                  <IconTile size="sm">
                    <Mail />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground">{template.description}</p>
                  </div>
                  <UnavailableAction label="Düzenle" variant="ghost" size="sm" />
                </li>
              ))}
            </ul>
          </FormSection>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className={tabPanel}>
          <form action={saveNotificationSettings}>
            <FormSection
              title="Bildirim tercihleri"
              description="Hangi bildirimlerin gönderileceğini seçin."
              footer={
                <button type="submit" className={appButton()}>
                  Bildirim ayarlarını kaydet
                </button>
              }
            >
              <NotificationSwitches
                emailNotifications={emailNotifications}
                smsNotifications={smsNotifications}
                autoInvoice={autoInvoice}
              />
            </FormSection>
          </form>
        </TabsContent>

        {/* Payment */}
        <TabsContent value="payment" className={tabPanel}>
          <FormSection
            title="Ödeme yöntemleri"
            description="Sağlayıcı anahtarları ve aktif ağ geçidi Entegrasyonlar sayfasından yönetilir."
          >
            <ul className="-mx-4 -my-4 divide-y md:-mx-5 md:-my-5">
              {paymentMethods.map((method) => (
                <li key={method.name} className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-5">
                  <IconTile size="sm">{method.icon}</IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{method.name}</p>
                    <p className="text-xs text-muted-foreground">{method.provider}</p>
                  </div>
                  <Link href="/yonetim/entegrasyonlar?tab=payment" className={appButton({ variant: "outline", size: "sm" })}>
                    Yapılandır
                  </Link>
                </li>
              ))}
            </ul>
          </FormSection>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className={tabPanel}>
          <form action={saveSecuritySettings}>
            <FormSection
              title="Güvenlik ayarları"
              description="Yönetim hesapları için giriş güvenliği."
              footer={
                <button type="submit" className={appButton()}>
                  Güvenlik ayarlarını kaydet
                </button>
              }
            >
              <SecuritySwitch twoFactor={twoFactor} />
              <div className="space-y-3 border-t pt-5">
                <div>
                  <p className="text-sm font-medium">Cloudflare Turnstile</p>
                  <p className="text-xs text-muted-foreground">
                    Kayıt, şifre sıfırlama, iletişim formu ve art arda hatalı girişlerde bot koruması.
                    {turnstileFromEnv
                      ? " Anahtarlar ortam değişkenlerinden (TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY) okunuyor; buradaki değerler kullanılmaz."
                      : " Canlı ortamda anahtarlar tanımlı değilse bu formlar güvenlik nedeniyle kapalı kalır."}
                  </p>
                </div>
                <FieldGrid>
                  <FormField label="Site anahtarı" htmlFor="turnstile_site_key">
                    <Input
                      id="turnstile_site_key"
                      name="turnstile_site_key"
                      defaultValue={turnstileSiteKey}
                      autoComplete="off"
                      className={inputClass}
                    />
                  </FormField>
                  <FormField label="Gizli anahtar" htmlFor="turnstile_secret_key">
                    <Input
                      id="turnstile_secret_key"
                      name="turnstile_secret_key"
                      type="password"
                      defaultValue={turnstileSecretSet ? "********" : ""}
                      autoComplete="new-password"
                      className={inputClass}
                    />
                  </FormField>
                </FieldGrid>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Şifre değiştir</p>
                  <p className="text-xs text-muted-foreground">Yönetici hesabınızın giriş şifresi.</p>
                </div>
                <UnavailableAction label="Değiştir" size="sm" />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Aktif oturumlar</p>
                  <p className="text-xs text-muted-foreground">Hesabınızla açık olan oturumlar.</p>
                </div>
                <UnavailableAction label="Görüntüle" size="sm" />
              </div>
            </FormSection>
          </form>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users" className={tabPanel}>
          <SectionCard
            title="Yönetici kullanıcıları"
            description="Yönetim paneline erişimi olan kullanıcılar."
            actions={<UnavailableAction label="Kullanıcı ekle" icon={<UserPlus aria-hidden />} size="sm" />}
            flush
          >
            {adminUsers.length === 0 ? (
              <div className="p-4 md:p-5">
                <EmptyState compact icon={Users} title="Yönetici kullanıcı bulunamadı." />
              </div>
            ) : (
              <ul className="divide-y">
                {adminUsers.map((user) => (
                  <li key={user.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 md:px-5">
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold uppercase"
                    >
                      {user.name.charAt(0)}
                      {user.surname.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {user.name} {user.surname}
                      </p>
                      <p className="break-all text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <StatusBadge tone="neutral" label="Yönetici" />
                        {user.lastLoginAt && (
                          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                            Son giriş: {formatDate(user.lastLoginAt)}
                          </p>
                        )}
                      </div>
                      <UnavailableAction label="Düzenle" variant="ghost" size="sm" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </TabsContent>

        {/* API */}
        <TabsContent value="api" className={tabPanel}>
          <SectionCard
            title="API anahtarları"
            description="Entegrasyonlar için oluşturulan API anahtarları."
            actions={<UnavailableAction label="Yeni anahtar" icon={<Key aria-hidden />} size="sm" />}
            flush
          >
            {apiKeys.length === 0 ? (
              <div className="p-4 md:p-5">
                <EmptyState compact icon={Key} title="Henüz API anahtarı yok." />
              </div>
            ) : (
              <ul className="divide-y">
                {apiKeys.map((apiKey) => (
                  <li key={apiKey.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 md:px-5">
                    <div className="min-w-0 basis-full sm:flex-1 sm:basis-0">
                      <p className="text-sm font-medium">{apiKey.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{maskApiKey(apiKey.keyPrefix)}</p>
                    </div>
                    <div className="flex-1 text-xs tabular-nums text-muted-foreground sm:flex-none sm:text-right">
                      <p>Oluşturulma: {formatDate(apiKey.createdAt)}</p>
                      {apiKey.lastUsedAt && <p>Son kullanım: {formatDate(apiKey.lastUsedAt)}</p>}
                    </div>
                    <form action={revokeAdminApiKey}>
                      <input type="hidden" name="id" value={apiKey.id} />
                      <button
                        type="submit"
                        className={appButton({ variant: "destructive", size: "sm" })}
                        aria-label={`${apiKey.name} anahtarını iptal et`}
                      >
                        İptal et
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Entegrasyonlar"
            description="Registrar, ödeme, webhook ve diğer modüller Entegrasyonlar sayfasında yönetilir."
            actions={
              <Link href="/yonetim/entegrasyonlar" className={appButton({ variant: "outline", size: "sm" })}>
                Entegrasyonları yönet
                <ArrowUpRight aria-hidden />
              </Link>
            }
          />
        </TabsContent>
      </Tabs>
    </TooltipProvider>
  );
}

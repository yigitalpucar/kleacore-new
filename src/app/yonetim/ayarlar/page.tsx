import {
  Building2,
  Mail,
  Bell,
  Shield,
  Users,
  Key,
  CreditCard,
  Save,
  Upload,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/magicui/blur-fade";
import { getSettings, getAdminUsers, getApiKeys } from "@/lib/dal/settings";
import { updateSettings } from "@/lib/actions/admin/settings";
import { revokeApiKeyByAdmin } from "@/lib/actions/admin/api-keys";
import { NotificationSwitches, SecuritySwitch } from "./settings-switches";
import { redirect } from "next/navigation";
import { SettingsFeedbackToast } from "./settings-feedback-toast";

export const dynamic = "force-dynamic";

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
      ? "SMTP ayarlari kaydedildi."
      : result.error ?? "SMTP ayarlari kaydedilemedi.",
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
      ? "Bildirim ayarlari kaydedildi."
      : result.error ?? "Bildirim ayarlari kaydedilemedi.",
  });
  redirect(`/yonetim/ayarlar?${params.toString()}`);
}

async function saveSecuritySettings(formData: FormData) {
  "use server";

  const result = await updateSettings([
    { key: "two_factor", value: getFormValue(formData, "two_factor", "false") },
  ]);

  const params = new URLSearchParams({
    tab: "security",
    status: result.success ? "success" : "error",
    message: result.success
      ? "Guvenlik ayarlari kaydedildi."
      : result.error ?? "Guvenlik ayarlari kaydedilemedi.",
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
  return (
    <div className="space-y-6">
      <SettingsFeedbackToast
        status={toastStatus}
        message={toastMessage}
        activeTab={defaultTab}
      />
      {/* Page Header */}
      <BlurFade delay={0}>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Ayarlar</h1>
          <p className="text-zinc-600 dark:text-zinc-400">Sistem ayarlarını yapılandırın</p>
        </div>
      </BlurFade>

      <BlurFade delay={0.1}>
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="bg-zinc-100 dark:bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="general" className="data-[state=active]:bg-zinc-200 dark:data-[state=active]:bg-zinc-700">
            <Building2 className="mr-2 h-4 w-4" />
            Genel
          </TabsTrigger>
          <TabsTrigger value="email" className="data-[state=active]:bg-zinc-200 dark:data-[state=active]:bg-zinc-700">
            <Mail className="mr-2 h-4 w-4" />
            E-posta
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-zinc-200 dark:data-[state=active]:bg-zinc-700">
            <Bell className="mr-2 h-4 w-4" />
            Bildirimler
          </TabsTrigger>
          <TabsTrigger value="payment" className="data-[state=active]:bg-zinc-200 dark:data-[state=active]:bg-zinc-700">
            <CreditCard className="mr-2 h-4 w-4" />
            Ödeme
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-zinc-200 dark:data-[state=active]:bg-zinc-700">
            <Shield className="mr-2 h-4 w-4" />
            Güvenlik
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-zinc-200 dark:data-[state=active]:bg-zinc-700">
            <Users className="mr-2 h-4 w-4" />
            Kullanıcılar
          </TabsTrigger>
          <TabsTrigger value="api" className="data-[state=active]:bg-zinc-200 dark:data-[state=active]:bg-zinc-700">
            <Key className="mr-2 h-4 w-4" />
            API
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="mt-6 space-y-6">
          <form action={saveGeneralSettings} className="space-y-6">
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white">Şirket Bilgileri</CardTitle>
                <CardDescription className="text-zinc-500">
                  Şirketinizin temel bilgilerini güncelleyin
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-zinc-700 dark:text-zinc-300">Şirket Adı</Label>
                    <Input
                      name="company_name"
                      defaultValue={companyName}
                      className="bg-zinc-100 dark:bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-700 dark:text-zinc-300">Vergi Numarası</Label>
                    <Input
                      name="tax_number"
                      defaultValue={taxNumber}
                      className="bg-zinc-100 dark:bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-700 dark:text-zinc-300">Adres</Label>
                  <Textarea
                    name="address"
                    defaultValue={address}
                    className="bg-zinc-100 dark:bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white min-h-20"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-zinc-700 dark:text-zinc-300">E-posta</Label>
                    <Input
                      name="company_email"
                      defaultValue={companyEmail}
                      className="bg-zinc-100 dark:bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-700 dark:text-zinc-300">Telefon</Label>
                    <Input
                      name="company_phone"
                      defaultValue={companyPhone}
                      className="bg-zinc-100 dark:bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white">Logo</CardTitle>
                <CardDescription className="text-zinc-500">
                  Site logonuzu güncelleyin
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold">{companyName}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Logo Yükle
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                <Save className="mr-2 h-4 w-4" />
                Değişiklikleri Kaydet
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* Email Settings */}
        <TabsContent value="email" className="mt-6 space-y-6">
          <form action={saveEmailSettings} className="space-y-6">
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white">SMTP Ayarları</CardTitle>
                <CardDescription className="text-zinc-500">
                  E-posta gönderimi için SMTP sunucunuzu yapılandırın
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-zinc-700 dark:text-zinc-300">SMTP Sunucu</Label>
                    <Input
                      name="smtp_server"
                      defaultValue={smtpServer}
                      className="bg-zinc-100 dark:bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-700 dark:text-zinc-300">Port</Label>
                    <Input
                      name="smtp_port"
                      defaultValue={smtpPort}
                      className="bg-zinc-100 dark:bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-zinc-700 dark:text-zinc-300">Kullanıcı Adı</Label>
                    <Input
                      name="smtp_username"
                      defaultValue={smtpUsername}
                      className="bg-zinc-100 dark:bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-zinc-700 dark:text-zinc-300">Şifre</Label>
                    <Input
                      name="smtp_password"
                      type="password"
                      defaultValue={smtpPassword}
                      className="bg-zinc-100 dark:bg-zinc-200 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                <Save className="mr-2 h-4 w-4" />
                SMTP Ayarlarını Kaydet
              </Button>
            </div>
          </form>

          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-900 dark:text-white">E-posta Şablonları</CardTitle>
              <CardDescription className="text-zinc-500">
                Otomatik e-posta şablonlarını düzenleyin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: "Hoş Geldiniz", description: "Yeni kayıt sonrası gönderilir" },
                  { name: "Fatura Bildirimi", description: "Yeni fatura oluşturulduğunda" },
                  { name: "Ödeme Hatırlatma", description: "Vadesi yaklaşan faturalar için" },
                  { name: "Hizmet Yenileme", description: "Süre bitimi yaklaşırken" },
                  { name: "Destek Yanıtı", description: "Destek talebine yanıt verildiğinde" },
                ].map((template) => (
                  <div
                    key={template.name}
                    className="flex items-center justify-between p-3 rounded-lg bg-zinc-100 dark:bg-zinc-200 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-200 dark:bg-zinc-800 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{template.name}</p>
                      <p className="text-xs text-zinc-500">{template.description}</p>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                      Düzenle
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="mt-6 space-y-6">
          <form action={saveNotificationSettings}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white">Bildirim Tercihleri</CardTitle>
                <CardDescription className="text-zinc-500">
                  Hangi bildirimleri almak istediğinizi seçin
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <NotificationSwitches
                  emailNotifications={emailNotifications}
                  smsNotifications={smsNotifications}
                  autoInvoice={autoInvoice}
                />
                <div className="flex justify-end">
                  <Button type="submit" className="bg-primary hover:bg-primary/90">
                    <Save className="mr-2 h-4 w-4" />
                    Bildirim Ayarlarını Kaydet
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payment" className="mt-6 space-y-6">
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-900 dark:text-white">Ödeme Yöntemleri</CardTitle>
              <CardDescription className="text-zinc-500">
                Kabul edilen ödeme yöntemlerini yapılandırın
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { name: "Kredi Kartı", provider: "Stripe", status: "active" as const },
                { name: "Banka Havalesi", provider: "Manuel Onay", status: "active" as const },
              ].map((method) => (
                <div
                  key={method.name}
                  className="flex items-center justify-between p-4 rounded-lg bg-zinc-100 dark:bg-zinc-200 dark:bg-zinc-800/50"
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-zinc-500" />
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{method.name}</p>
                      <p className="text-xs text-zinc-500">{method.provider}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={method.status === "active" ? "default" : "secondary"}>
                      {method.status === "active" ? "Aktif" : "Pasif"}
                    </Badge>
                    <Button variant="ghost" size="sm" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white" asChild>
                      <Link href="/yonetim/entegrasyonlar?tab=payment">
                        Yapılandır
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="mt-6 space-y-6">
          <form action={saveSecuritySettings}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white">Güvenlik Ayarları</CardTitle>
                <CardDescription className="text-zinc-500">
                  Hesap güvenliğinizi yönetin
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <SecuritySwitch twoFactor={twoFactor} />
                <Separator className="bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">Şifre Değiştir</p>
                    <p className="text-xs text-zinc-500">Son değişiklik: 3 ay önce</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                    Değiştir
                  </Button>
                </div>
                <Separator className="bg-zinc-200 dark:bg-zinc-800" />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">Aktif Oturumlar</p>
                    <p className="text-xs text-zinc-500">2 aktif oturum</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                    Görüntüle
                  </Button>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" className="bg-primary hover:bg-primary/90">
                    <Save className="mr-2 h-4 w-4" />
                    Güvenlik Ayarlarını Kaydet
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </TabsContent>

        {/* Users */}
        <TabsContent value="users" className="mt-6 space-y-6">
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-zinc-900 dark:text-white">Admin Kullanıcıları</CardTitle>
                <CardDescription className="text-zinc-500">
                  Yönetim paneline erişimi olan kullanıcılar
                </CardDescription>
              </div>
              <Button className="bg-primary hover:bg-primary/90">
                <Users className="mr-2 h-4 w-4" />
                Kullanıcı Ekle
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {adminUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-zinc-100 dark:bg-zinc-200 dark:bg-zinc-800/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white text-sm font-medium">
                        {user.name.charAt(0)}{user.surname.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">{user.name} {user.surname}</p>
                        <p className="text-xs text-zinc-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <Badge variant="outline">Admin</Badge>
                        {user.lastLoginAt && (
                          <p className="text-xs text-zinc-500 mt-1">
                            Son: {new Date(user.lastLoginAt).toLocaleDateString("tr-TR")}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                        Düzenle
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API */}
        <TabsContent value="api" className="mt-6 space-y-6">
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-zinc-900 dark:text-white">API Anahtarları</CardTitle>
                <CardDescription className="text-zinc-500">
                  Entegrasyonlar için API anahtarlarınızı yönetin
                </CardDescription>
              </div>
              <Button className="bg-primary hover:bg-primary/90">
                <Key className="mr-2 h-4 w-4" />
                Yeni Anahtar
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {apiKeys.map((apiKey) => (
                  <div
                    key={apiKey.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-zinc-100 dark:bg-zinc-200 dark:bg-zinc-800/50"
                  >
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{apiKey.name}</p>
                      <p className="text-xs font-mono text-zinc-500">{maskApiKey(apiKey.keyPrefix)}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right text-xs text-zinc-500">
                        <p>Oluşturulma: {new Date(apiKey.createdAt).toLocaleDateString("tr-TR")}</p>
                        {apiKey.lastUsedAt && (
                          <p>Son kullanım: {new Date(apiKey.lastUsedAt).toLocaleDateString("tr-TR")}</p>
                        )}
                      </div>
                      <form action={revokeAdminApiKey}>
                        <input type="hidden" name="id" value={apiKey.id} />
                        <Button type="submit" variant="destructive" size="sm">
                          İptal Et
                        </Button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle className="text-zinc-900 dark:text-white">Entegrasyonlar</CardTitle>
              <CardDescription className="text-zinc-500">
                Registrar, ödeme, webhook ve diğer modüller Entegrasyonlar sayfasına taşındı
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/yonetim/entegrasyonlar">
                  Entegrasyonları Yönet
                  <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </BlurFade>
    </div>
  );
}

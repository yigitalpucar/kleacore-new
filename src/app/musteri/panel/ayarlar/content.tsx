"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Key,
  KeyRound,
  Lock,
  Mail,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
  X,
  Ban,
} from "lucide-react";
import {
  DetailList,
  EmptyState,
  FormField,
  FormSection,
  IconTile,
  PageHeader,
  SectionCard,
  StatusBadge,
  ToneDot,
  UnavailableAction,
  appButton,
} from "@/components/app";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { cn } from "@/lib/utils";
import { updateProfile, changePassword } from "@/lib/actions/customer/profile";
import { createApiKey, revokeApiKey, deleteApiKey } from "@/lib/actions/customer/api-keys";
import { disable2FA, enable2FA, verify2FASetup } from "@/lib/actions/customer/two-factor";
import { SecurityActivity, type SecurityOverviewData } from "./security-activity";

interface ProfileData {
  name: string;
  surname: string;
  email: string;
  phone: string;
  companyName: string;
  taxNumber: string;
  taxOffice: string;
  address: string;
  city: string;
  country: string;
}

interface ApiKeyData {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface AyarlarContentProps {
  profile: ProfileData | null;
  apiKeys: ApiKeyData[];
  twoFactorEnabled: boolean;
  twoFactorSetupPending: boolean;
  twoFactorGloballyEnabled: boolean;
  /** Staff sent here by require_staff_2fa: open the security tab with a notice. */
  staffTwoFactorRequired?: boolean;
  /** Tab to open first (?sekme=guvenlik from security mails). */
  initialTab?: "security";
  /** Logins, sessions and remembered devices for the security tab. */
  security: SecurityOverviewData;
}

interface NewlyCreatedApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
}

// Shown for reference only: preferences can't be saved yet (no server action).
const notificationGroups = [
  {
    title: "E-posta",
    items: [
      { id: "email_invoices", enabled: true, label: "Fatura bildirimleri", description: "Yeni fatura ve ödeme hatırlatmaları" },
      { id: "email_services", enabled: true, label: "Hizmet bildirimleri", description: "Hizmet yenileme ve süre bitimi uyarıları" },
      { id: "email_support", enabled: true, label: "Destek bildirimleri", description: "Destek taleplerinize gelen yanıtlar" },
      { id: "email_marketing", enabled: false, label: "Kampanya ve duyurular", description: "İndirimler, yeni ürünler ve duyurular" },
    ],
  },
  {
    title: "SMS",
    items: [{ id: "sms_critical", enabled: true, label: "Kritik uyarılar", description: "Hizmet kesintisi gibi acil durumlar için SMS" }],
  },
];

type TabId = "profile" | "security" | "notifications" | "api";

const tabs: { id: TabId; label: string; description: string; icon: typeof User }[] = [
  { id: "profile", label: "Profil", description: "Kişisel ve fatura bilgileri", icon: User },
  { id: "security", label: "Güvenlik", description: "Şifre, 2FA, oturumlar ve cihazlar", icon: ShieldCheck },
  { id: "notifications", label: "Bildirimler", description: "E-posta ve SMS tercihleri", icon: Bell },
  { id: "api", label: "API erişimi", description: "API anahtarları", icon: KeyRound },
];

const inputCls = "h-11 md:h-10";
// The settings nav already takes the left column, so stack FormSection titles above their cards.
const sectionCls = "lg:grid-cols-1 lg:gap-4";

export function AyarlarContent({
  profile,
  apiKeys,
  twoFactorEnabled,
  twoFactorSetupPending,
  twoFactorGloballyEnabled,
  staffTwoFactorRequired = false,
  initialTab,
  security,
}: AyarlarContentProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>(staffTwoFactorRequired ? "security" : (initialTab ?? "profile"));
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState(
    profile ?? {
      name: "",
      surname: "",
      email: "",
      phone: "",
      companyName: "",
      taxNumber: "",
      taxOffice: "",
      address: "",
      city: "",
      country: "Turkiye",
    }
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    staffTwoFactorRequired
      ? { type: "error", text: "Yönetim paneline erişmek için önce iki faktörlü doğrulamayı etkinleştirmeniz gerekiyor." }
      : null
  );
  const [showCreateKeyForm, setShowCreateKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<NewlyCreatedApiKey | null>(null);
  const [apiKeyActionId, setApiKeyActionId] = useState<string | null>(null);
  const [twoFactorActive, setTwoFactorActive] = useState(twoFactorEnabled);
  const [twoFactorSetupOpen, setTwoFactorSetupOpen] = useState(twoFactorSetupPending);
  const [twoFactorQrCode, setTwoFactorQrCode] = useState<string | null>(null);
  const [twoFactorManualKey, setTwoFactorManualKey] = useState("");
  const [twoFactorVerifyCode, setTwoFactorVerifyCode] = useState("");
  const [twoFactorBackupCodes, setTwoFactorBackupCodes] = useState<string[]>([]);
  const [twoFactorDisablePassword, setTwoFactorDisablePassword] = useState("");
  const [twoFactorDisableCode, setTwoFactorDisableCode] = useState("");
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  useEffect(() => {
    if (!twoFactorSetupPending || twoFactorQrCode || twoFactorActive) {
      return;
    }

    void (async () => {
      setTwoFactorLoading(true);
      const result = await enable2FA();
      setTwoFactorLoading(false);

      if (result.success && result.qrCodeDataUrl && result.manualEntryKey) {
        setTwoFactorSetupOpen(true);
        setTwoFactorQrCode(result.qrCodeDataUrl);
        setTwoFactorManualKey(result.manualEntryKey);
      }
    })();
  }, [twoFactorSetupPending, twoFactorQrCode, twoFactorActive]);

  const selectTab = (id: TabId) => {
    setActiveTab(id);
    setMessage(null);
  };

  const copyToClipboard = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleProfileSave = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    setSaving(true);
    setMessage(null);
    const fd = new FormData();
    fd.set("name", formData.name);
    fd.set("surname", formData.surname);
    fd.set("phone", formData.phone);
    fd.set("address", formData.address);
    fd.set("city", formData.city);
    fd.set("companyName", formData.companyName);
    fd.set("taxNumber", formData.taxNumber);
    fd.set("taxOffice", formData.taxOffice);

    const result = await updateProfile(fd);
    setSaving(false);
    if (result.success) {
      setMessage({ type: "success", text: "Profil başarıyla güncellendi." });
    } else {
      setMessage({ type: "error", text: result.error ?? "Bir hata oluştu." });
    }
  };

  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setSaving(true);
    setMessage(null);
    const fd = new FormData(form);

    const result = await changePassword(fd);
    setSaving(false);
    if (result.success) {
      setMessage({ type: "success", text: "Şifre başarıyla değiştirildi." });
      form.reset();
    } else {
      setMessage({ type: "error", text: result.error ?? "Bir hata oluştu." });
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const fd = new FormData();
    fd.set("name", newKeyName.trim());

    const result = await createApiKey(fd);
    setSaving(false);

    if (result.success && result.apiKey) {
      setNewlyCreatedKey(result.apiKey);
      setNewKeyName("");
      setShowCreateKeyForm(false);
      setMessage({
        type: "success",
        text: "API anahtarı oluşturuldu. Anahtarı yalnızca bir kez görebilirsiniz; güvenli bir yere kaydedin.",
      });
      router.refresh();
    } else {
      setMessage({ type: "error", text: result.error ?? "Bir hata oluştu." });
    }
  };

  const handleRevokeApiKey = async (id: string) => {
    if (!confirm("Bu API anahtarını iptal etmek istediğinize emin misiniz?")) {
      return;
    }

    setApiKeyActionId(id);
    setMessage(null);

    const fd = new FormData();
    fd.set("id", id);

    const result = await revokeApiKey(fd);
    setApiKeyActionId(null);

    if (result.success) {
      if (newlyCreatedKey?.id === id) {
        setNewlyCreatedKey(null);
      }
      setMessage({ type: "success", text: "API anahtarı iptal edildi." });
      router.refresh();
    } else {
      setMessage({ type: "error", text: result.error ?? "Bir hata oluştu." });
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm("Bu API anahtarını kalıcı olarak silmek istediğinize emin misiniz?")) {
      return;
    }

    setApiKeyActionId(id);
    setMessage(null);

    const fd = new FormData();
    fd.set("id", id);

    const result = await deleteApiKey(fd);
    setApiKeyActionId(null);

    if (result.success) {
      if (newlyCreatedKey?.id === id) {
        setNewlyCreatedKey(null);
      }
      setMessage({ type: "success", text: "API anahtarı silindi." });
      router.refresh();
    } else {
      setMessage({ type: "error", text: result.error ?? "Bir hata oluştu." });
    }
  };

  const handleEnableTwoFactor = async () => {
    setTwoFactorLoading(true);
    setMessage(null);

    const result = await enable2FA();
    setTwoFactorLoading(false);

    if (result.success && result.qrCodeDataUrl && result.manualEntryKey) {
      setTwoFactorSetupOpen(true);
      setTwoFactorQrCode(result.qrCodeDataUrl);
      setTwoFactorManualKey(result.manualEntryKey);
      setMessage({
        type: "success",
        text: "QR kodu oluşturuldu. Authenticator uygulamanıza ekleyip doğrulama kodunu girin.",
      });
      return;
    }

    setMessage({ type: "error", text: result.error ?? "İki faktörlü doğrulama başlatılamadı." });
  };

  const handleVerifyTwoFactorSetup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTwoFactorLoading(true);
    setMessage(null);

    const fd = new FormData();
    fd.set("code", twoFactorVerifyCode.trim());

    const result = await verify2FASetup(fd);
    setTwoFactorLoading(false);

    if (result.success && result.backupCodes) {
      setTwoFactorActive(true);
      setTwoFactorSetupOpen(false);
      setTwoFactorBackupCodes(result.backupCodes);
      setTwoFactorVerifyCode("");
      setTwoFactorQrCode(null);
      setTwoFactorManualKey("");
      setMessage({ type: "success", text: "İki faktörlü doğrulama başarıyla etkinleştirildi." });
      router.refresh();
      return;
    }

    setMessage({ type: "error", text: result.error ?? "Doğrulama kodu hatalı." });
  };

  const handleDisableTwoFactor = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTwoFactorLoading(true);
    setMessage(null);

    const fd = new FormData();
    fd.set("password", twoFactorDisablePassword);
    fd.set("code", twoFactorDisableCode.trim());

    const result = await disable2FA(fd);
    setTwoFactorLoading(false);

    if (result.success) {
      setTwoFactorActive(false);
      setTwoFactorSetupOpen(false);
      setTwoFactorBackupCodes([]);
      setTwoFactorDisablePassword("");
      setTwoFactorDisableCode("");
      setMessage({ type: "success", text: "İki faktörlü doğrulama devre dışı bırakıldı." });
      router.refresh();
      return;
    }

    setMessage({ type: "error", text: result.error ?? "İki faktörlü doğrulama kapatılamadı." });
  };

  const initials = `${formData.name?.[0] ?? ""}${formData.surname?.[0] ?? ""}`.toLocaleUpperCase("tr-TR") || "?";
  const fullName = `${formData.name} ${formData.surname}`.trim();

  const twoFactorStatus = twoFactorActive
    ? { tone: "success" as const, label: "Etkin" }
    : twoFactorSetupOpen
      ? { tone: "warning" as const, label: "Kurulum sürüyor" }
      : { tone: "muted" as const, label: "Kapalı" };

  return (
    <>
      <PageHeader title="Hesap ayarları" description="Profil, güvenlik, bildirim ve API ayarlarınızı yönetin." />

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        {/* Section nav: horizontal scroll row on phones, sidebar on lg */}
        <nav aria-label="Ayar bölümleri" className="lg:w-56 lg:shrink-0">
          <div
            role="tablist"
            className="grid grid-cols-2 gap-1 md:flex md:flex-wrap lg:sticky lg:top-20 lg:flex-col"
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={active}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => selectTab(tab.id)}
                  className={cn(
                    "relative flex h-11 shrink-0 items-center gap-2.5 rounded-md border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-auto lg:w-full lg:border-transparent lg:py-2",
                    active
                      ? "border-border bg-muted font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {active ? (
                    <span aria-hidden className="absolute inset-y-1.5 left-0 hidden w-0.5 rounded-full bg-foreground lg:block" />
                  ) : null}
                  <tab.icon aria-hidden className="size-4 shrink-0" />
                  <span className="lg:flex lg:flex-col lg:items-start">
                    <span>{tab.label}</span>
                    <span className="hidden text-xs font-normal text-muted-foreground lg:block">{tab.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className="min-w-0 flex-1 space-y-8"
        >
          {message ? (
            <div
              role={message.type === "error" ? "alert" : "status"}
              className={cn(
                "flex items-start gap-3 rounded-lg border bg-card px-4 py-3 text-sm shadow-sm",
                message.type === "error" && "border-red-500/40"
              )}
            >
              <ToneDot tone={message.type === "success" ? "success" : "danger"} className="mt-1.5" />
              <p className="min-w-0 flex-1">{message.text}</p>
              <button
                type="button"
                onClick={() => setMessage(null)}
                aria-label="Mesajı kapat"
                className={cn(appButton({ variant: "ghost", size: "icon-sm" }), "-my-1.5 -mr-2")}
              >
                <X aria-hidden />
              </button>
            </div>
          ) : null}

          {activeTab === "profile" ? (
            <>
              <div className="flex items-center gap-4 rounded-lg border bg-card p-4 shadow-sm md:p-5">
                <span
                  aria-hidden
                  className="flex size-14 shrink-0 items-center justify-center rounded-full border bg-muted text-lg font-semibold tracking-tight"
                >
                  {initials}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold tracking-tight">{fullName || "İsimsiz kullanıcı"}</p>
                  <p className="truncate text-sm text-muted-foreground">{formData.email}</p>
                  {formData.companyName ? (
                    <p className="truncate text-xs text-muted-foreground">{formData.companyName}</p>
                  ) : null}
                </div>
              </div>

              <form onSubmit={handleProfileSave} className="space-y-8">
                <FormSection
                className={sectionCls}
                  title="Kişisel bilgiler"
                  description="Ad, soyad ve iletişim bilgileriniz. Faturalarınızda bu bilgiler kullanılır."
                  footer={
                    <button type="submit" className={appButton()} disabled={saving}>
                      {saving ? "Kaydediliyor…" : "Kaydet"}
                    </button>
                  }
                >
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField label="Ad" htmlFor="name">
                      <Input
                        id="name"
                        autoComplete="given-name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={inputCls}
                      />
                    </FormField>
                    <FormField label="Soyad" htmlFor="surname">
                      <Input
                        id="surname"
                        autoComplete="family-name"
                        value={formData.surname}
                        onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                        className={inputCls}
                      />
                    </FormField>
                  </div>
                  <FormField label="E-posta" htmlFor="email" hint="Giriş adresiniz bu sayfadan değiştirilemez.">
                    <Input id="email" type="email" value={formData.email} disabled className={inputCls} />
                  </FormField>
                  <FormField label="Telefon" htmlFor="phone">
                    <Input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="+90 5xx xxx xx xx"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className={inputCls}
                    />
                  </FormField>
                </FormSection>

                <FormSection
                className={sectionCls}
                  title="Şirket ve fatura adresi"
                  description="Kurumsal fatura için şirket unvanı ve vergi bilgilerinizi girin."
                  footer={
                    <button type="submit" className={appButton()} disabled={saving}>
                      {saving ? "Kaydediliyor…" : "Kaydet"}
                    </button>
                  }
                >
                  <FormField label="Şirket adı" htmlFor="companyName" hint="Bireysel faturada boş bırakın.">
                    <Input
                      id="companyName"
                      autoComplete="organization"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      className={inputCls}
                    />
                  </FormField>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField label="Vergi dairesi" htmlFor="taxOffice">
                      <Input
                        id="taxOffice"
                        value={formData.taxOffice}
                        onChange={(e) => setFormData({ ...formData, taxOffice: e.target.value })}
                        className={inputCls}
                      />
                    </FormField>
                    <FormField label="Vergi / T.C. kimlik no" htmlFor="taxNumber">
                      <Input
                        id="taxNumber"
                        inputMode="numeric"
                        value={formData.taxNumber}
                        onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                        className={cn(inputCls, "font-mono")}
                      />
                    </FormField>
                  </div>
                  <FormField label="Adres" htmlFor="address">
                    <Textarea
                      id="address"
                      autoComplete="street-address"
                      rows={3}
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </FormField>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField label="Şehir" htmlFor="city">
                      <Input
                        id="city"
                        autoComplete="address-level1"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className={inputCls}
                      />
                    </FormField>
                    <FormField label="Ülke" htmlFor="country">
                      <Input id="country" value={formData.country} disabled className={inputCls} />
                    </FormField>
                  </div>
                </FormSection>
              </form>
            </>
          ) : null}

          {activeTab === "security" ? (
            <>
              <form onSubmit={handlePasswordChange}>
                <FormSection
                className={sectionCls}
                  title="Şifre"
                  description="En az 8 karakter; büyük harf, küçük harf ve rakam içermeli."
                  footer={
                    <button type="submit" className={appButton()} disabled={saving}>
                      <Lock aria-hidden />
                      {saving ? "Değiştiriliyor…" : "Şifreyi değiştir"}
                    </button>
                  }
                >
                  <FormField label="Mevcut şifre" htmlFor="currentPassword">
                    <div className="relative">
                      <Input
                        id="currentPassword"
                        name="currentPassword"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        className={cn(inputCls, "pr-12")}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Şifreleri gizle" : "Şifreleri göster"}
                        aria-pressed={showPassword}
                        className={cn(
                          appButton({ variant: "ghost", size: "icon-sm" }),
                          "absolute right-0.5 top-1/2 -translate-y-1/2 text-muted-foreground md:right-1"
                        )}
                      >
                        {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                      </button>
                    </div>
                  </FormField>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField label="Yeni şifre" htmlFor="newPassword">
                      <Input
                        id="newPassword"
                        name="newPassword"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        className={inputCls}
                        required
                      />
                    </FormField>
                    <FormField label="Yeni şifre (tekrar)" htmlFor="confirmPassword">
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        className={inputCls}
                        required
                      />
                    </FormField>
                  </div>
                </FormSection>
              </form>

              <FormSection
                className={sectionCls}
                title="İki faktörlü doğrulama"
                description="Girişte şifrenize ek olarak authenticator uygulamanızdaki 6 haneli kod istenir."
              >
                {!twoFactorGloballyEnabled ? (
                  <p className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
                    <ToneDot tone="warning" className="mt-1.5" />
                    İki faktörlü doğrulama sistem yöneticisi tarafından devre dışı bırakılmış.
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  <IconTile>
                    <Smartphone />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Authenticator uygulaması</p>
                    <p className="text-[13px] text-muted-foreground">Google Authenticator, Authy veya benzeri</p>
                  </div>
                  {twoFactorActive || twoFactorSetupOpen ? (
                    <StatusBadge tone={twoFactorStatus.tone} label={twoFactorStatus.label} />
                  ) : (
                    <button
                      type="button"
                      className={appButton({ variant: "outline" })}
                      onClick={handleEnableTwoFactor}
                      disabled={!twoFactorGloballyEnabled || twoFactorLoading}
                    >
                      {twoFactorLoading ? "Hazırlanıyor…" : "Etkinleştir"}
                    </button>
                  )}
                </div>

                {twoFactorSetupOpen ? (
                  <div className="grid gap-5 rounded-lg border border-dashed p-4 md:grid-cols-[auto_minmax(0,1fr)] md:gap-6">
                    <div className="space-y-3">
                      <p className="text-sm font-medium leading-none">Adım 1 · QR kodu tarayın</p>
                      {twoFactorQrCode ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={twoFactorQrCode}
                          alt="İki faktörlü doğrulama QR kodu"
                          className="mx-auto size-48 rounded-md border bg-white p-2 md:mx-0"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {twoFactorLoading
                            ? "QR kodu hazırlanıyor…"
                            : "Kurulum bekleniyor. Lütfen “Etkinleştir” düğmesine tekrar tıklayın."}
                        </p>
                      )}
                    </div>
                    <div className="min-w-0 space-y-5">
                      {twoFactorManualKey ? (
                        <div className="space-y-1.5">
                          <p className="text-xs text-muted-foreground">QR kodu tarayamıyorsanız bu anahtarı elle girin:</p>
                          <div className="flex items-center gap-2">
                            <code className="min-w-0 flex-1 break-all rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
                              {twoFactorManualKey}
                            </code>
                            <button
                              type="button"
                              className={appButton({ variant: "outline", size: "icon" })}
                              onClick={() => copyToClipboard(twoFactorManualKey, "2fa-secret")}
                              aria-label="Anahtarı kopyala"
                            >
                              {copiedKey === "2fa-secret" ? <CheckCircle2 aria-hidden /> : <Copy aria-hidden />}
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <form onSubmit={handleVerifyTwoFactorSetup} className="space-y-3">
                        <FormField label="Adım 2 · Doğrulama kodu" htmlFor="twoFactorVerifyCode">
                          <Input
                            id="twoFactorVerifyCode"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="123456"
                            value={twoFactorVerifyCode}
                            onChange={(e) => setTwoFactorVerifyCode(e.target.value)}
                            required
                            disabled={twoFactorLoading}
                            className={cn(inputCls, "max-w-[200px] font-mono tracking-[0.3em]")}
                          />
                        </FormField>
                        <button
                          type="submit"
                          className={appButton()}
                          disabled={twoFactorLoading || !twoFactorVerifyCode.trim()}
                        >
                          {twoFactorLoading ? "Doğrulanıyor…" : "Doğrula ve etkinleştir"}
                        </button>
                      </form>
                    </div>
                  </div>
                ) : null}

                {twoFactorBackupCodes.length > 0 ? (
                  <div className="space-y-3 rounded-lg border border-amber-500/40 p-4">
                    <div className="flex items-start gap-2">
                      <ToneDot tone="warning" className="mt-1.5" />
                      <div>
                        <p className="text-sm font-medium">Yedek kodlarınızı kaydedin</p>
                        <p className="text-[13px] text-muted-foreground">
                          Telefonunuza erişemezseniz bu kodlardan birini kullanabilirsiniz. Her kod yalnızca bir kez
                          kullanılabilir ve bir daha gösterilmez.
                        </p>
                      </div>
                    </div>
                    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {twoFactorBackupCodes.map((code) => (
                        <li
                          key={code}
                          className="rounded-md border bg-muted/40 px-3 py-2 text-center font-mono text-sm tracking-wider"
                        >
                          {code}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className={appButton({ variant: "outline", size: "sm" })}
                      onClick={() => copyToClipboard(twoFactorBackupCodes.join("\n"), "2fa-backup")}
                    >
                      {copiedKey === "2fa-backup" ? <CheckCircle2 aria-hidden /> : <Copy aria-hidden />}
                      {copiedKey === "2fa-backup" ? "Kopyalandı" : "Tümünü kopyala"}
                    </button>
                  </div>
                ) : null}

                {twoFactorActive ? (
                  <form onSubmit={handleDisableTwoFactor} className="space-y-4 border-t border-dashed pt-5">
                    <div>
                      <p className="text-sm font-medium">İki faktörlü doğrulamayı kapat</p>
                      <p className="text-[13px] text-muted-foreground">
                        Onaylamak için şifrenizi ve authenticator ya da yedek kodunuzu girin.
                      </p>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <FormField label="Mevcut şifre" htmlFor="twoFactorDisablePassword">
                        <Input
                          id="twoFactorDisablePassword"
                          type="password"
                          autoComplete="current-password"
                          value={twoFactorDisablePassword}
                          onChange={(e) => setTwoFactorDisablePassword(e.target.value)}
                          required
                          disabled={twoFactorLoading}
                          className={inputCls}
                        />
                      </FormField>
                      <FormField label="Authenticator veya yedek kod" htmlFor="twoFactorDisableCode">
                        <Input
                          id="twoFactorDisableCode"
                          autoComplete="one-time-code"
                          value={twoFactorDisableCode}
                          onChange={(e) => setTwoFactorDisableCode(e.target.value)}
                          required
                          disabled={twoFactorLoading}
                          className={cn(inputCls, "font-mono")}
                        />
                      </FormField>
                    </div>
                    <button type="submit" className={appButton({ variant: "destructive" })} disabled={twoFactorLoading}>
                      {twoFactorLoading ? "Kapatılıyor…" : "İki faktörlü doğrulamayı kapat"}
                    </button>
                  </form>
                ) : null}

                <div className="space-y-3 border-t border-dashed pt-5">
                  <p className="text-[13px] text-muted-foreground">Diğer doğrulama yöntemleri</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <UnavailableAction
                      layout="tile"
                      icon={<Mail aria-hidden />}
                      label="E-posta ile kod"
                      description="Kod e-postayla gelir"
                    />
                    <UnavailableAction
                      layout="tile"
                      icon={<Smartphone aria-hidden />}
                      label="SMS ile kod"
                      description="Kod SMS ile gelir"
                    />
                  </div>
                </div>
              </FormSection>

              <SecurityActivity data={security} />

              <FormSection
                className={sectionCls}
                title="Hesabı kapat"
                description="Hesabınız kapatılır ve kişisel verileriniz anonimleştirilir. Bu işlem geri alınamaz."
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Hesap silme bir KVKK silme başvurusuyla yapılır; başvurunuz incelenip en geç 30 gün içinde sonuçlandırılır.
                    Faturalar yasal süre boyunca saklanır.
                  </p>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Link href="/musteri/panel/kvkk?tur=silme" className={appButton({ variant: "outline" })}>
                      <Trash2 aria-hidden />
                      Silme başvurusu
                    </Link>
                    <Link href="/musteri/panel/kvkk?tur=kopya" className={appButton({ variant: "ghost" })}>
                      Verilerimin kopyası
                    </Link>
                  </div>
                </div>
              </FormSection>
            </>
          ) : null}

          {activeTab === "notifications" ? (
            <FormSection
                className={sectionCls}
              title="Bildirim tercihleri"
              description="Hangi konularda e-posta veya SMS almak istediğinizi seçin."
              footer={<UnavailableAction variant="primary" label="Tercihleri kaydet" />}
            >
              <p className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2.5 text-[13px] text-muted-foreground">
                <ToneDot tone="info" className="mt-1.5" />
                Varsayılan tercihler gösteriliyor. Tercihleri değiştirip kaydetme özelliği yakında eklenecek.
              </p>
              {notificationGroups.map((group) => (
                <fieldset key={group.title} className="space-y-2">
                  <legend className="mb-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {group.title}
                  </legend>
                  <div className="divide-y rounded-md border">
                    {group.items.map((item) => (
                      <div key={item.id} className="flex min-h-14 items-center justify-between gap-4 px-3 py-3">
                        <div className="min-w-0 space-y-0.5">
                          <label htmlFor={`notif-${item.id}`} className="text-sm font-medium">
                            {item.label}
                          </label>
                          <p className="text-[13px] text-muted-foreground">{item.description}</p>
                        </div>
                        <Switch id={`notif-${item.id}`} checked={item.enabled} disabled />
                      </div>
                    ))}
                  </div>
                </fieldset>
              ))}
            </FormSection>
          ) : null}

          {activeTab === "api" ? (
            <>
              <SectionCard
                title="API anahtarları"
                description="Entegrasyonlarınız için anahtar oluşturun. Anahtarın tamamı yalnızca oluşturulduğunda gösterilir."
                actions={
                  !showCreateKeyForm ? (
                    <button
                      type="button"
                      className={appButton({ size: "sm" })}
                      onClick={() => setShowCreateKeyForm(true)}
                      disabled={saving}
                    >
                      <Plus aria-hidden />
                      Yeni anahtar
                    </button>
                  ) : null
                }
                flush
              >
                {showCreateKeyForm ? (
                  <form onSubmit={handleCreateApiKey} className="space-y-3 border-b bg-muted/30 p-4 md:p-5">
                    <FormField label="Anahtar adı" htmlFor="apiKeyName" hint="Anahtarı nerede kullandığınızı hatırlatacak bir ad verin.">
                      <Input
                        id="apiKeyName"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="Örn: Muhasebe entegrasyonu"
                        maxLength={100}
                        required
                        autoFocus
                        className={cn(inputCls, "bg-background sm:max-w-sm")}
                      />
                    </FormField>
                    <div className="flex flex-wrap gap-2">
                      <button type="submit" className={appButton()} disabled={saving || !newKeyName.trim()}>
                        {saving ? "Oluşturuluyor…" : "Oluştur"}
                      </button>
                      <button
                        type="button"
                        className={appButton({ variant: "outline" })}
                        onClick={() => {
                          setShowCreateKeyForm(false);
                          setNewKeyName("");
                        }}
                        disabled={saving}
                      >
                        Vazgeç
                      </button>
                    </div>
                  </form>
                ) : null}

                {newlyCreatedKey ? (
                  <div className="space-y-3 border-b p-4 md:p-5">
                    <div className="flex items-start gap-2">
                      <ToneDot tone="warning" className="mt-1.5" />
                      <div>
                        <p className="text-sm font-medium">“{newlyCreatedKey.name}” anahtarı oluşturuldu</p>
                        <p className="text-[13px] text-muted-foreground">
                          Bu anahtarı yalnızca bir kez görebilirsiniz. Güvenli bir yere kaydedin.
                        </p>
                      </div>
                    </div>
                    <code className="block break-all rounded-md border bg-muted/40 px-3 py-2.5 font-mono text-[13px]">
                      {newlyCreatedKey.key}
                    </code>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={appButton({ variant: "outline", size: "sm" })}
                        onClick={() => copyToClipboard(newlyCreatedKey.key, newlyCreatedKey.id)}
                      >
                        {copiedKey === newlyCreatedKey.id ? <CheckCircle2 aria-hidden /> : <Copy aria-hidden />}
                        {copiedKey === newlyCreatedKey.id ? "Kopyalandı" : "Kopyala"}
                      </button>
                      <button
                        type="button"
                        className={appButton({ variant: "ghost", size: "sm" })}
                        onClick={() => setNewlyCreatedKey(null)}
                      >
                        Kaydettim
                      </button>
                    </div>
                  </div>
                ) : null}

                {apiKeys.length === 0 ? (
                  <div className="p-4 md:p-5">
                    <EmptyState
                      compact
                      icon={Key}
                      title="Henüz API anahtarınız yok"
                      description="Hizmet, fatura ve destek işlemlerinizi otomatikleştirmek için bir anahtar oluşturun."
                    />
                  </div>
                ) : (
                  <ul className="divide-y">
                    {apiKeys.map((apiKey) => {
                      const busy = apiKeyActionId === apiKey.id;
                      return (
                        <li
                          key={apiKey.id}
                          className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between md:px-5"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <IconTile size="sm">
                              <Key />
                            </IconTile>
                            <div className="min-w-0 space-y-0.5">
                              <p className="truncate text-sm font-medium">{apiKey.name}</p>
                              <p className="truncate font-mono text-xs text-muted-foreground">{apiKey.key}</p>
                              <p className="text-xs text-muted-foreground">
                                Oluşturuldu {formatDate(apiKey.createdAt)}
                                <span aria-hidden> · </span>
                                {apiKey.lastUsedAt ? `Son kullanım ${formatDateTime(apiKey.lastUsedAt)}` : "Hiç kullanılmadı"}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 pl-11 sm:pl-0">
                            <button
                              type="button"
                              className={appButton({ variant: "outline", size: "sm" })}
                              onClick={() => handleRevokeApiKey(apiKey.id)}
                              disabled={busy}
                            >
                              <Ban aria-hidden />
                              {busy ? "İşleniyor…" : "İptal et"}
                            </button>
                            <button
                              type="button"
                              className={appButton({ variant: "destructive", size: "icon-sm" })}
                              onClick={() => handleDeleteApiKey(apiKey.id)}
                              disabled={busy}
                              aria-label={`${apiKey.name} anahtarını sil`}
                            >
                              <Trash2 aria-hidden />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>

              <SectionCard
                title="API kullanımı"
                description="Entegrasyon için temel bilgiler. Ayrıntılar API dokümantasyonunda."
                footer={
                  <a href="/api-docs" target="_blank" rel="noopener noreferrer" className={appButton({ variant: "outline", size: "sm" })}>
                    <BookOpen aria-hidden />
                    API dokümantasyonu
                  </a>
                }
              >
                <DetailList
                  layout="grid"
                  columns={3}
                  items={[
                    { label: "Ana adres", value: "https://kleacore.com/api/v1", mono: true, copy: "https://kleacore.com/api/v1" },
                    { label: "Yetkilendirme", value: "Authorization: Bearer kc_live_…", mono: true },
                    { label: "İstek limiti", value: "30 istek / 10 dakika (anahtar başına)" },
                  ]}
                />
              </SectionCard>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}

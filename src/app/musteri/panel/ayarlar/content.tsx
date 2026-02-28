"use client";

import { useState } from "react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  User,
  Mail,
  Phone,
  Lock,
  Bell,
  Shield,
  Key,
  Smartphone,
  Building,
  MapPin,
  Save,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Monitor,
  LogOut,
  Clock,
  CheckCircle2,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { updateProfile, changePassword } from "@/lib/actions/customer/profile";

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
}

const notificationSettings = [
  { id: "email_invoices", label: "Fatura bildirimleri", description: "Yeni fatura ve ödeme hatırlatmaları", enabled: true },
  { id: "email_services", label: "Hizmet bildirimleri", description: "Hizmet yenileme ve sona erme uyarilari", enabled: true },
  { id: "email_support", label: "Destek bildirimleri", description: "Destek talebi yanitlari", enabled: true },
  { id: "email_marketing", label: "Pazarlama e-postalari", description: "Kampanya ve duyurular", enabled: false },
  { id: "sms_critical", label: "SMS bildirimleri", description: "Kritik uyarılar için SMS", enabled: true },
];

export function AyarlarContent({ profile, apiKeys }: AyarlarContentProps) {
  const [activeTab, setActiveTab] = useState("profile");
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
  const [notifications, setNotifications] = useState(notificationSettings);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const tabs = [
    { id: "profile", label: "Profil", icon: User },
    { id: "security", label: "Guvenlik", icon: Shield },
    { id: "notifications", label: "Bildirimler", icon: Bell },
    { id: "api", label: "API", icon: Key },
  ];

  const toggleNotification = (id: string) => {
    setNotifications(
      notifications.map((n) =>
        n.id === id ? { ...n, enabled: !n.enabled } : n
      )
    );
  };

  const copyToClipboard = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleProfileSave = async () => {
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
    setSaving(true);
    setMessage(null);
    const fd = new FormData(e.currentTarget);

    const result = await changePassword(fd);
    setSaving(false);
    if (result.success) {
      setMessage({ type: "success", text: "Şifre başarıyla değiştirildi." });
      e.currentTarget.reset();
    } else {
      setMessage({ type: "error", text: result.error ?? "Bir hata oluştu." });
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0.1} inView>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hesap Ayarlari</h1>
          <p className="text-muted-foreground">
            Hesap bilgilerinizi ve tercihlerinizi yonetin.
          </p>
        </div>
      </BlurFade>

      {/* Status message */}
      {message && (
        <div
          className={cn(
            "p-3 rounded-lg text-sm",
            message.type === "success"
              ? "bg-green-500/10 text-green-500"
              : "bg-red-500/10 text-red-500"
          )}
        >
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <BlurFade delay={0.15} inView>
        <div className="flex gap-2 border-b pb-2 overflow-x-auto">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              onClick={() => setActiveTab(tab.id)}
              className="gap-2 shrink-0"
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Button>
          ))}
        </div>
      </BlurFade>

      {/* Profile Tab */}
      {activeTab === "profile" && (
        <BlurFade delay={0.2} inView>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Personal Info */}
            <Card>
              <CardHeader>
                <CardTitle>Kisisel Bilgiler</CardTitle>
                <CardDescription>
                  Ad, soyad ve iletisim bilgileriniz
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Ad</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="surname">Soyad</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="surname"
                        value={formData.surname}
                        onChange={(e) =>
                          setFormData({ ...formData, surname: e.target.value })
                        }
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-posta</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      disabled
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="pl-10"
                    />
                  </div>
                </div>

                <Button
                  className="w-full sm:w-auto"
                  onClick={handleProfileSave}
                  disabled={saving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </CardContent>
            </Card>

            {/* Company & Address */}
            <Card>
              <CardHeader>
                <CardTitle>Sirket & Adres</CardTitle>
                <CardDescription>
                  Fatura ve teslimat bilgileri
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Sirket Adi</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="companyName"
                        value={formData.companyName}
                        onChange={(e) =>
                          setFormData({ ...formData, companyName: e.target.value })
                        }
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxNumber">Vergi No</Label>
                    <Input
                      id="taxNumber"
                      value={formData.taxNumber}
                      onChange={(e) =>
                        setFormData({ ...formData, taxNumber: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Adres</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      className="pl-10 min-h-[80px]"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">Sehir</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) =>
                        setFormData({ ...formData, city: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Ulke</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxOffice">Vergi Dairesi</Label>
                    <Input
                      id="taxOffice"
                      value={formData.taxOffice}
                      onChange={(e) =>
                        setFormData({ ...formData, taxOffice: e.target.value })
                      }
                    />
                  </div>
                </div>

                <Button
                  className="w-full sm:w-auto"
                  onClick={handleProfileSave}
                  disabled={saving}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </BlurFade>
      )}

      {/* Security Tab */}
      {activeTab === "security" && (
        <BlurFade delay={0.2} inView>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Change Password */}
            <Card>
              <CardHeader>
                <CardTitle>Şifre Değiştir</CardTitle>
                <CardDescription>
                  Hesap güvenliğiniz için güçlü bir şifre kullanın
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Mevcut Şifre</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="currentPassword"
                        name="currentPassword"
                        type={showPassword ? "text" : "password"}
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Yeni Şifre</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="newPassword"
                        name="newPassword"
                        type={showPassword ? "text" : "password"}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Yeni Şifre (Tekrar)</Label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={saving}>
                    <Lock className="mr-2 h-4 w-4" />
                    {saving ? "Değiştiriliyor..." : "Şifreyi Değiştir"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Two-Factor Authentication */}
            <Card>
              <CardHeader>
                <CardTitle>İki Faktörlü Doğrulama</CardTitle>
                <CardDescription>
                  Hesabınıza ekstra güvenlik katmanı ekleyin
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Smartphone className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium">Authenticator Uygulaması</p>
                      <p className="text-sm text-muted-foreground">
                        Google Authenticator veya Authy
                      </p>
                    </div>
                  </div>
                  <Button variant="outline">Aktifleştir</Button>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Mail className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-medium">E-posta Doğrulama</p>
                      <p className="text-sm text-muted-foreground">
                        Giriş kodunu e-posta ile al
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-green-500 font-medium">Aktif</span>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Phone className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <p className="font-medium">SMS Doğrulama</p>
                      <p className="text-sm text-muted-foreground">
                        Giriş kodunu SMS ile al
                      </p>
                    </div>
                  </div>
                  <Button variant="outline">Aktiflestir</Button>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="lg:col-span-2 border-red-500/20">
              <CardHeader>
                <CardTitle className="text-red-500 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Tehlikeli Bolge
                </CardTitle>
                <CardDescription>
                  Bu işlemler geri alınamaz. Dikkatli olun.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-red-500/20 bg-red-500/5">
                  <div>
                    <p className="font-medium">Hesabi Sil</p>
                    <p className="text-sm text-muted-foreground">
                      Hesabınızı ve tüm verilerinizi kalıcı olarak silin. Bu işlem geri alınamaz.
                    </p>
                  </div>
                  <Button variant="destructive" className="shrink-0">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hesabi Sil
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </BlurFade>
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <BlurFade delay={0.2} inView>
          <Card>
            <CardHeader>
              <CardTitle>Bildirim Tercihleri</CardTitle>
              <CardDescription>
                Hangi bildirimleri almak istediginizi secin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          notification.enabled
                            ? "bg-green-500/10"
                            : "bg-muted"
                        )}
                      >
                        <Bell
                          className={cn(
                            "h-5 w-5",
                            notification.enabled
                              ? "text-green-500"
                              : "text-muted-foreground"
                          )}
                        />
                      </div>
                      <div>
                        <p className="font-medium">{notification.label}</p>
                        <p className="text-sm text-muted-foreground">
                          {notification.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={notification.enabled}
                      onCheckedChange={() => toggleNotification(notification.id)}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <Button>
                  <Save className="mr-2 h-4 w-4" />
                  Tercihleri Kaydet
                </Button>
              </div>
            </CardContent>
          </Card>
        </BlurFade>
      )}

      {/* API Tab */}
      {activeTab === "api" && (
        <BlurFade delay={0.2} inView>
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>API Anahtarlari</CardTitle>
                  <CardDescription>
                    API entegrasyonlarınız için anahtarlarınızı yönetin
                  </CardDescription>
                </div>
                <Button>
                  <Key className="mr-2 h-4 w-4" />
                  Yeni Anahtar
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {apiKeys.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Henüz API anahtarı oluşturulmamış.
                    </div>
                  )}
                  {apiKeys.map((apiKey) => (
                    <div
                      key={apiKey.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Key className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{apiKey.name}</p>
                          <p className="text-sm font-mono text-muted-foreground">
                            {apiKey.key}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Olusturuldu: {formatDate(apiKey.createdAt)}
                            {apiKey.lastUsedAt &&
                              ` \u2022 Son kullanim: ${formatDate(apiKey.lastUsedAt)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(apiKey.key, apiKey.id)}
                        >
                          {copiedKey === apiKey.id ? (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                              Kopyalandi
                            </>
                          ) : (
                            <>
                              <Copy className="mr-2 h-4 w-4" />
                              Kopyala
                            </>
                          )}
                        </Button>
                        <Button variant="outline" size="sm">
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Yenile
                        </Button>
                        <Button variant="outline" size="sm" className="text-red-500 hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>API Dokumantasyonu</CardTitle>
                <CardDescription>
                  API entegrasyonunuz için gerekli bilgiler
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground">Base URL</p>
                    <p className="font-mono text-sm mt-1">https://api.kleacore.com/v1</p>
                  </div>
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground">Rate Limit</p>
                    <p className="font-mono text-sm mt-1">1000 istek/dakika</p>
                  </div>
                </div>
                <div className="mt-4">
                  <Button variant="outline" asChild>
                    <a href="/api-docs" target="_blank">
                      <Globe className="mr-2 h-4 w-4" />
                      API Dokümantasyonunu Görüntüle
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </BlurFade>
      )}
    </div>
  );
}

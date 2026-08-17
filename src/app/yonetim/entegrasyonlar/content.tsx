"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Globe,
  Key,
  Mail,
  Smartphone,
  Plug,
  RefreshCw,
  Server,
  HardDrive,
  Webhook,
  AlertTriangle,
  XCircle,
  Zap,
  Users,
  FileCheck,
  Shield,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/magicui/blur-fade";
import { cn } from "@/lib/utils";
import type { IntegrationModule, IntegrationOverview } from "@/lib/integrations/module-status";
import {
  importGriTldPricingFromIntegrations,
  saveCpanelWhmIntegrationSettings,
  saveVpsVdsIntegrationSettings,
  saveRegistrarIntegrationSettings,
  savePaymentGatewayIntegrationSettings,
  saveSmsIntegrationSettings,
  saveSmtpIntegrationSettings,
  saveWebhookIntegrationSettings,
  saveEfaturaIntegrationSettings,
  saveSslIntegrationSettings,
  testCpanelWhmConnection,
  testVpsVdsConnection,
  testRegistrarConnection,
  testIyzicoConnection,
  testPaytrConnection,
  testSmsConnection,
  testSmtpConnection,
  testStripeConnection,
  testEfaturaConnection,
  testSslConnection,
} from "@/lib/actions/admin/integrations";
import { IntegrationsFeedbackToast } from "./integrations-feedback-toast";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";

interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

interface CronJobItem {
  name: string;
  path: string;
  schedule: string;
  url: string;
}

interface EntegrasyonlarContentProps {
  defaultTab: string;
  toastStatus?: string;
  toastMessage?: string;
  overview: IntegrationOverview;
  cronJobs: CronJobItem[];
  apiKeys: ApiKeyItem[];
  registrar: {
    enabled: boolean;
    provider: string;
    apiUrl: string;
    apiKey: string;
    username: string;
    hasPassword: boolean;
    clientId: string;
    hasClientSecret: boolean;
    testMode: boolean;
  };
  cpanel: {
    enabled: boolean;
    host: string;
    port: string;
    username: string;
    hasApiToken: boolean;
    defaultPlan: string;
    useSsl: boolean;
    backupEnabled: boolean;
  };
  vpsVds: {
    enabled: boolean;
    provider: string;
    apiUrl: string;
    apiKey: string;
    apiUsername: string;
    hasApiPassword: boolean;
  };
  smtp: {
    server: string;
    port: string;
    username: string;
    hasPassword: boolean;
    notificationsEnabled: boolean;
  };
  sms: {
    enabled: boolean;
    provider: string;
    netgsm: {
      usercode: string;
      hasPassword: boolean;
      header: string;
    };
    iletimerkezi: {
      apiKey: string;
      hasSecret: boolean;
      sender: string;
    };
    notificationsEnabled: boolean;
  };
  webhooks: {
    orders: string;
    payments: string;
  };
  paymentGateway: {
    provider: string;
    iyzico: {
      enabled: boolean;
      apiKey: string;
      hasSecretKey: boolean;
      testMode: boolean;
    };
    paytr: {
      enabled: boolean;
      merchantId: string;
      hasMerchantKey: boolean;
      hasMerchantSalt: boolean;
    };
  };
  efatura: {
    enabled: boolean;
    provider: string;
    hasApiKey: boolean;
    companyVkn: string;
  };
  ssl: {
    enabled: boolean;
    provider: string;
    acmeEmail: string;
    hasSectigoApiKey: boolean;
  };
  env: {
    stripeSecretConfigured: boolean;
    stripeWebhookConfigured: boolean;
    stripePublishableConfigured: boolean;
    cronSecretConfigured: boolean;
    appBaseUrl: string;
  };
}

const categoryLabels: Record<IntegrationModule["category"], string> = {
  domain: "Domain",
  hosting: "Hosting",
  payment: "Ödeme",
  communication: "İletişim",
  automation: "Otomasyon",
  api: "API",
  marketing: "Pazarlama",
};

const moduleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  registrar: Globe,
  "cpanel-whm": Server,
  "vps-vds": HardDrive,
  provisioning: Server,
  stripe: CreditCard,
  iyzico: CreditCard,
  paytr: CreditCard,
  smtp: Mail,
  sms: Smartphone,
  webhooks: Webhook,
  "public-api": Key,
  cron: Clock,
  affiliate: Users,
  efatura: FileCheck,
  ssl: Shield,
};

function StatusBadge({ status }: { status: IntegrationModule["status"] }) {
  const variants: Record<
    IntegrationModule["status"],
    { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    active: {
      label: "Aktif",
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      icon: CheckCircle2,
    },
    builtin: {
      label: "Dahili",
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      icon: Zap,
    },
    inactive: {
      label: "Pasif",
      className: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
      icon: XCircle,
    },
    warning: {
      label: "Uyarı",
      className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      icon: AlertTriangle,
    },
    error: {
      label: "Hata",
      className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
      icon: XCircle,
    },
  };

  const config = variants[status];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn("gap-1", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function ModuleCard({ module }: { module: IntegrationModule }) {
  const Icon = moduleIcons[module.id] ?? Plug;

  return (
    <Link href={`/yonetim/entegrasyonlar?tab=${module.tab}`}>
      <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <Icon className="h-5 w-5 text-zinc-600 dark:text-zinc-300" />
              </div>
              <div>
                <CardTitle className="text-base text-zinc-900 dark:text-white">
                  {module.name}
                </CardTitle>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {categoryLabels[module.category]}
                  {module.provider ? ` · ${module.provider}` : ""}
                </p>
              </div>
            </div>
            <StatusBadge status={module.status} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
            {module.description}
          </p>
          {module.message && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{module.message}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function NotificationsSwitch({
  enabled,
  fieldName,
}: {
  enabled: boolean;
  fieldName: string;
}) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(enabled);

  return (
    <>
      <Switch
        checked={notificationsEnabled}
        onCheckedChange={setNotificationsEnabled}
      />
      <input
        type="hidden"
        name={fieldName}
        value={notificationsEnabled ? "true" : "false"}
      />
    </>
  );
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.substring(0, 7) + "****" + key.substring(key.length - 4);
}

export function EntegrasyonlarContent({
  defaultTab,
  toastStatus,
  toastMessage,
  overview,
  cronJobs,
  apiKeys,
  registrar,
  cpanel,
  vpsVds,
  smtp,
  sms,
  webhooks,
  paymentGateway,
  efatura,
  ssl,
  env,
}: EntegrasyonlarContentProps) {
  return (
    <div className="space-y-6">
      <IntegrationsFeedbackToast
        status={toastStatus}
        message={toastMessage}
        activeTab={defaultTab}
      />

      <BlurFade delay={0}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              Entegrasyonlar & Modüller
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              Tüm harici servisleri ve sistem modüllerini tek yerden yönetin
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Activity className="h-4 w-4" />
            Son kontrol: {new Date(overview.checkedAt).toLocaleString("tr-TR")}
          </div>
        </div>
      </BlurFade>

      <BlurFade delay={0.05}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="pt-4">
              <p className="text-xs text-zinc-500">Toplam Modül</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                {overview.summary.total}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="pt-4">
              <p className="text-xs text-zinc-500">Aktif</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {overview.summary.active}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="pt-4">
              <p className="text-xs text-zinc-500">Pasif</p>
              <p className="text-2xl font-bold text-zinc-600 dark:text-zinc-400">
                {overview.summary.inactive}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="pt-4">
              <p className="text-xs text-zinc-500">Sorunlu</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {overview.summary.error + overview.summary.warning}
              </p>
            </CardContent>
          </Card>
        </div>
      </BlurFade>

      <BlurFade delay={0.1}>
        <Tabs key={defaultTab} defaultValue={defaultTab} className="w-full">
          <TabsList className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
            <TabsTrigger value="registrar">Registrar</TabsTrigger>
            <TabsTrigger value="cpanel">cPanel/WHM</TabsTrigger>
            <TabsTrigger value="vps-vds">VPS/VDS</TabsTrigger>
            <TabsTrigger value="payment">Ödeme</TabsTrigger>
            <TabsTrigger value="efatura">E-Fatura</TabsTrigger>
            <TabsTrigger value="ssl">SSL</TabsTrigger>
            <TabsTrigger value="email">E-posta</TabsTrigger>
            <TabsTrigger value="sms">SMS</TabsTrigger>
            <TabsTrigger value="webhooks">Webhook</TabsTrigger>
            <TabsTrigger value="api">Public API</TabsTrigger>
            <TabsTrigger value="cron">Cron</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {overview.modules.map((module) => (
                <ModuleCard key={module.id} module={module} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="registrar" className="mt-6 space-y-6">
            <form action={saveRegistrarIntegrationSettings} className="space-y-6">
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white">Domain Registrar</CardTitle>
                  <CardDescription>
                    Domain kayıt, nameserver ve DNS işlemleri için sağlayıcı bağlantısı
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Durum</Label>
                      <select
                        name="registrar_enabled"
                        defaultValue={registrar.enabled ? "true" : "false"}
                        className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      >
                        <option value="false">Pasif</option>
                        <option value="true">Aktif</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Provider</Label>
                      <select
                        name="registrar_provider"
                        defaultValue={registrar.provider}
                        className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      >
                        <option value="disabled">Pasif</option>
                        <option value="gri">Gri (B2B API)</option>
                        <option value="generic-http">Generic HTTP</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Test Modu</Label>
                      <select
                        name="registrar_test_mode"
                        defaultValue={registrar.testMode ? "true" : "false"}
                        className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      >
                        <option value="false">Production</option>
                        <option value="true">Sandbox</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>API URL (opsiyonel)</Label>
                      <Input
                        name="registrar_api_url"
                        defaultValue={registrar.apiUrl}
                        placeholder="Boş = Gri varsayılan URL"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Kullanıcı Adı</Label>
                      <Input name="registrar_username" defaultValue={registrar.username} />
                    </div>
                    <div className="space-y-2">
                      <Label>Parola</Label>
                      <Input
                        name="registrar_password"
                        type="password"
                        defaultValue={registrar.hasPassword ? "********" : ""}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Client ID</Label>
                      <Input name="registrar_client_id" defaultValue={registrar.clientId} />
                    </div>
                    <div className="space-y-2">
                      <Label>Client Secret</Label>
                      <Input
                        name="registrar_client_secret"
                        type="password"
                        defaultValue={registrar.hasClientSecret ? "********" : ""}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Generic HTTP API Key</Label>
                    <Input
                      name="registrar_api_key"
                      type="password"
                      defaultValue={registrar.apiKey}
                      placeholder="Sadece generic-http için"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-wrap justify-end gap-2">
                {registrar.provider === "gri" && (
                  <Button formAction={importGriTldPricingFromIntegrations} type="submit" variant="outline">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Gri TLD Fiyatlarını İçe Aktar
                  </Button>
                )}
                <Button formAction={testRegistrarConnection} type="submit" variant="outline">
                  Bağlantıyı Test Et
                </Button>
                <Button type="submit">Kaydet</Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="cpanel" className="mt-6 space-y-6">
            <form action={saveCpanelWhmIntegrationSettings} className="space-y-6">
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white">cPanel / WHM</CardTitle>
                  <CardDescription>
                    Hosting ve e-posta ürünleri için WHM API ile hesap yönetimi
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Durum</Label>
                      <select
                        name="cpanel_enabled"
                        defaultValue={cpanel.enabled ? "true" : "false"}
                        className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      >
                        <option value="false">Pasif</option>
                        <option value="true">Aktif</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Varsayılan Paket</Label>
                      <Input
                        name="cpanel_default_plan"
                        defaultValue={cpanel.defaultPlan}
                        placeholder="default"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>WHM Host</Label>
                      <Input
                        name="cpanel_host"
                        defaultValue={cpanel.host}
                        placeholder="whm.example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Port</Label>
                      <Input name="cpanel_port" defaultValue={cpanel.port} placeholder="2087" />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>WHM Kullanıcı Adı</Label>
                      <Input name="cpanel_username" defaultValue={cpanel.username} placeholder="root" />
                    </div>
                    <div className="space-y-2">
                      <Label>API Token</Label>
                      <Input
                        name="cpanel_api_token"
                        type="password"
                        defaultValue={cpanel.hasApiToken ? "********" : ""}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>SSL Kullan</Label>
                      <select
                        name="cpanel_use_ssl"
                        defaultValue={cpanel.useSsl ? "true" : "false"}
                        className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      >
                        <option value="true">Evet (önerilen)</option>
                        <option value="false">Hayır</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Yedekleme</Label>
                      <select
                        name="backup_enabled"
                        defaultValue={cpanel.backupEnabled ? "true" : "false"}
                        className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      >
                        <option value="true">Aktif</option>
                        <option value="false">Pasif</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Ürün SKU değeri WHM paket adı olarak kullanılır. Hosting ve e-posta kategorilerinde otomatik tetiklenir.
                  </p>
                </CardContent>
              </Card>

              <div className="flex flex-wrap justify-end gap-2">
                <Button formAction={testCpanelWhmConnection} type="submit" variant="outline">
                  Bağlantıyı Test Et
                </Button>
                <Button type="submit">Kaydet</Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="vps-vds" className="mt-6 space-y-6">
            <form action={saveVpsVdsIntegrationSettings} className="space-y-6">
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white">VPS / VDS Yönetimi</CardTitle>
                  <CardDescription>
                    VPS, VDS, bulut ve fiziksel sunucu ürünleri için panel entegrasyonu
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Durum</Label>
                      <select
                        name="vps_vds_enabled"
                        defaultValue={vpsVds.enabled ? "true" : "false"}
                        className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      >
                        <option value="false">Pasif</option>
                        <option value="true">Aktif</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Panel</Label>
                      <select
                        name="vps_vds_provider"
                        defaultValue={vpsVds.provider}
                        className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      >
                        <option value="disabled">Pasif</option>
                        <option value="virtualizor">Virtualizor</option>
                        <option value="generic-http">Generic HTTP</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Panel URL</Label>
                    <Input
                      name="vps_vds_api_url"
                      defaultValue={vpsVds.apiUrl}
                      placeholder="https://panel.example.com:4085"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input
                        name="vps_vds_api_key"
                        type="password"
                        defaultValue={vpsVds.apiKey}
                        placeholder="Virtualizor API Key"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>API Password</Label>
                      <Input
                        name="vps_vds_api_password"
                        type="password"
                        defaultValue={vpsVds.hasApiPassword ? "********" : ""}
                        placeholder="Virtualizor API Password"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>API Username (opsiyonel)</Label>
                    <Input
                      name="vps_vds_api_username"
                      defaultValue={vpsVds.apiUsername}
                      placeholder="Generic HTTP için"
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    Ürün SKU değeri Virtualizor plan ID (plid) olarak kullanılır. Oluşturulan VPS ID
                    hizmet kaydının serverName alanına yazılır.
                  </p>
                </CardContent>
              </Card>

              <div className="flex flex-wrap justify-end gap-2">
                <Button formAction={testVpsVdsConnection} type="submit" variant="outline">
                  Bağlantıyı Test Et
                </Button>
                <Button type="submit">Kaydet</Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="payment" className="mt-6 space-y-6">
            <form action={savePaymentGatewayIntegrationSettings} className="space-y-6">
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white">Ödeme Ağ Geçidi</CardTitle>
                  <CardDescription>
                    Kredi kartı ödemeleri için aktif sağlayıcıyı seçin
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Aktif Sağlayıcı</Label>
                    <select
                      name="payment_gateway_provider"
                      defaultValue={paymentGateway.provider}
                      className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <option value="stripe">Stripe (varsayılan)</option>
                      <option value="iyzico">iyzico</option>
                      <option value="paytr">PayTR</option>
                    </select>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white">iyzico Ayarları</CardTitle>
                  <CardDescription>Checkout Form API yapılandırması</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-zinc-100 dark:bg-zinc-800/50 p-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">iyzico Aktif</p>
                      <p className="text-xs text-zinc-500">Sağlayıcı seçildiğinde kullanılabilir</p>
                    </div>
                    <NotificationsSwitch
                      enabled={paymentGateway.iyzico.enabled}
                      fieldName="iyzico_enabled"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <Input name="iyzico_api_key" defaultValue={paymentGateway.iyzico.apiKey} />
                    </div>
                    <div className="space-y-2">
                      <Label>Secret Key</Label>
                      <Input
                        name="iyzico_secret_key"
                        type="password"
                        defaultValue={paymentGateway.iyzico.hasSecretKey ? "********" : ""}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Test Modu</Label>
                    <select
                      name="iyzico_test_mode"
                      defaultValue={paymentGateway.iyzico.testMode ? "true" : "false"}
                      className="flex h-10 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <option value="true">Sandbox</option>
                      <option value="false">Canlı</option>
                    </select>
                  </div>
                  <p className="text-sm text-zinc-500">
                    Callback URL:{" "}
                    <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                      {env.appBaseUrl}/api/payments/iyzico/callback
                    </code>
                  </p>
                  <Button type="submit" formAction={testIyzicoConnection} variant="outline">
                    iyzico Bağlantısını Test Et
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white">PayTR Ayarları</CardTitle>
                  <CardDescription>Iframe API yapılandırması</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-zinc-100 dark:bg-zinc-800/50 p-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">PayTR Aktif</p>
                      <p className="text-xs text-zinc-500">Sağlayıcı seçildiğinde kullanılabilir</p>
                    </div>
                    <NotificationsSwitch
                      enabled={paymentGateway.paytr.enabled}
                      fieldName="paytr_enabled"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Mağaza No (merchant_id)</Label>
                      <Input
                        name="paytr_merchant_id"
                        defaultValue={paymentGateway.paytr.merchantId}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Mağaza Parolası (merchant_key)</Label>
                      <Input
                        name="paytr_merchant_key"
                        type="password"
                        defaultValue={paymentGateway.paytr.hasMerchantKey ? "********" : ""}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Mağaza Gizli Anahtarı (merchant_salt)</Label>
                      <Input
                        name="paytr_merchant_salt"
                        type="password"
                        defaultValue={paymentGateway.paytr.hasMerchantSalt ? "********" : ""}
                      />
                    </div>
                  </div>
                  <p className="text-sm text-zinc-500">
                    Bildirim URL:{" "}
                    <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                      {env.appBaseUrl}/api/payments/paytr/callback
                    </code>
                  </p>
                  <Button type="submit" formAction={testPaytrConnection} variant="outline">
                    PayTR Yapılandırmasını Test Et
                  </Button>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button type="submit">Ödeme Ayarlarını Kaydet</Button>
              </div>
            </form>

            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white">Stripe Ödeme</CardTitle>
                <CardDescription>
                  Stripe anahtarları ortam değişkenleri üzerinden yapılandırılır
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {[
                    {
                      name: "STRIPE_SECRET_KEY",
                      configured: env.stripeSecretConfigured,
                      description: "Sunucu tarafı API anahtarı",
                    },
                    {
                      name: "STRIPE_WEBHOOK_SECRET",
                      configured: env.stripeWebhookConfigured,
                      description: "Webhook imza doğrulama anahtarı",
                    },
                    {
                      name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
                      configured: env.stripePublishableConfigured,
                      description: "İstemci tarafı yayın anahtarı",
                    },
                  ].map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between rounded-lg bg-zinc-100 dark:bg-zinc-800/50 p-4"
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-white font-mono">
                          {item.name}
                        </p>
                        <p className="text-xs text-zinc-500">{item.description}</p>
                      </div>
                      <Badge variant={item.configured ? "default" : "secondary"}>
                        {item.configured ? "Tanımlı" : "Eksik"}
                      </Badge>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-zinc-500">
                  Webhook URL:{" "}
                  <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                    {env.appBaseUrl}/api/payments/stripe/webhook
                  </code>
                </p>
                <form action={testStripeConnection}>
                  <Button type="submit" variant="outline" disabled={!env.stripeSecretConfigured}>
                    Stripe Bağlantısını Test Et
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white">Banka Havalesi</CardTitle>
                <CardDescription>Manuel onay akışı — ek yapılandırma gerekmez</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge>Dahili · Aktif</Badge>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="efatura" className="mt-6 space-y-6">
            <form action={saveEfaturaIntegrationSettings} className="space-y-6">
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white">
                    E-Fatura / E-Arşiv Ayarları
                  </CardTitle>
                  <CardDescription>
                    Ödenen faturalar için UBL-TR taslak oluşturma ve gönderim
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Durum</Label>
                      <select
                        name="efatura_enabled"
                        defaultValue={efatura.enabled ? "true" : "false"}
                        className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      >
                        <option value="false">Pasif</option>
                        <option value="true">Aktif</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Sağlayıcı</Label>
                      <select
                        name="efatura_provider"
                        defaultValue={efatura.provider}
                        className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      >
                        <option value="disabled">Pasif</option>
                        <option value="parasut">Paraşüt</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Şirket VKN</Label>
                    <Input
                      name="efatura_company_vkn"
                      defaultValue={efatura.companyVkn}
                      placeholder="1234567890"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>API Kimlik Bilgileri (Paraşüt)</Label>
                    <Input
                      name="efatura_api_key"
                      type="password"
                      defaultValue={efatura.hasApiKey ? "********" : ""}
                      placeholder='JSON veya clientId:clientSecret:username:password:companyId'
                    />
                    <p className="text-xs text-zinc-500">
                      Örnek JSON: clientId, clientSecret, username, password, companyId alanları
                    </p>
                  </div>

                  <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800/50 p-4 text-sm text-zinc-600 dark:text-zinc-400">
                    Ödeme tamamlandığında e-fatura taslakları otomatik kuyruğa alınır.
                    Kayıtları{" "}
                    <Link href="/yonetim/efatura" className="text-primary hover:underline">
                      E-Fatura listesinden
                    </Link>{" "}
                    takip edebilirsiniz.
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-wrap justify-end gap-2">
                <Button formAction={testEfaturaConnection} type="submit" variant="outline">
                  Bağlantıyı Test Et
                </Button>
                <Button type="submit">Kaydet</Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="ssl" className="mt-6 space-y-6">
            <form action={saveSslIntegrationSettings} className="space-y-6">
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white">
                    SSL Sertifikası Ayarları
                  </CardTitle>
                  <CardDescription>
                    Sipariş sonrası SSL sağlama — Let&apos;s Encrypt veya Sectigo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Durum</Label>
                      <select
                        name="ssl_enabled"
                        defaultValue={ssl.enabled ? "true" : "false"}
                        className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      >
                        <option value="false">Pasif</option>
                        <option value="true">Aktif</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Sağlayıcı</Label>
                      <select
                        name="ssl_provider"
                        defaultValue={ssl.provider}
                        className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      >
                        <option value="disabled">Pasif</option>
                        <option value="letsencrypt">Let&apos;s Encrypt (ACME)</option>
                        <option value="sectigo">Sectigo (Yakında)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>ACME E-posta (Let&apos;s Encrypt)</Label>
                    <Input
                      name="ssl_acme_email"
                      type="email"
                      defaultValue={ssl.acmeEmail}
                      placeholder="ssl@example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Sectigo API Anahtarı</Label>
                    <Input
                      name="ssl_sectigo_api_key"
                      type="password"
                      defaultValue={ssl.hasSectigoApiKey ? "********" : ""}
                      placeholder="Sectigo API anahtarı"
                    />
                  </div>

                  <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800/50 p-4 text-sm text-zinc-600 dark:text-zinc-400">
                    SSL siparişleri tamamlandığında sertifika kaydı oluşturulur ve seçili
                    sağlayıcı üzerinden sağlama başlatılır. Mock sağlayıcı 90 günlük test
                    sertifikası üretir.
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-wrap justify-end gap-2">
                <Button formAction={testSslConnection} type="submit" variant="outline">
                  Bağlantıyı Test Et
                </Button>
                <Button type="submit">Kaydet</Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="email" className="mt-6 space-y-6">
            <form action={saveSmtpIntegrationSettings} className="space-y-6">
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white">SMTP Ayarları</CardTitle>
                  <CardDescription>
                    Bildirim e-postaları için SMTP sunucu yapılandırması
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>SMTP Sunucu</Label>
                      <Input name="smtp_server" defaultValue={smtp.server} />
                    </div>
                    <div className="space-y-2">
                      <Label>Port</Label>
                      <Input name="smtp_port" defaultValue={smtp.port} />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Kullanıcı Adı</Label>
                      <Input name="smtp_username" defaultValue={smtp.username} />
                    </div>
                    <div className="space-y-2">
                      <Label>Şifre</Label>
                      <Input
                        name="smtp_password"
                        type="password"
                        defaultValue={smtp.hasPassword ? "********" : ""}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-zinc-100 dark:bg-zinc-800/50 p-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        E-posta Bildirimleri
                      </p>
                      <p className="text-xs text-zinc-500">
                        Kapalıyken sistem e-posta göndermez
                      </p>
                    </div>
                    <NotificationsSwitch
                      enabled={smtp.notificationsEnabled}
                      fieldName="email_notifications"
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    Alternatif: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD ortam değişkenleri
                  </p>
                </CardContent>
              </Card>

              <div className="flex flex-wrap justify-end gap-2">
                <Button formAction={testSmtpConnection} type="submit" variant="outline">
                  Bağlantıyı Test Et
                </Button>
                <Button type="submit">Kaydet</Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="sms" className="mt-6 space-y-6">
            <form action={saveSmsIntegrationSettings} className="space-y-6">
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white">SMS Ayarları</CardTitle>
                  <CardDescription>
                    Netgsm veya İleti Merkezi ile müşteri SMS bildirimleri
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Durum</Label>
                      <select
                        name="sms_enabled"
                        defaultValue={sms.enabled ? "true" : "false"}
                        className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      >
                        <option value="false">Pasif</option>
                        <option value="true">Aktif</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Sağlayıcı</Label>
                      <select
                        name="sms_provider"
                        defaultValue={sms.provider}
                        className="h-10 w-full rounded-md border border-zinc-300 bg-zinc-100 px-3 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                      >
                        <option value="disabled">Pasif</option>
                        <option value="netgsm">Netgsm</option>
                        <option value="iletimerkezi">İleti Merkezi</option>
                      </select>
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">Netgsm</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Kullanıcı Kodu</Label>
                        <Input
                          name="sms_netgsm_usercode"
                          defaultValue={sms.netgsm.usercode}
                          placeholder="Netgsm usercode"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Şifre</Label>
                        <Input
                          name="sms_netgsm_password"
                          type="password"
                          defaultValue={sms.netgsm.hasPassword ? "********" : ""}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Başlık (Header)</Label>
                      <Input
                        name="sms_netgsm_header"
                        defaultValue={sms.netgsm.header}
                        placeholder="KLEACORE"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 space-y-4">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                      İleti Merkezi
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>API Key</Label>
                        <Input
                          name="sms_iletimerkezi_api_key"
                          defaultValue={sms.iletimerkezi.apiKey}
                          placeholder="API anahtarı"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>API Secret (Hash)</Label>
                        <Input
                          name="sms_iletimerkezi_secret"
                          type="password"
                          defaultValue={sms.iletimerkezi.hasSecret ? "********" : ""}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Gönderici (Sender)</Label>
                      <Input
                        name="sms_iletimerkezi_sender"
                        defaultValue={sms.iletimerkezi.sender}
                        placeholder="KLEACORE"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-zinc-100 dark:bg-zinc-800/50 p-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        SMS Bildirimleri
                      </p>
                      <p className="text-xs text-zinc-500">
                        Kapalıyken ödeme ve gecikmiş fatura SMS&apos;leri gönderilmez
                      </p>
                    </div>
                    <NotificationsSwitch
                      enabled={sms.notificationsEnabled}
                      fieldName="sms_notifications"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-wrap justify-end gap-2">
                <Button formAction={testSmsConnection} type="submit" variant="outline">
                  Bağlantıyı Test Et
                </Button>
                <Button type="submit">Kaydet</Button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="webhooks" className="mt-6 space-y-6">
            <form action={saveWebhookIntegrationSettings}>
              <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
                <CardHeader>
                  <CardTitle className="text-zinc-900 dark:text-white">Outbound Webhook</CardTitle>
                  <CardDescription>
                    Sipariş ve ödeme olaylarını harici sistemlere bildirin
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Sipariş Webhook</Label>
                    <Input
                      name="webhook_orders"
                      defaultValue={webhooks.orders}
                      placeholder="https://example.com/webhook/orders"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ödeme Webhook</Label>
                    <Input
                      name="webhook_payments"
                      defaultValue={webhooks.payments}
                      placeholder="https://example.com/webhook/payments"
                    />
                  </div>
                  <Button type="submit">Kaydet</Button>
                </CardContent>
              </Card>
            </form>
          </TabsContent>

          <TabsContent value="api" className="mt-6 space-y-6">
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-zinc-900 dark:text-white">Public API v1</CardTitle>
                  <CardDescription>
                    REST API ile fatura ve destek taleplerine erişim
                  </CardDescription>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/api-docs" target="_blank">
                    Dokümantasyon
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Base URL:{" "}
                  <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                    {env.appBaseUrl}/api/v1
                  </code>
                </p>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-zinc-900 dark:text-white">
                    Aktif API Anahtarları ({apiKeys.length})
                  </p>
                  {apiKeys.length === 0 ? (
                    <p className="text-sm text-zinc-500">Henüz aktif API anahtarı yok.</p>
                  ) : (
                    <div className="space-y-2">
                      {apiKeys.slice(0, 5).map((apiKey) => (
                        <div
                          key={apiKey.id}
                          className="flex items-center justify-between rounded-lg bg-zinc-100 dark:bg-zinc-800/50 p-3"
                        >
                          <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-white">
                              {apiKey.name}
                            </p>
                            <p className="text-xs font-mono text-zinc-500">
                              {maskApiKey(apiKey.keyPrefix)}
                            </p>
                          </div>
                          <p className="text-xs text-zinc-500">
                            {new Date(apiKey.createdAt).toLocaleDateString("tr-TR")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="outline" asChild>
                  <Link href="/yonetim/ayarlar?tab=api">
                    API Anahtarlarını Yönet
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white">Satış Ortaklığı</CardTitle>
                <CardDescription>Dahili modül — komisyon oranı %10</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <p>Referans linki formatı: {env.appBaseUrl}/ref/[kod]</p>
                <p>Cookie süresi: 30 gün</p>
                <Badge variant="outline">Dahili · Aktif</Badge>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cron" className="mt-6 space-y-6">
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white">
                  Zamanlanmış Görevler
                </CardTitle>
                <CardDescription>
                  Vercel Cron veya harici scheduler ile tetiklenir
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-zinc-100 dark:bg-zinc-800/50 p-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-white font-mono">
                      CRON_SECRET
                    </p>
                    <p className="text-xs text-zinc-500">
                      Authorization: Bearer [CRON_SECRET] header gerekir
                    </p>
                  </div>
                  <Badge variant={env.cronSecretConfigured ? "default" : "secondary"}>
                    {env.cronSecretConfigured ? "Tanımlı" : "Eksik"}
                  </Badge>
                </div>

                <div className="space-y-3">
                  {cronJobs.map((job) => (
                    <div
                      key={job.path}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-900 dark:text-white">
                          {job.name}
                        </p>
                        <Badge variant="outline" className="font-mono text-xs">
                          {job.schedule}
                        </Badge>
                      </div>
                      <p className="text-xs font-mono text-zinc-500 mt-2 break-all">{job.url}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </BlurFade>
    </div>
  );
}
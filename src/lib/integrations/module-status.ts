import { checkIntegrationHealth } from "./health";
import { getSettingMap, isEnabled } from "./settings";
import { db } from "@/lib/db";

export type ModuleCategory =
  | "domain"
  | "hosting"
  | "payment"
  | "communication"
  | "automation"
  | "api"
  | "marketing";

export type ModuleStatus = "active" | "inactive" | "error" | "warning" | "builtin";

export interface IntegrationModule {
  id: string;
  name: string;
  description: string;
  category: ModuleCategory;
  status: ModuleStatus;
  configured: boolean;
  provider?: string;
  message?: string;
  healthStatus?: string;
  configSource: "settings" | "env" | "builtin";
  tab: string;
  docsUrl?: string;
}

export interface IntegrationOverview {
  modules: IntegrationModule[];
  checkedAt: string;
  summary: {
    total: number;
    active: number;
    inactive: number;
    error: number;
    warning: number;
  };
}

const CRON_JOBS = [
  { name: "Günlük Faturalama", path: "/api/cron/daily-billing", schedule: "0 2 * * *" },
  { name: "Zamanlanmış Yedeklemeler", path: "/api/cron/run-backups", schedule: "0 3 * * *" },
  { name: "SSL Süre Kontrolü", path: "/api/cron/ssl-expiry", schedule: "0 4 * * *" },
  { name: "Gecikmiş Faturalar", path: "/api/cron/overdue-invoices", schedule: "0 5 * * *" },
  { name: "Hizmet Askıya Alma", path: "/api/cron/suspend-services", schedule: "0 6 * * *" },
] as const;

function env(name: string) {
  return process.env[name]?.trim() || "";
}

function summarize(modules: IntegrationModule[]) {
  return {
    total: modules.length,
    active: modules.filter((m) => m.status === "active" || m.status === "builtin").length,
    inactive: modules.filter((m) => m.status === "inactive").length,
    error: modules.filter((m) => m.status === "error").length,
    warning: modules.filter((m) => m.status === "warning").length,
  };
}

function mapHealthToStatus(
  configured: boolean,
  health: { ok: boolean; skipped?: boolean; data?: { status?: string } }
): ModuleStatus {
  if (!configured || health.skipped) return "inactive";
  if (health.ok && health.data?.status === "ok") return "active";
  if (health.data?.status === "disabled") return "inactive";
  return "error";
}

export async function getIntegrationModulesOverview(): Promise<IntegrationOverview> {
  const [health, settings, apiKeyCount] = await Promise.all([
    checkIntegrationHealth(),
    getSettingMap([
      { key: "registrar_enabled" },
      { key: "registrar_provider", fallback: "disabled" },
      { key: "cpanel_enabled" },
      { key: "backup_enabled", fallback: "true" },
      { key: "cpanel_host" },
      { key: "cpanel_username" },
      { key: "cpanel_api_token" },
      { key: "vps_vds_enabled" },
      { key: "vps_vds_provider", fallback: "disabled" },
      { key: "vps_vds_api_url" },
      { key: "vps_vds_api_key" },
      { key: "vps_vds_api_password" },
      { key: "payment_gateway_provider", fallback: "stripe" },
      { key: "iyzico_enabled" },
      { key: "iyzico_api_key" },
      { key: "iyzico_secret_key" },
      { key: "iyzico_test_mode" },
      { key: "paytr_enabled" },
      { key: "paytr_merchant_id" },
      { key: "paytr_merchant_key" },
      { key: "paytr_merchant_salt" },
      { key: "kuveytturk_enabled" },
      { key: "kuveytturk_merchant_id" },
      { key: "kuveytturk_customer_id" },
      { key: "kuveytturk_username" },
      { key: "kuveytturk_password" },
      { key: "smtp_server" },
      { key: "smtp_username" },
      { key: "smtp_password" },
      { key: "sms_enabled" },
      { key: "sms_provider", fallback: "disabled" },
      { key: "sms_netgsm_usercode" },
      { key: "sms_netgsm_password" },
      { key: "sms_netgsm_header" },
      { key: "sms_iletimerkezi_api_key" },
      { key: "sms_iletimerkezi_secret" },
      { key: "sms_iletimerkezi_sender" },
      { key: "webhook_orders" },
      { key: "webhook_payments" },
      { key: "efatura_enabled" },
      { key: "efatura_provider", fallback: "disabled" },
      { key: "efatura_api_key" },
      { key: "efatura_company_vkn" },
      { key: "ssl_enabled" },
      { key: "ssl_provider", fallback: "disabled" },
      { key: "ssl_acme_email" },
      { key: "ssl_sectigo_api_key" },
    ]),
    db.apiKey.count({ where: { isActive: true } }),
  ]);

  const registrarConfigured =
    isEnabled(settings.registrar_enabled) && settings.registrar_provider !== "disabled";
  const cpanelConfigured =
    isEnabled(settings.cpanel_enabled) &&
    Boolean(settings.cpanel_host && settings.cpanel_username && settings.cpanel_api_token);
  const backupEnabled = isEnabled(settings.backup_enabled);
  const vpsVdsConfigured =
    isEnabled(settings.vps_vds_enabled) &&
    settings.vps_vds_provider !== "disabled" &&
    Boolean(
      settings.vps_vds_api_url &&
        (settings.vps_vds_provider === "virtualizor"
          ? settings.vps_vds_api_key && settings.vps_vds_api_password
          : true)
    );

  const smtpFromSettings = Boolean(
    settings.smtp_server && settings.smtp_username && settings.smtp_password
  );
  const smtpFromEnv = Boolean(env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASSWORD"));
  const smtpConfigured = smtpFromSettings || smtpFromEnv;

  const smsProvider = settings.sms_provider || "disabled";
  const smsConfigured =
    isEnabled(settings.sms_enabled) &&
    smsProvider !== "disabled" &&
    (smsProvider === "netgsm"
      ? Boolean(
          settings.sms_netgsm_usercode &&
            settings.sms_netgsm_password &&
            settings.sms_netgsm_header
        )
      : smsProvider === "iletimerkezi"
        ? Boolean(
            settings.sms_iletimerkezi_api_key &&
              settings.sms_iletimerkezi_secret &&
              settings.sms_iletimerkezi_sender
          )
        : false);

  const stripeConfigured = Boolean(env("STRIPE_SECRET_KEY"));
  const stripeWebhookConfigured = Boolean(env("STRIPE_WEBHOOK_SECRET"));
  const paymentGatewayProvider = settings.payment_gateway_provider || "stripe";
  const iyzicoConfigured =
    isEnabled(settings.iyzico_enabled) &&
    Boolean(settings.iyzico_api_key && settings.iyzico_secret_key);
  const paytrConfigured =
    isEnabled(settings.paytr_enabled) &&
    Boolean(
      settings.paytr_merchant_id && settings.paytr_merchant_key && settings.paytr_merchant_salt
    );
  const kuveytturkConfigured =
    isEnabled(settings.kuveytturk_enabled) &&
    Boolean(
      settings.kuveytturk_merchant_id &&
        settings.kuveytturk_customer_id &&
        settings.kuveytturk_username &&
        settings.kuveytturk_password
    );
  const cronConfigured = Boolean(env("CRON_SECRET"));

  const webhookConfigured = Boolean(settings.webhook_orders || settings.webhook_payments);
  const publicApiConfigured = apiKeyCount > 0;

  const efaturaProvider = settings.efatura_provider || "disabled";
  const efaturaConfigured =
    isEnabled(settings.efatura_enabled) &&
    efaturaProvider !== "disabled" &&
    Boolean(settings.efatura_company_vkn) &&
    Boolean(settings.efatura_api_key);

  const sslProvider = settings.ssl_provider || "disabled";
  const sslConfigured =
    isEnabled(settings.ssl_enabled) &&
    sslProvider !== "disabled" &&
    ((sslProvider === "letsencrypt" && Boolean(settings.ssl_acme_email)) ||
      (sslProvider === "sectigo" && Boolean(settings.ssl_sectigo_api_key)));

  const modules: IntegrationModule[] = [
    {
      id: "registrar",
      name: "Domain Registrar",
      description: "Domain kayıt, yenileme, DNS ve transfer işlemleri",
      category: "domain",
      status: mapHealthToStatus(registrarConfigured, health.registrar),
      configured: registrarConfigured,
      provider: settings.registrar_provider,
      healthStatus: health.registrar.data?.status,
      message: health.registrar.error,
      configSource: "settings",
      tab: "registrar",
    },
    {
      id: "cpanel-whm",
      name: "cPanel / WHM",
      description:
        "Web hosting hesap oluşturma, askıya alma, yedekleme, sonlandırma ve e-posta hesabı sağlama",
      category: "hosting",
      status: mapHealthToStatus(cpanelConfigured, health.cpanel),
      configured: cpanelConfigured,
      provider: "cpanel-whm",
      healthStatus: health.cpanel.data?.status,
      message: cpanelConfigured
        ? backupEnabled
          ? health.cpanel.error
          : "Yedekleme modülü pasif"
        : health.cpanel.error,
      configSource: "settings",
      tab: "cpanel",
    },
    {
      id: "vps-vds",
      name: "VPS / VDS Yönetimi",
      description: "Sanal sunucu kurulumu, güç yönetimi ve askıya alma",
      category: "hosting",
      status: mapHealthToStatus(vpsVdsConfigured, health.vpsVds),
      configured: vpsVdsConfigured,
      provider: settings.vps_vds_provider,
      healthStatus: health.vpsVds.data?.status,
      message: health.vpsVds.error,
      configSource: "settings",
      tab: "vps-vds",
    },
    {
      id: "stripe",
      name: "Stripe Ödeme",
      description: "Kredi kartı ile online ödeme",
      category: "payment",
      status:
        paymentGatewayProvider === "stripe"
          ? stripeConfigured
            ? stripeWebhookConfigured
              ? "active"
              : "warning"
            : "inactive"
          : stripeConfigured
            ? "inactive"
            : "inactive",
      configured: stripeConfigured,
      provider: "stripe",
      message: stripeConfigured
        ? paymentGatewayProvider !== "stripe"
          ? "Aktif ödeme sağlayıcısı Stripe değil"
          : stripeWebhookConfigured
            ? undefined
            : "STRIPE_WEBHOOK_SECRET tanımlı değil"
        : "STRIPE_SECRET_KEY tanımlı değil",
      configSource: "env",
      tab: "payment",
    },
    {
      id: "iyzico",
      name: "iyzico Ödeme",
      description: "Türkiye odaklı kredi kartı ödeme altyapısı",
      category: "payment",
      status:
        paymentGatewayProvider === "iyzico"
          ? iyzicoConfigured
            ? "active"
            : "error"
          : iyzicoConfigured
            ? "inactive"
            : "inactive",
      configured: iyzicoConfigured,
      provider: "iyzico",
      message:
        paymentGatewayProvider === "iyzico" && !iyzicoConfigured
          ? "iyzico API bilgileri eksik"
          : undefined,
      configSource: "settings",
      tab: "payment",
    },
    {
      id: "kuveytturk",
      name: "Kuveyt Türk Sanal POS",
      description: "3D Secure kredi kartı ödemesi (birincil sanal POS)",
      category: "payment",
      status:
        paymentGatewayProvider === "kuveytturk"
          ? kuveytturkConfigured
            ? "active"
            : "error"
          : "inactive",
      configured: kuveytturkConfigured,
      provider: "kuveytturk",
      message:
        paymentGatewayProvider === "kuveytturk" && !kuveytturkConfigured
          ? "Kuveyt Türk üye işyeri bilgileri eksik"
          : undefined,
      configSource: "settings",
      tab: "payment",
    },
    {
      id: "paytr",
      name: "PayTR Ödeme",
      description: "PayTR iframe ile kredi kartı ödemesi",
      category: "payment",
      status:
        paymentGatewayProvider === "paytr"
          ? paytrConfigured
            ? "active"
            : "error"
          : paytrConfigured
            ? "inactive"
            : "inactive",
      configured: paytrConfigured,
      provider: "paytr",
      message:
        paymentGatewayProvider === "paytr" && !paytrConfigured
          ? "PayTR mağaza bilgileri eksik"
          : undefined,
      configSource: "settings",
      tab: "payment",
    },
    {
      id: "smtp",
      name: "E-posta (SMTP)",
      description: "Bildirim ve işlem e-postaları",
      category: "communication",
      status: smtpConfigured ? "active" : "inactive",
      configured: smtpConfigured,
      provider: smtpFromEnv && !smtpFromSettings ? "env" : "smtp",
      message: smtpConfigured ? undefined : "SMTP sunucu bilgileri eksik",
      configSource: smtpFromEnv && !smtpFromSettings ? "env" : "settings",
      tab: "email",
    },
    {
      id: "sms",
      name: "SMS Bildirimleri",
      description: "Ödeme ve gecikmiş fatura SMS bildirimleri",
      category: "communication",
      status: smsConfigured ? "active" : "inactive",
      configured: smsConfigured,
      provider: smsProvider,
      message: smsConfigured ? undefined : "SMS sağlayıcı bilgileri eksik",
      configSource: "settings",
      tab: "sms",
    },
    {
      id: "webhooks",
      name: "Outbound Webhook",
      description: "Sipariş ve ödeme olaylarını harici sistemlere iletir",
      category: "api",
      status: webhookConfigured ? "active" : "inactive",
      configured: webhookConfigured,
      provider: "http",
      configSource: "settings",
      tab: "webhooks",
    },
    {
      id: "public-api",
      name: "Public API v1",
      description: "REST API ile fatura ve destek erişimi",
      category: "api",
      status: publicApiConfigured ? "active" : "warning",
      configured: publicApiConfigured,
      provider: "rest-v1",
      message: publicApiConfigured ? undefined : "Aktif API anahtarı yok",
      configSource: "settings",
      tab: "api",
      docsUrl: "/api-docs",
    },
    {
      id: "cron",
      name: "Zamanlanmış Görevler",
      description: "Faturalama, gecikme ve askıya alma cron işleri",
      category: "automation",
      status: cronConfigured ? "active" : "warning",
      configured: cronConfigured,
      provider: "vercel-cron",
      message: cronConfigured ? undefined : "CRON_SECRET tanımlı değil",
      configSource: "env",
      tab: "cron",
    },
    {
      id: "affiliate",
      name: "Satış Ortaklığı",
      description: "Referans linkleri ve komisyon takibi (%10)",
      category: "marketing",
      status: "builtin",
      configured: true,
      provider: "builtin",
      configSource: "builtin",
      tab: "overview",
    },
    {
      id: "efatura",
      name: "E-Fatura / E-Arşiv",
      description: "Ödenen faturalar için UBL-TR taslak oluşturma ve gönderim",
      category: "payment",
      status: efaturaConfigured ? "active" : "inactive",
      configured: efaturaConfigured,
      provider: efaturaProvider,
      message: efaturaConfigured
        ? undefined
        : isEnabled(settings.efatura_enabled)
          ? "E-fatura sağlayıcı veya şirket VKN bilgisi eksik"
          : "E-fatura modülü pasif",
      configSource: "settings",
      tab: "efatura",
    },
    {
      id: "ssl",
      name: "SSL Sertifikası",
      description: "Let's Encrypt veya Sectigo ile SSL sağlama",
      category: "hosting",
      status: sslConfigured ? "active" : "inactive",
      configured: sslConfigured,
      provider: sslProvider,
      message: sslConfigured
        ? undefined
        : isEnabled(settings.ssl_enabled)
          ? "SSL sağlayıcı bilgileri eksik"
          : "SSL modülü pasif",
      configSource: "settings",
      tab: "ssl",
    },
  ];

  return {
    modules,
    checkedAt: health.checkedAt,
    summary: summarize(modules),
  };
}

export function getCronJobDefinitions() {
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");

  return CRON_JOBS.map((job) => ({
    ...job,
    url: `${baseUrl}${job.path}`,
  }));
}
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  getCronJobDefinitions,
  getIntegrationModulesOverview,
} from "@/lib/integrations/module-status";
import { getSettings, getApiKeys } from "@/lib/dal/settings";
import { getEInvoiceConfig, getEInvoiceConfigProblem } from "@/lib/integrations/efatura";
import { getBankAccounts } from "@/lib/dal/bank-transfer";
import { getPaymentGatewayConfig } from "@/lib/integrations/payment-gateways";
import { isCardGatewayConfigured } from "@/lib/integrations/payment-gateways/config";
import { EntegrasyonlarContent } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Entegrasyonlar" };

const allowedTabs = [
  "overview",
  "registrar",
  "cpanel",
  "vps-vds",
  "payment",
  "email",
  "sms",
  "webhooks",
  "api",
  "cron",
  "efatura",
  "ssl",
] as const;

type IntegrationsTab = (typeof allowedTabs)[number];

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = searchParams[key];
  return typeof value === "string" ? value : undefined;
}

function isIntegrationsTab(value: string | undefined): value is IntegrationsTab {
  return value ? allowedTabs.includes(value as IntegrationsTab) : false;
}

function getSettingValue(
  settings: { key: string; value: string }[],
  key: string,
  defaultValue = ""
) {
  return settings.find((s) => s.key === key)?.value ?? defaultValue;
}

interface EntegrasyonlarPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function EntegrasyonlarPage({ searchParams }: EntegrasyonlarPageProps) {
  await requirePermission("settings.manage");
  const sp = await searchParams;
  const activeTab = readSearchParam(sp, "tab");

  if (activeTab === "integrations" || activeTab === "provisioning") {
    redirect("/yonetim/entegrasyonlar");
  }

  const defaultTab: IntegrationsTab = isIntegrationsTab(activeTab) ? activeTab : "overview";

  const [overview, settings, apiKeys, cronJobs] = await Promise.all([
    getIntegrationModulesOverview(),
    getSettings(),
    getApiKeys(),
    Promise.resolve(getCronJobDefinitions()),
  ]);

  const registrarEnabled = getSettingValue(settings, "registrar_enabled", "false") === "true";
  const registrarProvider = getSettingValue(settings, "registrar_provider", "disabled");
  const registrarApiUrl = getSettingValue(settings, "registrar_api_url", "");
  const registrarApiKey = getSettingValue(settings, "registrar_api_key", "");
  const registrarUsername = getSettingValue(settings, "registrar_username", "");
  const registrarPassword = getSettingValue(settings, "registrar_password", "");
  const registrarClientId = getSettingValue(settings, "registrar_client_id", "");
  const registrarClientSecret = getSettingValue(settings, "registrar_client_secret", "");
  const registrarTestMode =
    getSettingValue(settings, "registrar_test_mode", "false") === "true";

  const cpanelEnabled = getSettingValue(settings, "cpanel_enabled", "false") === "true";
  const cpanelHost = getSettingValue(settings, "cpanel_host", "");
  const cpanelPort = getSettingValue(settings, "cpanel_port", "2087");
  const cpanelUsername = getSettingValue(settings, "cpanel_username", "");
  const cpanelApiToken = getSettingValue(settings, "cpanel_api_token", "");
  const cpanelDefaultPlan = getSettingValue(settings, "cpanel_default_plan", "default");
  const cpanelUseSsl = getSettingValue(settings, "cpanel_use_ssl", "true") === "true";
  const backupEnabled = getSettingValue(settings, "backup_enabled", "true") === "true";

  const vpsVdsEnabled = getSettingValue(settings, "vps_vds_enabled", "false") === "true";
  const vpsVdsProvider = getSettingValue(settings, "vps_vds_provider", "disabled");
  const vpsVdsApiUrl = getSettingValue(settings, "vps_vds_api_url", "");
  const vpsVdsApiKey = getSettingValue(settings, "vps_vds_api_key", "");
  const vpsVdsApiUsername = getSettingValue(settings, "vps_vds_api_username", "");
  const vpsVdsApiPassword = getSettingValue(settings, "vps_vds_api_password", "");

  const smtpServer = getSettingValue(settings, "smtp_server", "");
  const smtpPort = getSettingValue(settings, "smtp_port", "587");
  const smtpUsername = getSettingValue(settings, "smtp_username", "");
  const smtpPassword = getSettingValue(settings, "smtp_password", "");
  const emailNotifications =
    getSettingValue(settings, "email_notifications", "true") === "true";

  const smsEnabled = getSettingValue(settings, "sms_enabled", "false") === "true";
  const smsProvider = getSettingValue(settings, "sms_provider", "disabled");
  const smsNetgsmUsercode = getSettingValue(settings, "sms_netgsm_usercode", "");
  const smsNetgsmPassword = getSettingValue(settings, "sms_netgsm_password", "");
  const smsNetgsmHeader = getSettingValue(settings, "sms_netgsm_header", "");
  const smsIletiMerkeziApiKey = getSettingValue(settings, "sms_iletimerkezi_api_key", "");
  const smsIletiMerkeziSecret = getSettingValue(settings, "sms_iletimerkezi_secret", "");
  const smsIletiMerkeziSender = getSettingValue(settings, "sms_iletimerkezi_sender", "");
  const smsNotifications =
    getSettingValue(settings, "sms_notifications", "false") === "true";

  const webhookOrders = getSettingValue(settings, "webhook_orders", "");
  const webhookPayments = getSettingValue(settings, "webhook_payments", "");

  const [gatewayConfig, bankAccounts] = await Promise.all([getPaymentGatewayConfig(), getBankAccounts()]);
  const iyzicoApiKey = getSettingValue(settings, "iyzico_api_key", "");
  const iyzicoSecretKey = getSettingValue(settings, "iyzico_secret_key", "");
  const iyzicoTestMode = getSettingValue(settings, "iyzico_test_mode", "true") === "true";
  const paytrMerchantId = getSettingValue(settings, "paytr_merchant_id", "");
  const paytrMerchantKey = getSettingValue(settings, "paytr_merchant_key", "");
  const paytrMerchantSalt = getSettingValue(settings, "paytr_merchant_salt", "");
  const kuveytturkMerchantId = getSettingValue(settings, "kuveytturk_merchant_id", "");
  const kuveytturkCustomerId = getSettingValue(settings, "kuveytturk_customer_id", "");
  const kuveytturkUsername = getSettingValue(settings, "kuveytturk_username", "");
  const kuveytturkPassword = getSettingValue(settings, "kuveytturk_password", "");
  const kuveytturkTestMode = getSettingValue(settings, "kuveytturk_test_mode", "true") === "true";

  const efatura = await getEInvoiceConfig();

  const sslEnabled = getSettingValue(settings, "ssl_enabled", "false") === "true";
  const sslProvider = getSettingValue(settings, "ssl_provider", "disabled");
  const sslAcmeEmail = getSettingValue(settings, "ssl_acme_email", "");
  const sslSectigoApiKey = getSettingValue(settings, "ssl_sectigo_api_key", "");

  const stripeSecretConfigured = Boolean(process.env.STRIPE_SECRET_KEY?.trim());
  const stripeWebhookConfigured = Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
  const stripePublishableConfigured = Boolean(
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()
  );
  const cronSecretConfigured = Boolean(process.env.CRON_SECRET?.trim());
  const appBaseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");

  return (
    <EntegrasyonlarContent
      defaultTab={defaultTab}
      toastStatus={readSearchParam(sp, "status")}
      toastMessage={readSearchParam(sp, "message")}
      overview={overview}
      cronJobs={cronJobs}
      apiKeys={apiKeys}
      registrar={{
        enabled: registrarEnabled,
        provider: registrarProvider,
        apiUrl: registrarApiUrl,
        apiKey: registrarApiKey,
        username: registrarUsername,
        hasPassword: Boolean(registrarPassword),
        clientId: registrarClientId,
        hasClientSecret: Boolean(registrarClientSecret),
        testMode: registrarTestMode,
      }}
      cpanel={{
        enabled: cpanelEnabled,
        host: cpanelHost,
        port: cpanelPort,
        username: cpanelUsername,
        hasApiToken: Boolean(cpanelApiToken),
        defaultPlan: cpanelDefaultPlan,
        useSsl: cpanelUseSsl,
        backupEnabled,
      }}
      vpsVds={{
        enabled: vpsVdsEnabled,
        provider: vpsVdsProvider,
        apiUrl: vpsVdsApiUrl,
        apiKey: vpsVdsApiKey,
        apiUsername: vpsVdsApiUsername,
        hasApiPassword: Boolean(vpsVdsApiPassword),
      }}
      smtp={{
        server: smtpServer,
        port: smtpPort,
        username: smtpUsername,
        hasPassword: Boolean(smtpPassword),
        notificationsEnabled: emailNotifications,
      }}
      sms={{
        enabled: smsEnabled,
        provider: smsProvider,
        netgsm: {
          usercode: smsNetgsmUsercode,
          hasPassword: Boolean(smsNetgsmPassword),
          header: smsNetgsmHeader,
        },
        iletimerkezi: {
          apiKey: smsIletiMerkeziApiKey,
          hasSecret: Boolean(smsIletiMerkeziSecret),
          sender: smsIletiMerkeziSender,
        },
        notificationsEnabled: smsNotifications,
      }}
      webhooks={{
        orders: webhookOrders,
        payments: webhookPayments,
      }}
      paymentGateway={{
        methods: {
          order: gatewayConfig.methods.order,
          enabled: gatewayConfig.methods.enabled,
          defaultMethod: gatewayConfig.methods.defaultMethod,
          derived: gatewayConfig.methodsDerived,
          configured: {
            kuveytturk: isCardGatewayConfigured(gatewayConfig, "kuveytturk"),
            paytr: isCardGatewayConfigured(gatewayConfig, "paytr"),
            iyzico: isCardGatewayConfigured(gatewayConfig, "iyzico"),
            stripe: isCardGatewayConfigured(gatewayConfig, "stripe"),
            bank_transfer: bankAccounts.some((account) => account.isActive),
            balance: true,
          },
        },
        bankAccounts,
        iyzico: {
          enabled: gatewayConfig.iyzico.enabled,
          apiKey: iyzicoApiKey,
          hasSecretKey: Boolean(iyzicoSecretKey),
          testMode: iyzicoTestMode,
        },
        paytr: {
          enabled: gatewayConfig.paytr.enabled,
          merchantId: paytrMerchantId,
          hasMerchantKey: Boolean(paytrMerchantKey),
          hasMerchantSalt: Boolean(paytrMerchantSalt),
        },
        kuveytturk: {
          enabled: gatewayConfig.kuveytturk.enabled,
          merchantId: kuveytturkMerchantId,
          customerId: kuveytturkCustomerId,
          username: kuveytturkUsername,
          hasPassword: Boolean(kuveytturkPassword),
          testMode: kuveytturkTestMode,
        },
      }}
      efatura={{
        enabled: efatura.enabled,
        provider: efatura.provider,
        hasApiKey: Boolean(efatura.apiKey),
        companyVkn: efatura.companyVkn,
        defaultProfile: efatura.defaultProfile,
        problem: getEInvoiceConfigProblem(efatura),
        uyumsoft: {
          username: efatura.uyumsoft.username,
          hasPassword: Boolean(efatura.uyumsoft.password),
          testMode: efatura.uyumsoft.testMode,
          earsivPrefix: efatura.uyumsoft.earsivPrefix,
          efaturaPrefix: efatura.uyumsoft.efaturaPrefix,
        },
        supplier: {
          name: efatura.supplier.name,
          taxOffice: efatura.supplier.taxOffice,
          street: efatura.supplier.street,
          district: efatura.supplier.district,
          city: efatura.supplier.city,
          postalZone: efatura.supplier.postalZone,
          phone: efatura.supplier.phone,
          email: efatura.supplier.email,
          website: efatura.supplier.website,
          mersisNo: efatura.supplier.mersisNo ?? "",
        },
      }}
      ssl={{
        enabled: sslEnabled,
        provider: sslProvider,
        acmeEmail: sslAcmeEmail,
        hasSectigoApiKey: Boolean(sslSectigoApiKey),
      }}
      env={{
        stripeSecretConfigured,
        stripeWebhookConfigured,
        stripePublishableConfigured,
        cronSecretConfigured,
        appBaseUrl,
      }}
    />
  );
}
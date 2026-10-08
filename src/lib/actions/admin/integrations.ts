"use server";

import { redirect } from "next/navigation";
import nodemailer from "nodemailer";
import { updateSettings } from "@/lib/actions/admin/settings";
import { syncRegistrarTldsFromProvider } from "@/lib/actions/admin/registrar";
import { getSettings } from "@/lib/dal/settings";
import { getCpanelWhmProvider, getVpsVdsProvider } from "@/lib/integrations/provisioning";
import { getRegistrarProvider } from "@/lib/integrations/registrar";
import { createEInvoiceProvider, getEInvoiceConfig } from "@/lib/integrations/efatura/config";
import { getSslProvider } from "@/lib/integrations/ssl";
import { getSmsProvider } from "@/lib/integrations/sms";
import { getPaymentGatewayConfig } from "@/lib/integrations/payment-gateways";
import { createIyzicoPaymentGatewayProvider } from "@/lib/integrations/payment-gateways/providers/iyzico";
import { getStripe } from "@/lib/stripe";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

const INTEGRATIONS_PATH = "/yonetim/entegrasyonlar";

function getFormValue(formData: FormData, key: string, fallback = "") {
  const value = formData.get(key);
  return typeof value === "string" ? value : fallback;
}

function getSettingValue(
  settings: { key: string; value: string }[],
  key: string,
  defaultValue = ""
) {
  return settings.find((s) => s.key === key)?.value ?? defaultValue;
}

function getSecretFormValue(formData: FormData, name: string, currentValue: string) {
  const value = getFormValue(formData, name);
  if (!value || value === "********") {
    return currentValue;
  }
  return value;
}

function redirectWithFeedback(
  tab: string,
  success: boolean,
  message: string
) {
  const params = new URLSearchParams({
    tab,
    status: success ? "success" : "error",
    message,
  });
  redirect(`${INTEGRATIONS_PATH}?${params.toString()}`);
}

export async function saveRegistrarIntegrationSettings(formData: FormData) {
  await requireAdmin();

  const settings = await getSettings();
  const currentPassword = getSettingValue(settings, "registrar_password", "");
  const currentClientSecret = getSettingValue(settings, "registrar_client_secret", "");

  const result = await updateSettings([
    {
      key: "registrar_enabled",
      value: getFormValue(formData, "registrar_enabled", "false"),
    },
    {
      key: "registrar_provider",
      value: getFormValue(formData, "registrar_provider", "disabled"),
    },
    { key: "registrar_api_url", value: getFormValue(formData, "registrar_api_url") },
    { key: "registrar_api_key", value: getFormValue(formData, "registrar_api_key") },
    { key: "registrar_username", value: getFormValue(formData, "registrar_username") },
    {
      key: "registrar_password",
      value: getSecretFormValue(formData, "registrar_password", currentPassword),
    },
    { key: "registrar_client_id", value: getFormValue(formData, "registrar_client_id") },
    {
      key: "registrar_client_secret",
      value: getSecretFormValue(formData, "registrar_client_secret", currentClientSecret),
    },
    {
      key: "registrar_test_mode",
      value: getFormValue(formData, "registrar_test_mode", "false"),
    },
  ]);

  revalidatePath(INTEGRATIONS_PATH);
  redirectWithFeedback(
    "registrar",
    result.success,
    result.success
      ? "Registrar ayarları kaydedildi."
      : result.error ?? "Registrar ayarları kaydedilemedi."
  );
}

export async function saveCpanelWhmIntegrationSettings(formData: FormData) {
  await requireAdmin();

  const settings = await getSettings();
  const currentToken = getSettingValue(settings, "cpanel_api_token", "");

  const result = await updateSettings([
    { key: "cpanel_enabled", value: getFormValue(formData, "cpanel_enabled", "false") },
    { key: "cpanel_host", value: getFormValue(formData, "cpanel_host") },
    { key: "cpanel_port", value: getFormValue(formData, "cpanel_port", "2087") },
    { key: "cpanel_username", value: getFormValue(formData, "cpanel_username") },
    {
      key: "cpanel_api_token",
      value: getSecretFormValue(formData, "cpanel_api_token", currentToken),
    },
    { key: "cpanel_default_plan", value: getFormValue(formData, "cpanel_default_plan", "default") },
    { key: "cpanel_use_ssl", value: getFormValue(formData, "cpanel_use_ssl", "true") },
    { key: "backup_enabled", value: getFormValue(formData, "backup_enabled", "true") },
  ]);

  revalidatePath(INTEGRATIONS_PATH);
  redirectWithFeedback(
    "cpanel",
    result.success,
    result.success
      ? "cPanel/WHM ayarları kaydedildi."
      : result.error ?? "cPanel/WHM ayarları kaydedilemedi."
  );
}

export async function saveVpsVdsIntegrationSettings(formData: FormData) {
  await requireAdmin();

  const settings = await getSettings();
  const currentPassword = getSettingValue(settings, "vps_vds_api_password", "");

  const result = await updateSettings([
    { key: "vps_vds_enabled", value: getFormValue(formData, "vps_vds_enabled", "false") },
    {
      key: "vps_vds_provider",
      value: getFormValue(formData, "vps_vds_provider", "disabled"),
    },
    { key: "vps_vds_api_url", value: getFormValue(formData, "vps_vds_api_url") },
    { key: "vps_vds_api_key", value: getFormValue(formData, "vps_vds_api_key") },
    { key: "vps_vds_api_username", value: getFormValue(formData, "vps_vds_api_username") },
    {
      key: "vps_vds_api_password",
      value: getSecretFormValue(formData, "vps_vds_api_password", currentPassword),
    },
  ]);

  revalidatePath(INTEGRATIONS_PATH);
  redirectWithFeedback(
    "vps-vds",
    result.success,
    result.success
      ? "VPS/VDS ayarları kaydedildi."
      : result.error ?? "VPS/VDS ayarları kaydedilemedi."
  );
}

const EFATURA_PLAIN_FIELDS = [
  "efatura_company_vkn",
  "efatura_uyumsoft_username",
  "efatura_company_name",
  "efatura_company_tax_office",
  "efatura_company_street",
  "efatura_company_district",
  "efatura_company_city",
  "efatura_company_postal_zone",
  "efatura_company_phone",
  "efatura_company_email",
  "efatura_company_website",
  "efatura_company_mersis",
] as const;

function prefixValue(formData: FormData, key: string) {
  return getFormValue(formData, key).trim().toLocaleUpperCase("tr-TR");
}

export async function saveEfaturaIntegrationSettings(formData: FormData) {
  await requireAdmin();

  const settings = await getSettings();
  const currentApiKey = getSettingValue(settings, "efatura_api_key", "");
  const currentUyumsoftPassword = getSettingValue(settings, "efatura_uyumsoft_password", "");

  const earsivPrefix = prefixValue(formData, "efatura_uyumsoft_earsiv_prefix");
  const efaturaPrefix = prefixValue(formData, "efatura_uyumsoft_efatura_prefix");
  const invalidPrefix = [earsivPrefix, efaturaPrefix].find((prefix) => prefix && !/^[A-Z0-9]{3}$/.test(prefix));
  if (invalidPrefix) {
    redirectWithFeedback("efatura", false, `Seri öneki 3 harf/rakam olmalı: ${invalidPrefix}`);
  }
  const vkn = getFormValue(formData, "efatura_company_vkn").replace(/\D/g, "");
  if (vkn && !/^\d{10,11}$/.test(vkn)) {
    redirectWithFeedback("efatura", false, "Şirket VKN 10, TCKN 11 haneli olmalı.");
  }

  const result = await updateSettings([
    { key: "efatura_enabled", value: getFormValue(formData, "efatura_enabled", "false") },
    { key: "efatura_provider", value: getFormValue(formData, "efatura_provider", "uyumsoft") },
    {
      key: "efatura_api_key",
      value: getSecretFormValue(formData, "efatura_api_key", currentApiKey),
    },
    {
      key: "efatura_uyumsoft_password",
      value: getSecretFormValue(formData, "efatura_uyumsoft_password", currentUyumsoftPassword),
    },
    { key: "efatura_uyumsoft_test_mode", value: getFormValue(formData, "efatura_uyumsoft_test_mode", "true") },
    { key: "efatura_uyumsoft_earsiv_prefix", value: earsivPrefix },
    { key: "efatura_uyumsoft_efatura_prefix", value: efaturaPrefix },
    {
      key: "efatura_default_profile",
      value: getFormValue(formData, "efatura_default_profile") === "TICARIFATURA" ? "TICARIFATURA" : "TEMELFATURA",
    },
    ...EFATURA_PLAIN_FIELDS.map((key) => ({
      key,
      value: key === "efatura_company_vkn" ? vkn : getFormValue(formData, key).trim(),
    })),
  ]);

  revalidatePath(INTEGRATIONS_PATH);
  revalidatePath("/yonetim/efatura");
  redirectWithFeedback(
    "efatura",
    result.success,
    result.success
      ? "E-fatura ayarları kaydedildi."
      : result.error ?? "E-fatura ayarları kaydedilemedi."
  );
}

export async function testEfaturaConnection() {
  await requireAdmin();

  const config = await getEInvoiceConfig();
  const provider = createEInvoiceProvider(config.provider, config);
  const result = await provider.healthCheck();

  revalidatePath(INTEGRATIONS_PATH);
  redirectWithFeedback(
    "efatura",
    result.ok && !result.skipped,
    result.skipped
      ? "E-fatura sağlayıcısı yapılandırılmamış."
      : result.ok
        ? `E-fatura bağlantısı başarılı${result.detail ? ` (${result.detail})` : ""}.`
        : result.error ?? "E-fatura bağlantısı başarısız."
  );
}

export async function saveSslIntegrationSettings(formData: FormData) {
  await requireAdmin();

  const settings = await getSettings();
  const currentSectigoApiKey = getSettingValue(settings, "ssl_sectigo_api_key", "");

  const result = await updateSettings([
    { key: "ssl_enabled", value: getFormValue(formData, "ssl_enabled", "false") },
    { key: "ssl_provider", value: getFormValue(formData, "ssl_provider", "disabled") },
    { key: "ssl_acme_email", value: getFormValue(formData, "ssl_acme_email") },
    {
      key: "ssl_sectigo_api_key",
      value: getSecretFormValue(formData, "ssl_sectigo_api_key", currentSectigoApiKey),
    },
  ]);

  revalidatePath(INTEGRATIONS_PATH);
  redirectWithFeedback(
    "ssl",
    result.success,
    result.success
      ? "SSL ayarları kaydedildi."
      : result.error ?? "SSL ayarları kaydedilemedi."
  );
}

export async function testSslConnection() {
  await requireAdmin();

  const provider = await getSslProvider();
  const result = await provider.healthCheck();

  revalidatePath(INTEGRATIONS_PATH);
  redirectWithFeedback(
    "ssl",
    result.ok && !result.skipped,
    result.skipped
      ? "SSL sağlayıcısı yapılandırılmamış."
      : result.ok
        ? "SSL bağlantısı başarılı."
        : result.error ?? "SSL bağlantısı başarısız."
  );
}

export async function saveSmsIntegrationSettings(formData: FormData) {
  await requireAdmin();

  const settings = await getSettings();
  const currentNetgsmPassword = getSettingValue(settings, "sms_netgsm_password", "");
  const currentIletiMerkeziSecret = getSettingValue(settings, "sms_iletimerkezi_secret", "");

  const result = await updateSettings([
    { key: "sms_enabled", value: getFormValue(formData, "sms_enabled", "false") },
    { key: "sms_provider", value: getFormValue(formData, "sms_provider", "disabled") },
    { key: "sms_netgsm_usercode", value: getFormValue(formData, "sms_netgsm_usercode") },
    {
      key: "sms_netgsm_password",
      value: getSecretFormValue(formData, "sms_netgsm_password", currentNetgsmPassword),
    },
    { key: "sms_netgsm_header", value: getFormValue(formData, "sms_netgsm_header") },
    {
      key: "sms_iletimerkezi_api_key",
      value: getFormValue(formData, "sms_iletimerkezi_api_key"),
    },
    {
      key: "sms_iletimerkezi_secret",
      value: getSecretFormValue(
        formData,
        "sms_iletimerkezi_secret",
        currentIletiMerkeziSecret
      ),
    },
    {
      key: "sms_iletimerkezi_sender",
      value: getFormValue(formData, "sms_iletimerkezi_sender"),
    },
    {
      key: "sms_notifications",
      value: getFormValue(formData, "sms_notifications", "false"),
    },
  ]);

  revalidatePath(INTEGRATIONS_PATH);
  redirectWithFeedback(
    "sms",
    result.success,
    result.success
      ? "SMS ayarları kaydedildi."
      : result.error ?? "SMS ayarları kaydedilemedi."
  );
}

export async function saveSmtpIntegrationSettings(formData: FormData) {
  await requireAdmin();

  const settings = await getSettings();
  const currentPassword = getSettingValue(settings, "smtp_password", "");

  const result = await updateSettings([
    { key: "smtp_server", value: getFormValue(formData, "smtp_server") },
    { key: "smtp_port", value: getFormValue(formData, "smtp_port", "587") },
    { key: "smtp_username", value: getFormValue(formData, "smtp_username") },
    {
      key: "smtp_password",
      value: getSecretFormValue(formData, "smtp_password", currentPassword),
    },
    {
      key: "email_notifications",
      value: getFormValue(formData, "email_notifications", "true"),
    },
  ]);

  revalidatePath(INTEGRATIONS_PATH);
  redirectWithFeedback(
    "email",
    result.success,
    result.success
      ? "SMTP ayarları kaydedildi."
      : result.error ?? "SMTP ayarları kaydedilemedi."
  );
}

export async function saveWebhookIntegrationSettings(formData: FormData) {
  await requireAdmin();

  const result = await updateSettings([
    { key: "webhook_orders", value: getFormValue(formData, "webhook_orders") },
    { key: "webhook_payments", value: getFormValue(formData, "webhook_payments") },
  ]);

  revalidatePath(INTEGRATIONS_PATH);
  redirectWithFeedback(
    "webhooks",
    result.success,
    result.success
      ? "Webhook ayarları kaydedildi."
      : result.error ?? "Webhook ayarları kaydedilemedi."
  );
}

export async function importGriTldPricingFromIntegrations() {
  await requireAdmin();

  const result = await syncRegistrarTldsFromProvider();
  revalidatePath(INTEGRATIONS_PATH);
  redirectWithFeedback(
    "registrar",
    result.success,
    result.success
      ? `${result.data.upserted} TLD fiyatı Gri API üzerinden güncellendi.`
      : result.error ?? "TLD fiyatları içe aktarılamadı."
  );
}

export async function testRegistrarConnection() {
  await requireAdmin();

  const provider = await getRegistrarProvider();
  const result = await provider.healthCheck();

  revalidatePath(INTEGRATIONS_PATH);
  redirectWithFeedback(
    "registrar",
    result.ok && !result.skipped,
    result.skipped
      ? "Registrar yapılandırılmamış."
      : result.ok
        ? "Registrar bağlantısı başarılı."
        : result.error ?? "Registrar bağlantısı başarısız."
  );
}

export async function testCpanelWhmConnection() {
  await requireAdmin();

  const provider = await getCpanelWhmProvider();
  const result = await provider.healthCheck();

  revalidatePath(INTEGRATIONS_PATH);
  redirectWithFeedback(
    "cpanel",
    result.ok && !result.skipped,
    result.skipped
      ? "cPanel/WHM yapılandırılmamış."
      : result.ok
        ? "cPanel/WHM bağlantısı başarılı."
        : result.error ?? "cPanel/WHM bağlantısı başarısız."
  );
}

export async function testVpsVdsConnection() {
  await requireAdmin();

  const provider = await getVpsVdsProvider();
  const result = await provider.healthCheck();

  revalidatePath(INTEGRATIONS_PATH);
  redirectWithFeedback(
    "vps-vds",
    result.ok && !result.skipped,
    result.skipped
      ? "VPS/VDS paneli yapılandırılmamış."
      : result.ok
        ? "VPS/VDS panel bağlantısı başarılı."
        : result.error ?? "VPS/VDS panel bağlantısı başarısız."
  );
}

export async function savePaymentGatewayIntegrationSettings(formData: FormData) {
  await requireAdmin();

  const settings = await getSettings();
  const currentIyzicoSecret = getSettingValue(settings, "iyzico_secret_key", "");
  const currentPaytrKey = getSettingValue(settings, "paytr_merchant_key", "");
  const currentPaytrSalt = getSettingValue(settings, "paytr_merchant_salt", "");

  const result = await updateSettings([
    {
      key: "payment_gateway_provider",
      value: getFormValue(formData, "payment_gateway_provider", "stripe"),
    },
    { key: "iyzico_enabled", value: getFormValue(formData, "iyzico_enabled", "false") },
    { key: "iyzico_api_key", value: getFormValue(formData, "iyzico_api_key") },
    {
      key: "iyzico_secret_key",
      value: getSecretFormValue(formData, "iyzico_secret_key", currentIyzicoSecret),
    },
    { key: "iyzico_test_mode", value: getFormValue(formData, "iyzico_test_mode", "true") },
    { key: "paytr_enabled", value: getFormValue(formData, "paytr_enabled", "false") },
    { key: "paytr_merchant_id", value: getFormValue(formData, "paytr_merchant_id") },
    {
      key: "paytr_merchant_key",
      value: getSecretFormValue(formData, "paytr_merchant_key", currentPaytrKey),
    },
    {
      key: "paytr_merchant_salt",
      value: getSecretFormValue(formData, "paytr_merchant_salt", currentPaytrSalt),
    },
  ]);

  revalidatePath(INTEGRATIONS_PATH);
  redirectWithFeedback(
    "payment",
    result.success,
    result.success
      ? "Ödeme ağ geçidi ayarları kaydedildi."
      : result.error ?? "Ödeme ağ geçidi ayarları kaydedilemedi."
  );
}

export async function testStripeConnection() {
  await requireAdmin();

  try {
    const stripe = getStripe();
    await stripe.balance.retrieve();
    redirectWithFeedback("payment", true, "Stripe bağlantısı başarılı.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Stripe bağlantısı başarısız.";
    redirectWithFeedback("payment", false, message);
  }
}

export async function testSmsConnection() {
  await requireAdmin();

  const provider = await getSmsProvider();
  const result = await provider.healthCheck();

  revalidatePath(INTEGRATIONS_PATH);
  redirectWithFeedback(
    "sms",
    result.ok && !result.skipped,
    result.skipped
      ? "SMS sağlayıcısı yapılandırılmamış."
      : result.ok
        ? "SMS bağlantısı başarılı."
        : result.error ?? "SMS bağlantısı başarısız."
  );
}

export async function testIyzicoConnection() {
  await requireAdmin();

  const config = await getPaymentGatewayConfig();
  const provider = createIyzicoPaymentGatewayProvider(config);
  const result = await provider.healthCheck();

  revalidatePath(INTEGRATIONS_PATH);
  redirectWithFeedback(
    "payment",
    result.ok && !result.skipped,
    result.skipped
      ? "iyzico yapılandırılmamış."
      : result.ok
        ? "iyzico bağlantısı başarılı."
        : result.error ?? "iyzico bağlantısı başarısız."
  );
}

export async function testPaytrConnection() {
  await requireAdmin();

  const settings = await getSettings();
  const merchantId = getSettingValue(settings, "paytr_merchant_id");
  const merchantKey = getSettingValue(settings, "paytr_merchant_key");
  const merchantSalt = getSettingValue(settings, "paytr_merchant_salt");
  const enabled = getSettingValue(settings, "paytr_enabled", "false") === "true";

  if (!enabled || !merchantId || !merchantKey || !merchantSalt) {
    redirectWithFeedback("payment", false, "PayTR yapılandırılmamış.");
  }

  revalidatePath(INTEGRATIONS_PATH);
  redirectWithFeedback("payment", true, "PayTR mağaza bilgileri tanımlı.");
}

export async function testSmtpConnection(formData: FormData) {
  await requireAdmin();

  const settings = await getSettings();
  const host = getFormValue(formData, "smtp_server") || getSettingValue(settings, "smtp_server");
  const port = Number(
    getFormValue(formData, "smtp_port") || getSettingValue(settings, "smtp_port", "587")
  );
  const user =
    getFormValue(formData, "smtp_username") || getSettingValue(settings, "smtp_username");
  const pass =
    getSecretFormValue(formData, "smtp_password", getSettingValue(settings, "smtp_password")) ||
    process.env.SMTP_PASSWORD?.trim();

  if (!host || !user || !pass) {
    redirectWithFeedback("email", false, "SMTP bilgileri eksik.");
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transporter.verify();
    redirectWithFeedback("email", true, "SMTP bağlantısı başarılı.");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "SMTP bağlantısı başarısız.";
    redirectWithFeedback("email", false, message);
  }
}
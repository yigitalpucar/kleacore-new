export const MASKED_SECRET_PLACEHOLDER = "********";

export const SECRET_SETTING_KEYS = new Set([
  "smtp_password",
  "registrar_api_key",
  "registrar_password",
  "registrar_client_secret",
  "cpanel_api_token",
  "vps_vds_api_key",
  "vps_vds_api_password",
  "provisioning_api_key",
  "efatura_api_key",
  "efatura_uyumsoft_password",
  "ssl_sectigo_api_key",
  "sms_netgsm_password",
  "sms_iletimerkezi_api_key",
  "sms_iletimerkezi_secret",
  "iyzico_api_key",
  "iyzico_secret_key",
  "paytr_merchant_key",
  "paytr_merchant_salt",
]);

export function isSecretSettingKey(key: string) {
  return SECRET_SETTING_KEYS.has(key);
}
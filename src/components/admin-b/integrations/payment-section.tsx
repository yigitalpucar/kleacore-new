import { Landmark } from "lucide-react";
import { FormField, FormSection, IconTile, StatusBadge, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import {
  savePaymentGatewayIntegrationSettings,
  testIyzicoConnection,
  testKuveytTurkConnection,
  testPaytrConnection,
  testStripeConnection,
} from "@/lib/actions/admin/integrations";
import { CodeValue, EnvRow, FieldGrid, ToggleRow, inputClass, selectClass } from "./shared";
import type { EnvFlags, PaymentGatewayConfig } from "./types";

export function PaymentSection({ paymentGateway, env }: { paymentGateway: PaymentGatewayConfig; env: EnvFlags }) {
  return (
    <div className="space-y-8">
      <form action={savePaymentGatewayIntegrationSettings} className="space-y-8">
        <FormSection title="Ödeme ağ geçidi" description="Kredi kartı ödemeleri için aktif sağlayıcıyı seçin.">
          <FormField label="Aktif sağlayıcı" htmlFor="payment_gateway_provider">
            <select
              id="payment_gateway_provider"
              name="payment_gateway_provider"
              defaultValue={paymentGateway.provider}
              className={selectClass}
            >
              <option value="kuveytturk">Kuveyt Türk Sanal POS (önerilen)</option>
              <option value="stripe">Stripe</option>
              <option value="iyzico">iyzico</option>
              <option value="paytr">PayTR</option>
            </select>
          </FormField>
        </FormSection>

        <FormSection
          title="Kuveyt Türk Sanal POS"
          description="3D Model (TDV2.0.0) ile tek çekim kredi kartı ödemesi. Kart formu sitemizde açılır, kart bilgisi saklanmaz."
          footer={
            <button type="submit" formAction={testKuveytTurkConnection} className={appButton({ variant: "outline" })}>
              Kuveyt Türk yapılandırmasını kontrol et
            </button>
          }
        >
          <ToggleRow
            title="Kuveyt Türk aktif"
            description="Aktif sağlayıcı olarak seçildiğinde kart ödemeleri bu POS üzerinden alınır."
            fieldName="kuveytturk_enabled"
            defaultChecked={paymentGateway.kuveytturk.enabled}
          />
          <FieldGrid>
            <FormField label="Üye işyeri no (MerchantId)" htmlFor="kuveytturk_merchant_id">
              <Input
                id="kuveytturk_merchant_id"
                name="kuveytturk_merchant_id"
                defaultValue={paymentGateway.kuveytturk.merchantId}
                inputMode="numeric"
                autoComplete="off"
                className={inputClass}
              />
            </FormField>
            <FormField label="Müşteri no (CustomerId)" htmlFor="kuveytturk_customer_id">
              <Input
                id="kuveytturk_customer_id"
                name="kuveytturk_customer_id"
                defaultValue={paymentGateway.kuveytturk.customerId}
                inputMode="numeric"
                autoComplete="off"
                className={inputClass}
              />
            </FormField>
          </FieldGrid>
          <FieldGrid>
            <FormField label="API kullanıcı adı (UserName)" htmlFor="kuveytturk_username">
              <Input
                id="kuveytturk_username"
                name="kuveytturk_username"
                defaultValue={paymentGateway.kuveytturk.username}
                autoComplete="off"
                className={inputClass}
              />
            </FormField>
            <FormField label="API şifresi" htmlFor="kuveytturk_password">
              <Input
                id="kuveytturk_password"
                name="kuveytturk_password"
                type="password"
                defaultValue={paymentGateway.kuveytturk.hasPassword ? "********" : ""}
                autoComplete="new-password"
                className={inputClass}
              />
            </FormField>
          </FieldGrid>
          <FormField label="Ortam" htmlFor="kuveytturk_test_mode">
            <select
              id="kuveytturk_test_mode"
              name="kuveytturk_test_mode"
              defaultValue={paymentGateway.kuveytturk.testMode ? "true" : "false"}
              className={selectClass}
            >
              <option value="true">Test (boatest.kuveytturk.com.tr)</option>
              <option value="false">Canlı</option>
            </select>
          </FormField>
          <CodeValue label="OkUrl / FailUrl" value={`${env.appBaseUrl}/api/payments/kuveytturk/callback`} />
        </FormSection>

        <FormSection
          title="iyzico"
          description="Checkout Form API yapılandırması."
          footer={
            <button type="submit" formAction={testIyzicoConnection} className={appButton({ variant: "outline" })}>
              iyzico bağlantısını test et
            </button>
          }
        >
          <ToggleRow
            title="iyzico aktif"
            description="Sağlayıcı seçildiğinde kullanılabilir."
            fieldName="iyzico_enabled"
            defaultChecked={paymentGateway.iyzico.enabled}
          />
          <FieldGrid>
            <FormField label="API anahtarı" htmlFor="iyzico_api_key">
              <Input
                id="iyzico_api_key"
                name="iyzico_api_key"
                defaultValue={paymentGateway.iyzico.apiKey}
                autoComplete="off"
                className={inputClass}
              />
            </FormField>
            <FormField label="Gizli anahtar" htmlFor="iyzico_secret_key">
              <Input
                id="iyzico_secret_key"
                name="iyzico_secret_key"
                type="password"
                defaultValue={paymentGateway.iyzico.hasSecretKey ? "********" : ""}
                autoComplete="new-password"
                className={inputClass}
              />
            </FormField>
          </FieldGrid>
          <FormField label="Ortam" htmlFor="iyzico_test_mode">
            <select
              id="iyzico_test_mode"
              name="iyzico_test_mode"
              defaultValue={paymentGateway.iyzico.testMode ? "true" : "false"}
              className={selectClass}
            >
              <option value="true">Sandbox</option>
              <option value="false">Canlı</option>
            </select>
          </FormField>
          <CodeValue label="Callback URL" value={`${env.appBaseUrl}/api/payments/iyzico/callback`} />
        </FormSection>

        <FormSection
          title="PayTR"
          description="iFrame API yapılandırması."
          footer={
            <button type="submit" formAction={testPaytrConnection} className={appButton({ variant: "outline" })}>
              PayTR yapılandırmasını test et
            </button>
          }
        >
          <ToggleRow
            title="PayTR aktif"
            description="Sağlayıcı seçildiğinde kullanılabilir."
            fieldName="paytr_enabled"
            defaultChecked={paymentGateway.paytr.enabled}
          />
          <FieldGrid>
            <FormField label="Mağaza no (merchant_id)" htmlFor="paytr_merchant_id">
              <Input
                id="paytr_merchant_id"
                name="paytr_merchant_id"
                defaultValue={paymentGateway.paytr.merchantId}
                autoComplete="off"
                className={inputClass}
              />
            </FormField>
            <FormField label="Mağaza parolası (merchant_key)" htmlFor="paytr_merchant_key">
              <Input
                id="paytr_merchant_key"
                name="paytr_merchant_key"
                type="password"
                defaultValue={paymentGateway.paytr.hasMerchantKey ? "********" : ""}
                autoComplete="new-password"
                className={inputClass}
              />
            </FormField>
          </FieldGrid>
          <FormField label="Mağaza gizli anahtarı (merchant_salt)" htmlFor="paytr_merchant_salt">
            <Input
              id="paytr_merchant_salt"
              name="paytr_merchant_salt"
              type="password"
              defaultValue={paymentGateway.paytr.hasMerchantSalt ? "********" : ""}
              autoComplete="new-password"
              className={inputClass}
            />
          </FormField>
          <CodeValue label="Bildirim URL" value={`${env.appBaseUrl}/api/payments/paytr/callback`} />
        </FormSection>

        <div className="flex justify-end border-t pt-6">
          <button type="submit" className={appButton()}>
            Ödeme ayarlarını kaydet
          </button>
        </div>
      </form>

      <FormSection
        title="Stripe"
        description="Stripe anahtarları ortam değişkenleri üzerinden yapılandırılır; değerleri burada gösterilmez."
        footer={
          <form action={testStripeConnection}>
            <button
              type="submit"
              disabled={!env.stripeSecretConfigured}
              className={appButton({ variant: "outline" })}
            >
              Stripe bağlantısını test et
            </button>
          </form>
        }
      >
        <ul className="-mx-4 -mt-4 divide-y border-b md:-mx-5 md:-mt-5">
          <EnvRow name="STRIPE_SECRET_KEY" description="Sunucu tarafı API anahtarı" configured={env.stripeSecretConfigured} />
          <EnvRow
            name="STRIPE_WEBHOOK_SECRET"
            description="Webhook imza doğrulama anahtarı"
            configured={env.stripeWebhookConfigured}
          />
          <EnvRow
            name="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
            description="İstemci tarafı yayın anahtarı"
            configured={env.stripePublishableConfigured}
          />
        </ul>
        <CodeValue label="Webhook URL" value={`${env.appBaseUrl}/api/payments/stripe/webhook`} />
      </FormSection>

      <FormSection title="Banka havalesi" description="Manuel onay akışı; ek yapılandırma gerekmez.">
        <div className="flex items-center gap-3">
          <IconTile>
            <Landmark />
          </IconTile>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Havale / EFT</p>
            <p className="text-xs text-muted-foreground">Ödemeler yönetim panelinden onaylanır.</p>
          </div>
          <StatusBadge tone="info" label="Dahili · Aktif" />
        </div>
      </FormSection>
    </div>
  );
}

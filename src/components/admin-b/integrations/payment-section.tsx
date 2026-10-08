import { Landmark } from "lucide-react";
import { FormField, FormSection, IconTile, StatusBadge, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import {
  savePaymentGatewayIntegrationSettings,
  testIyzicoConnection,
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
              <option value="stripe">Stripe (varsayılan)</option>
              <option value="iyzico">iyzico</option>
              <option value="paytr">PayTR</option>
            </select>
          </FormField>
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

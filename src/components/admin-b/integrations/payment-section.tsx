import { Landmark, Trash2 } from "lucide-react";
import { CopyButton, FormSection, FormField, IconTile, StatusBadge, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import {
  savePaymentGatewayIntegrationSettings,
  testIyzicoConnection,
  testKuveytTurkConnection,
  testPaytrConnection,
  testStripeConnection,
} from "@/lib/actions/admin/integrations";
import { deleteBankAccount, saveBankAccount, toggleBankAccount } from "@/lib/actions/admin/bank-transfer";
import { PaymentMethodsForm } from "./payment-methods-form";
import { CodeValue, EnvRow, FieldGrid, inputClass, selectClass } from "./shared";
import type { EnvFlags, PaymentGatewayConfig } from "./types";

export function PaymentSection({ paymentGateway, env }: { paymentGateway: PaymentGatewayConfig; env: EnvFlags }) {
  return (
    <div className="space-y-8">
      <PaymentMethodsForm methods={paymentGateway.methods} />

      <form action={savePaymentGatewayIntegrationSettings} className="space-y-8">
        <FormSection
          title="Kuveyt Türk Sanal POS"
          description="3D Model (TDV2.0.0) ile tek çekim kredi kartı ödemesi. Kart formu sitemizde açılır, kart bilgisi saklanmaz."
          footer={
            <button type="submit" formAction={testKuveytTurkConnection} className={appButton({ variant: "outline" })}>
              Kuveyt Türk yapılandırmasını kontrol et
            </button>
          }
        >
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
            Sağlayıcı bilgilerini kaydet
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

      <FormSection
        title="Havale / EFT banka hesapları"
        description="Fatura ödeme sayfasında müşterilere gösterilir. Müşteri açıklamaya fatura numarasını yazar ve ödeme bildirimi gönderir; bildirimler Faturalar › Havale bildirimleri ekranında onaylanır."
      >
        {paymentGateway.bankAccounts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-md border border-dashed p-3">
            <IconTile>
              <Landmark />
            </IconTile>
            <p className="text-sm text-muted-foreground">
              Henüz banka hesabı yok. Hesap eklenene kadar Havale / EFT müşterilere gösterilmez.
            </p>
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {paymentGateway.bankAccounts.map((account) => (
              <li key={account.id} className="flex flex-wrap items-start gap-3 p-3">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {account.bankName}
                    {account.branch ? <span className="font-normal text-muted-foreground">· {account.branch}</span> : null}
                    <StatusBadge tone={account.isActive ? "success" : "muted"} label={account.isActive ? "Yayında" : "Gizli"} />
                  </p>
                  <p className="text-muted-foreground">
                    {account.accountName} · {account.currency} · Sıra {account.sortOrder}
                  </p>
                  <p className="flex items-center gap-1 font-mono text-[13px]">
                    {account.ibanFormatted}
                    <CopyButton value={account.iban} label="IBAN'ı kopyala" />
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={toggleBankAccount}>
                    <input type="hidden" name="id" value={account.id} />
                    <button type="submit" className={appButton({ variant: "outline", size: "sm" })}>
                      {account.isActive ? "Gizle" : "Yayınla"}
                    </button>
                  </form>
                  <form action={deleteBankAccount}>
                    <input type="hidden" name="id" value={account.id} />
                    <button
                      type="submit"
                      aria-label={`${account.bankName} hesabını sil`}
                      className={appButton({ variant: "destructive", size: "icon-sm" })}
                    >
                      <Trash2 aria-hidden />
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form action={saveBankAccount} className="space-y-5 border-t pt-5">
          <p className="text-sm font-medium">Hesap ekle</p>
          <FieldGrid>
            <FormField label="Banka" htmlFor="bank_name">
              <Input id="bank_name" name="bankName" required placeholder="Kuveyt Türk" className={inputClass} />
            </FormField>
            <FormField label="Şube" htmlFor="bank_branch" hint="İsteğe bağlı">
              <Input id="bank_branch" name="branch" placeholder="Merkez / 001" className={inputClass} />
            </FormField>
          </FieldGrid>
          <FieldGrid>
            <FormField label="Hesap sahibi" htmlFor="bank_account_name">
              <Input id="bank_account_name" name="accountName" required className={inputClass} />
            </FormField>
            <FormField label="IBAN" htmlFor="bank_iban" hint="TR ile başlayan 26 karakter; kontrol basamağı doğrulanır.">
              <Input
                id="bank_iban"
                name="iban"
                required
                autoComplete="off"
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                className={`${inputClass} font-mono`}
              />
            </FormField>
          </FieldGrid>
          <FieldGrid>
            <FormField label="Para birimi" htmlFor="bank_currency">
              <select id="bank_currency" name="currency" defaultValue="TRY" className={selectClass}>
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </FormField>
            <FormField label="Sıra" htmlFor="bank_sort">
              <Input
                id="bank_sort"
                name="sortOrder"
                type="number"
                defaultValue={paymentGateway.bankAccounts.length}
                className={inputClass}
              />
            </FormField>
          </FieldGrid>
          <div className="flex justify-end">
            <button type="submit" className={appButton()}>
              Hesabı ekle
            </button>
          </div>
        </form>
      </FormSection>
    </div>
  );
}

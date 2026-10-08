import { FormField, FormSection, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { saveWebhookIntegrationSettings } from "@/lib/actions/admin/integrations";
import { inputClass } from "./shared";
import type { WebhooksConfig } from "./types";

export function WebhooksSection({ webhooks }: { webhooks: WebhooksConfig }) {
  return (
    <form action={saveWebhookIntegrationSettings}>
      <FormSection
        title="Giden webhook"
        description="Sipariş ve ödeme olaylarını harici sistemlere bildirin. Boş bırakılan adrese istek gönderilmez."
        footer={
          <button type="submit" className={appButton()}>
            Kaydet
          </button>
        }
      >
        <FormField label="Sipariş webhook" htmlFor="webhook_orders">
          <Input
            id="webhook_orders"
            name="webhook_orders"
            type="text"
            inputMode="url"
            defaultValue={webhooks.orders}
            placeholder="https://example.com/webhook/orders"
            className={inputClass}
          />
        </FormField>
        <FormField label="Ödeme webhook" htmlFor="webhook_payments">
          <Input
            id="webhook_payments"
            name="webhook_payments"
            type="text"
            inputMode="url"
            defaultValue={webhooks.payments}
            placeholder="https://example.com/webhook/payments"
            className={inputClass}
          />
        </FormField>
      </FormSection>
    </form>
  );
}

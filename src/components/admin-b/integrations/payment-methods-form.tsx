"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { FormSection, StatusBadge, appButton } from "@/components/app";
import { Switch } from "@/components/ui/switch";
import { savePaymentMethodsSettings } from "@/lib/actions/admin/integrations";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethodId,
} from "@/lib/integrations/payment-gateways/methods-config";
import { cn } from "@/lib/utils";
import type { PaymentMethodsView } from "./types";

const DESCRIPTIONS: Record<PaymentMethodId, string> = {
  kuveytturk: "3D Secure, tek çekim. Önerilen varsayılan kart yöntemi.",
  paytr: "PayTR iFrame ödeme sayfası.",
  iyzico: "iyzico Checkout Form (taksit seçenekli).",
  bank_transfer: "Banka hesaplarınız ve müşteri ödeme bildirimi; yönetici onayıyla kapanır.",
  balance: "Müşterinin hesap bakiyesinden anında ödeme.",
  stripe: "Yurt dışı kartlar; anahtarlar ortam değişkenlerinden okunur.",
};

const NOT_CONFIGURED: Partial<Record<PaymentMethodId, string>> = {
  bank_transfer: "Banka hesabı ekleyin",
};

/**
 * Enable / disable / order the customer payment methods and pick the default.
 * The card shown as "Kredi / banka kartı" is the default (or first enabled)
 * card gateway; the others appear under "Diğer kart ödeme seçenekleri".
 */
export function PaymentMethodsForm({ methods }: { methods: PaymentMethodsView }) {
  const [order, setOrder] = useState<PaymentMethodId[]>(methods.order);
  const [enabled, setEnabled] = useState<Set<PaymentMethodId>>(new Set(methods.enabled));
  const [defaultMethod, setDefaultMethod] = useState<PaymentMethodId>(methods.defaultMethod);

  const move = (index: number, delta: number) => {
    setOrder((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const toggle = (id: PaymentMethodId, on: boolean) => {
    setEnabled((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const defaultInvalid = !enabled.has(defaultMethod);

  return (
    <form action={savePaymentMethodsSettings}>
      <FormSection
        title="Ödeme yöntemleri"
        description="Müşterilerin sepette ve fatura ödemesinde görebileceği yöntemler. Yalnızca etkin ve yapılandırılmış yöntemler gösterilir."
        footer={
          <button type="submit" disabled={defaultInvalid} className={appButton()}>
            Ödeme yöntemlerini kaydet
          </button>
        }
      >
        <input type="hidden" name="method_order" value={order.join(",")} />
        <input type="hidden" name="default_method" value={defaultMethod} />
        {methods.derived ? (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Bu liste eski “aktif sağlayıcı” ayarından türetildi. Kaydettiğinizde yeni yapı kalıcı olur.
          </p>
        ) : null}
        <ul className="divide-y rounded-lg border">
          {order.map((id, index) => {
            const isEnabled = enabled.has(id);
            const configured = methods.configured[id];
            return (
              <li key={id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`${PAYMENT_METHOD_LABELS[id]} yukarı taşı`}
                    className={appButton({ variant: "ghost", size: "icon-sm" })}
                  >
                    <ArrowUp aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === order.length - 1}
                    aria-label={`${PAYMENT_METHOD_LABELS[id]} aşağı taşı`}
                    className={appButton({ variant: "ghost", size: "icon-sm" })}
                  >
                    <ArrowDown aria-hidden />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {PAYMENT_METHOD_LABELS[id]}
                    {!configured ? (
                      <StatusBadge tone="warning" label={NOT_CONFIGURED[id] ?? "Yapılandırılmamış"} />
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">{DESCRIPTIONS[id]}</p>
                </div>
                <label
                  className={cn(
                    "flex min-h-11 items-center gap-2 text-sm md:min-h-9",
                    !isEnabled && "text-muted-foreground"
                  )}
                >
                  <input
                    type="radio"
                    name="default_method_choice"
                    checked={defaultMethod === id}
                    disabled={!isEnabled}
                    onChange={() => setDefaultMethod(id)}
                  />
                  Varsayılan
                </label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(on) => toggle(id, on)}
                    aria-label={`${PAYMENT_METHOD_LABELS[id]} etkin`}
                  />
                  {isEnabled ? <input type="hidden" name={`method_enabled_${id}`} value="on" /> : null}
                </div>
              </li>
            );
          })}
        </ul>
        {defaultInvalid ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Varsayılan yöntem etkin olmalı.
          </p>
        ) : null}
      </FormSection>
    </form>
  );
}

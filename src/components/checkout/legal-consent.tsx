"use client";

import { useMemo } from "react";
import { FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cartTotals } from "@/lib/billing/cart-totals";
import {
  LEGAL_PAYMENT_METHOD_LABELS,
  renderLegalTemplate,
  type LegalBuyer,
  type LegalRenderContext,
  type LegalSeller,
} from "@/lib/legal/render";
import type { CartItem } from "@/store/cart-store";

export interface CheckoutLegalDocument {
  id: string;
  type: string;
  version: number;
  title: string;
  content: string;
  isPlaceholder: boolean;
}

/** Text after the document title (Turkish suffix included). */
const acceptanceSuffix: Record<string, string> = {
  PRELIMINARY_INFORMATION: "'nu okudum, bilgilendirildim.",
  DISTANCE_SALES_CONTRACT: "'ni okudum, kabul ediyorum.",
};

const legalProse =
  "text-sm leading-relaxed text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_p]:my-2 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_td]:border [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_.legal-placeholder]:rounded-md [&_.legal-placeholder]:border [&_.legal-placeholder]:border-amber-500/40 [&_.legal-placeholder]:bg-amber-500/10 [&_.legal-placeholder]:p-3";

/**
 * Required pre-checkout consents: Ön Bilgilendirme Formu and Mesafeli Satış
 * Sözleşmesi, each opened in a modal rendered with the current cart. The
 * binding snapshot (with the server-calculated prices, discounts and order
 * numbers) is rendered and stored again when the order is created.
 */
export function CheckoutLegalConsent({
  documents,
  seller,
  buyer,
  items,
  taxRate,
  paymentMethod,
  accepted,
  onAcceptedChange,
  disabled,
}: {
  documents: CheckoutLegalDocument[];
  seller: LegalSeller;
  buyer: LegalBuyer | null;
  items: CartItem[];
  taxRate: number;
  paymentMethod: string;
  accepted: Record<string, boolean>;
  onAcceptedChange: (documentId: string, value: boolean) => void;
  disabled?: boolean;
}) {
  const context = useMemo<LegalRenderContext>(() => {
    const totals = cartTotals(items, taxRate);
    return {
      seller,
      buyer: buyer ?? {
        name: "Giriş yaptıktan sonra hesap bilgilerinizle doldurulur",
        email: "—",
        phone: "",
        address: "",
      },
      order: {
        date: new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(new Date()),
        numbers: "Sipariş onayıyla oluşturulur",
        items: items.map((item) => ({
          name: item.title,
          quantity: item.quantity,
          period:
            item.type === "domain" || item.metadata?.billingPeriod === "yearly" ? "Yıllık" : "Aylık",
          lineTotal: item.unitPrice * item.quantity,
        })),
        subtotal: totals.subtotal,
        discount: 0,
        taxRate,
        tax: totals.taxAmount,
        total: totals.total,
        paymentMethod: LEGAL_PAYMENT_METHOD_LABELS[paymentMethod] ?? paymentMethod,
      },
    };
  }, [buyer, items, paymentMethod, seller, taxRate]);

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium">Sözleşmeler</legend>
      {documents.map((document) => {
        const suffix = acceptanceSuffix[document.type] ?? " metnini okudum, kabul ediyorum.";
        const checkboxId = `legal-${document.id}`;
        return (
          <div key={document.id} className="flex items-start gap-3">
            <Checkbox
              id={checkboxId}
              checked={Boolean(accepted[document.id])}
              onCheckedChange={(value) => onAcceptedChange(document.id, value === true)}
              className="mt-0.5"
              aria-label={`${document.title}${suffix}`}
              aria-required
            />
            <div className="text-xs leading-relaxed text-muted-foreground">
              <Dialog>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="inline font-medium text-foreground underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {document.title}
                  </button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <FileText aria-hidden className="size-4" />
                      {document.title}
                    </DialogTitle>
                    <DialogDescription>
                      Sürüm {document.version} · Sepetinizdeki ürünlerle hazırlanmıştır. İndirimler ve sipariş
                      numaraları sipariş oluşturulurken kesinleşir.
                    </DialogDescription>
                  </DialogHeader>
                  <div
                    className={legalProse}
                    // Admin-authored template; every variable is escaped by renderLegalTemplate.
                    dangerouslySetInnerHTML={{ __html: renderLegalTemplate(document.content, context) }}
                  />
                </DialogContent>
              </Dialog>
              <label htmlFor={checkboxId} className="cursor-pointer">
                {suffix}
              </label>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

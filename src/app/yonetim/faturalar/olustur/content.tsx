"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Plus, Search, Trash2 } from "lucide-react";
import { FormField, FormSection, PageHeader, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createInvoice } from "@/lib/actions/admin/invoices";
import { calculateInvoiceTotals } from "@/lib/billing/invoice-totals";
import { toNumber } from "@/lib/money";
import { formatTRY } from "@/lib/format/price";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface CustomerOption {
  id: string;
  name: string;
  email: string;
}

interface CreateInvoiceContentProps {
  customers: CustomerOption[];
}

const money = (n: number) => formatTRY(n, { keepDecimals: true });

export function CreateInvoiceContent({ customers }: CreateInvoiceContentProps) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [taxRate, setTaxRate] = useState(20);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState([{ id: 1, description: "", quantity: 1, unitPrice: 0 }]);

  const addItem = () => {
    setItems([...items, { id: Date.now(), description: "", quantity: 1, unitPrice: 0 }]);
  };

  const removeItem = (id: number) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: number, field: string, value: string | number) => {
    setItems(items.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  // Same Decimal calculation the server uses when it saves the invoice.
  const totals = calculateInvoiceTotals(items, taxRate);
  const subtotal = toNumber(totals.subtotal);
  const taxAmount = toNumber(totals.taxAmount);
  const total = toNumber(totals.totalAmount);

  const itemsInvalid = items.some((i) => !i.description || i.unitPrice <= 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) return void toast.error("Lütfen bir müşteri seçin");
    if (!dueDate) return void toast.error("Lütfen son ödeme tarihini girin");
    if (itemsInvalid) return void toast.error("Her kalem için açıklama ve sıfırdan büyük birim fiyat girin");
    setSubmitting(true);
    const result = await createInvoice({
      customerId,
      taxRate,
      dueDate,
      notes: notes || undefined,
      items: items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    });
    setSubmitting(false);
    if (result.success && result.data) {
      toast.success("Fatura oluşturuldu");
      router.push(`/yonetim/faturalar/${result.data.id}`);
    } else if (!result.success) {
      toast.error(result.error ?? "Fatura oluşturulamadı");
    }
  };

  const q = customerSearch.toLocaleLowerCase("tr-TR");
  const filteredCustomers = customers.filter(
    (c) => c.name.toLocaleLowerCase("tr-TR").includes(q) || c.email.toLocaleLowerCase("tr-TR").includes(q)
  );
  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/faturalar", label: "Faturalar" }}
        title="Fatura oluştur"
        description="Bir müşteri için elle fatura kesin. Fatura “Ödeme bekliyor” durumunda oluşturulur."
      />

      <form onSubmit={handleSubmit} className="space-y-8" noValidate>
        <FormSection
          title="Müşteri"
          description="Faturanın kesileceği müşteriyi seçin. Kapalı hesaplar listelenmez."
        >
          <FormField label="Müşteri ara" htmlFor="customer-search">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="customer-search"
                type="search"
                placeholder="Ad veya e-posta…"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </FormField>
          <div
            role="radiogroup"
            aria-label="Müşteri"
            className="max-h-72 divide-y overflow-y-auto rounded-md border"
          >
            {filteredCustomers.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Eşleşen müşteri bulunamadı.</p>
            ) : (
              filteredCustomers.map((customer) => {
                const selected = customer.id === customerId;
                return (
                  <button
                    key={customer.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setCustomerId(customer.id)}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      selected ? "bg-muted" : "hover:bg-muted/50"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border",
                        selected && "border-foreground bg-foreground text-background"
                      )}
                    >
                      {selected ? <Check className="size-3" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{customer.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{customer.email}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {selectedCustomer ? (
            <p className="text-sm text-muted-foreground">
              Seçili: <span className="font-medium text-foreground">{selectedCustomer.name}</span> · {selectedCustomer.email}
            </p>
          ) : null}
        </FormSection>

        <FormSection title="Kalemler" description="Tutarlar KDV hariçtir. KDV aşağıdaki orana göre eklenir.">
          <ol className="space-y-4">
            {items.map((item, index) => (
              <li key={item.id} className="rounded-md border border-dashed p-3 md:p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    Kalem {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={items.length === 1}
                    aria-label={`Kalem ${index + 1} sil`}
                    className={appButton({ variant: "ghost", size: "icon-sm" })}
                  >
                    <Trash2 aria-hidden />
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_96px_140px]">
                  <FormField label="Açıklama" htmlFor={`item-desc-${item.id}`} required>
                    <Input
                      id={`item-desc-${item.id}`}
                      placeholder="Ürün / hizmet açıklaması"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                    />
                  </FormField>
                  <FormField label="Adet" htmlFor={`item-qty-${item.id}`}>
                    <Input
                      id={`item-qty-${item.id}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                    />
                  </FormField>
                  <FormField label="Birim fiyat (₺)" htmlFor={`item-price-${item.id}`} required>
                    <Input
                      id={`item-price-${item.id}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                    />
                  </FormField>
                </div>
                <p className="mt-3 text-right text-sm text-muted-foreground">
                  Kalem toplamı <span className="font-medium tabular-nums text-foreground">{money(toNumber(totals.lines[index].totalPrice))}</span>
                </p>
              </li>
            ))}
          </ol>
          <button type="button" onClick={addItem} className={appButton({ variant: "outline", className: "w-full" })}>
            <Plus aria-hidden />
            Kalem ekle
          </button>
        </FormSection>

        <FormSection
          title="Ödeme koşulları"
          description="Vade, KDV oranı ve faturada görünecek not."
          footer={
            <>
              <Link href="/yonetim/faturalar" className={appButton({ variant: "ghost" })}>
                Vazgeç
              </Link>
              <button type="submit" className={appButton()} disabled={submitting || !customerId || !dueDate}>
                {submitting ? "Oluşturuluyor…" : "Faturayı oluştur"}
              </button>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Son ödeme tarihi" htmlFor="due-date" required>
              <Input id="due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </FormField>
            <FormField label="KDV oranı (%)" htmlFor="tax-rate">
              <Input
                id="tax-rate"
                type="number"
                inputMode="decimal"
                min={0}
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              />
            </FormField>
          </div>
          <FormField label="Not" htmlFor="notes" hint="İsteğe bağlı. Faturada görünür.">
            <Textarea id="notes" rows={3} placeholder="Fatura notu…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
          <dl className="space-y-2 rounded-md border bg-muted/30 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Ara toplam</dt>
              <dd className="tabular-nums">{money(subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">KDV (%{taxRate})</dt>
              <dd className="tabular-nums">{money(taxAmount)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-dashed pt-2 text-base font-semibold">
              <dt>Genel toplam</dt>
              <dd className="tabular-nums">{money(total)}</dd>
            </div>
          </dl>
        </FormSection>
      </form>
    </>
  );
}

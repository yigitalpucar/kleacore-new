"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { requestDomainTransfer } from "@/lib/actions/public/domains";
import { toast } from "@/lib/toast";
import { buttonClasses } from "@/components/site/button-classes";
import { CornerTicks } from "@/components/site/grid-lines";

interface DomainTransferFormProps {
  isLoggedIn: boolean;
  isAutomatedTransferAvailable: boolean;
}

const inputClass =
  "h-11 w-full rounded-md border bg-background px-3 text-base outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";

export function DomainTransferForm({
  isLoggedIn,
  isAutomatedTransferAvailable,
}: DomainTransferFormProps) {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [eppCode, setEppCode] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<null | { success: boolean; message: string }>(null);
  const ids = { domain: useId(), epp: useId(), eppHint: useId(), email: useId() };
  const automated = isLoggedIn && isAutomatedTransferAvailable;

  const handleTransfer = async () => {
    if (!domain.trim() || !eppCode.trim() || !email.trim()) return;

    setIsLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.set("domain", domain);
      formData.set("eppCode", eppCode);
      formData.set("email", email);

      const response = await requestDomainTransfer(formData);
      const message = response.success
        ? response.message ?? "Transfer talebiniz alındı."
        : response.error ?? "Transfer talebi oluşturulamadı.";

      setResult({
        success: response.success,
        message,
      });

      if (response.success) {
        toast.success(message);

        const invoiceId =
          "data" in response &&
          response.data &&
          "invoiceId" in response.data &&
          response.data.invoiceId
            ? response.data.invoiceId
            : null;

        if (invoiceId) {
          router.push(`/musteri/panel/faturalar/${invoiceId}`);
          return;
        }
      } else {
        toast.error(message);
      }
    } catch {
      const message = "Transfer talebi şu anda oluşturulamadı. Lütfen tekrar deneyin.";
      setResult({ success: false, message });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      aria-label="Domain transfer talebi"
      onSubmit={(event) => {
        event.preventDefault();
        void handleTransfer();
      }}
      className="relative rounded-xl border bg-background p-5 text-left shadow-[0_16px_32px_-20px_rgba(0,0,0,0.25)] sm:p-6 dark:shadow-none"
    >
      <CornerTicks />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Transfer talebi
        </p>
        {automated ? (
          <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Otomatik transfer
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {automated
          ? "Transfer otomatik başlatılır, ardından fatura ödeme sayfasına yönlendirilirsiniz."
          : "Talebiniz destek ekibimize iletilir; transfer adımları için sizinle e-posta üzerinden iletişime geçeriz."}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor={ids.domain} className="mb-1.5 block text-sm font-medium">
            Alan adı
          </label>
          <input
            id={ids.domain}
            name="domain"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="ornek.com"
            className={inputClass}
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor={ids.epp} className="mb-1.5 block text-sm font-medium">
            EPP / Auth kodu
          </label>
          <input
            id={ids.epp}
            name="eppCode"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="Transfer kodunuz"
            aria-describedby={ids.eppHint}
            className={cn(inputClass, "font-mono")}
            value={eppCode}
            onChange={(e) => setEppCode(e.target.value)}
            required
          />
          <p id={ids.eppHint} className="mt-1.5 text-xs text-muted-foreground">
            Mevcut firmanızın panelinden alabilirsiniz.
          </p>
        </div>
        <div>
          <label htmlFor={ids.email} className="mb-1.5 block text-sm font-medium">
            İletişim e-postası
          </label>
          <input
            id={ids.email}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="ornek@eposta.com"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>

      <div aria-live="polite">
        {result ? (
          <p
            className={cn(
              "mt-5 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm",
              result.success ? "bg-muted/40 text-foreground" : "border-destructive/40 text-destructive"
            )}
          >
            {result.success ? (
              <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            )}
            {result.message}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        className={buttonClasses({ size: "lg", className: "mt-5 w-full" })}
        disabled={isLoading || !domain.trim() || !eppCode.trim() || !email.trim()}
      >
        {isLoading ? (
          <>
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Kontrol ediliyor…
          </>
        ) : (
          <>
            Transfer talebi oluştur
            <ArrowRight aria-hidden className="size-4" />
          </>
        )}
      </button>
    </form>
  );
}

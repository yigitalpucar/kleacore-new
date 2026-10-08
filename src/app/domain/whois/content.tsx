"use client";

import { Suspense, useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Calendar, CircleAlert, Loader2, Search, Server, ShieldCheck, User } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import {
  CtaBand,
  FaqSection,
  FeatureGrid,
  PageHeader,
  Section,
  SectionHeading,
  buttonClasses,
  type FaqItem,
  type FeatureItem,
} from "@/components/site";
import { CornerTicks } from "@/components/site/grid-lines";
import { lookupWhois, type WhoisLookupResult } from "@/lib/actions/public/domains";
import { toast } from "@/lib/toast";

const infoItems: FeatureItem[] = [
  {
    icon: User,
    title: "Kayıt firması ve sahibi",
    description:
      "Alan adının hangi kayıt firmasında olduğunu görün. Sahip bilgileri çoğu zaman gizlilik düzenlemeleri nedeniyle gizlenir.",
  },
  {
    icon: Calendar,
    title: "Kayıt ve bitiş tarihleri",
    description: "Alan adının ne zaman kaydedildiğini, ne zaman sona ereceğini ve en son ne zaman güncellendiğini öğrenin.",
  },
  {
    icon: Server,
    title: "Nameserver ve DNSSEC",
    description: "Alan adının hangi nameserver'lara yönlendiğini ve DNSSEC ile imzalanıp imzalanmadığını kontrol edin.",
  },
  {
    icon: ShieldCheck,
    title: "Durum kodları",
    description: "Transfer kilidi gibi durum kodları, alan adının transfer edilip edilemeyeceğini gösterir.",
  },
];

const faqs: FaqItem[] = [
  {
    question: "WHOIS nedir?",
    answer:
      "WHOIS (ve yeni nesil karşılığı RDAP), alan adlarının kayıt bilgilerini sorgulamaya yarayan sistemdir. Kayıt firmasını, kayıt ve bitiş tarihlerini, nameserver'ları ve durum kodlarını gösterir.",
  },
  {
    question: "WHOIS sorgusu ücretli mi?",
    answer: "Hayır. Bu sayfadan yaptığınız sorgular ücretsizdir ve üyelik gerektirmez. Kötüye kullanımı önlemek için kısa sürede yapılabilecek sorgu sayısı sınırlıdır.",
  },
  {
    question: "Neden bazı bilgiler gizli görünüyor?",
    answer:
      "KVKK, GDPR ve benzeri düzenlemeler nedeniyle birçok kayıt firması alan adı sahibinin kişisel bilgilerini gizler. Bu durumda sonuçlarda \"REDACTED FOR PRIVACY\" gibi ifadeler görürsünüz.",
  },
  {
    question: "Sonuç bulunamadıysa alan adı müsait mi?",
    answer:
      "Kesin değildir. Bazı uzantılar (ör. .tr) herkese açık RDAP hizmeti sunmaz; bu durumda kayıtlı bir alan adı için de sonuç dönmeyebilir. Kesin müsaitlik sipariş aşamasında kayıt kuruluşu üzerinden doğrulanır.",
  },
  {
    question: "Durum kodları ne anlama gelir?",
    answer:
      "\"clientTransferProhibited\" transfer kilidinin açık olduğunu, \"clientDeleteProhibited\" silme korumasını, \"ok\" ise herhangi bir kısıtlama olmadığını gösterir. Transfer için kilidin kaldırılması gerekir.",
  },
  {
    question: "Sorguladığım alan adını nasıl transfer ederim?",
    answer:
      "Alan adı size aitse, mevcut firmanızdan transfer kilidini kaldırıp EPP/Auth kodunu alın ve Domain Transferi sayfasından talep oluşturun.",
  },
];

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("tr-TR", { year: "numeric", month: "long", day: "numeric" });
}

function WhoisTool() {
  const searchParams = useSearchParams();
  const [domain, setDomain] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<WhoisLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const reduceMotion = useReducedMotion();

  const runLookup = useCallback(async (query: string) => {
    const normalized = query.trim();
    if (!normalized) return;

    setIsSearching(true);
    setResult(null);
    setError(null);

    try {
      const response = await lookupWhois(normalized);
      if (!response.success || !response.data) {
        const message = response.error ?? "WHOIS kaydı bulunamadı veya sorgu tamamlanamadı";
        setError(message);
        toast.error(message);
        return;
      }
      setResult(response.data);
    } catch {
      const message = "WHOIS sorgusu şu anda tamamlanamadı. Lütfen biraz sonra tekrar deneyin.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const param = searchParams.get("domain")?.trim();
    if (!param) return;
    setDomain(param);
    void runLookup(param);
  }, [searchParams, runLookup]);

  const rows: { label: string; value: string }[] = result
    ? [
        { label: "Kayıt firması", value: result.registrar },
        { label: "Kayıt sahibi", value: result.registrant },
        { label: "Kayıt tarihi", value: formatDate(result.createdDate) },
        { label: "Bitiş tarihi", value: formatDate(result.expiryDate) },
        { label: "Son güncelleme", value: formatDate(result.updatedDate) },
        { label: "DNSSEC", value: result.dnssec === "signed" ? "İmzalı" : "İmzasız" },
      ]
    : [];

  return (
    <div className="mx-auto max-w-3xl text-left">
      <form
        role="search"
        aria-label="WHOIS sorgulama"
        onSubmit={(event) => {
          event.preventDefault();
          void runLookup(domain);
        }}
        className="relative rounded-xl border bg-background p-2 shadow-[0_16px_32px_-20px_rgba(0,0,0,0.25)] dark:shadow-none"
      >
        <CornerTicks />
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <label htmlFor={inputId} className="sr-only">
              Sorgulanacak alan adı
            </label>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id={inputId}
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="ornek.com"
              className="h-12 w-full rounded-lg bg-transparent pl-12 pr-4 text-base outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring sm:h-14 sm:text-lg"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className={buttonClasses({ size: "lg", className: "h-12 sm:h-14 sm:px-8" })}
            disabled={isSearching || !domain.trim()}
          >
            {isSearching ? (
              <>
                <Loader2 aria-hidden className="size-4 animate-spin" />
                Sorgulanıyor…
              </>
            ) : (
              <>
                <Search aria-hidden className="size-4" />
                Sorgula
              </>
            )}
          </button>
        </div>
      </form>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Uzantıyı da yazın (ör. ornek.com.tr). Uzantı yazılmazsa .com sorgulanır.
      </p>

      <div aria-live="polite">
        {isSearching ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 aria-hidden className="size-6 animate-spin text-muted-foreground" />
            <span className="sr-only">Sorgulanıyor</span>
          </div>
        ) : null}

        {error && !isSearching ? (
          <div className="mt-6 flex flex-col gap-4 rounded-xl border border-dashed bg-background p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-foreground" />
              {error}
            </p>
            <Link href="/domain/kayit" className={buttonClasses({ variant: "outline", className: "shrink-0" })}>
              Alan adı sorgula
            </Link>
          </div>
        ) : null}

        {result && !isSearching ? (
          <motion.article
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 overflow-hidden rounded-xl border bg-background"
            aria-labelledby="whois-sonuc"
          >
            <header className="flex flex-col gap-3 border-b bg-muted/40 p-5 sm:flex-row sm:items-center sm:justify-between dark:bg-muted/20">
              <div className="min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  WHOIS sonucu
                </p>
                <h2 id="whois-sonuc" className="mt-1 break-all font-mono text-xl font-semibold">
                  {result.domain}
                </h2>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium">
                <span aria-hidden className="size-1.5 rounded-full bg-foreground/70" />
                Kayıtlı alan adı
              </span>
            </header>

            <dl className="grid grid-cols-1 sm:grid-cols-2">
              {rows.map((row) => (
                <div key={row.label} className="border-b border-dashed px-5 py-4 sm:odd:border-r">
                  <dt className="text-xs text-muted-foreground">{row.label}</dt>
                  <dd className="mt-1 break-words text-sm font-medium">{row.value}</dd>
                </div>
              ))}
            </dl>

            <div className="grid grid-cols-1 sm:grid-cols-2">
              <div className="border-b border-dashed px-5 py-4 sm:border-b-0 sm:border-r">
                <h3 className="text-xs font-normal text-muted-foreground">Nameserver&apos;lar</h3>
                {result.nameServers.length > 0 ? (
                  <ul className="mt-2 space-y-1.5">
                    {result.nameServers.map((ns) => (
                      <li key={ns} className="break-all font-mono text-sm">
                        {ns.toLowerCase()}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm">—</p>
                )}
              </div>
              <div className="px-5 py-4">
                <h3 className="text-xs font-normal text-muted-foreground">Durum kodları</h3>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {result.status.map((status) => (
                    <li key={status} className="rounded border px-2 py-1 font-mono text-xs">
                      {status}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <footer className="flex flex-col gap-2 border-t p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                className={buttonClasses({ variant: "outline" })}
                onClick={() => {
                  setResult(null);
                  setDomain("");
                }}
              >
                Yeni sorgu
              </button>
              <Link href="/domain/transfer" className={buttonClasses()}>
                Bu alan adını transfer et
              </Link>
            </footer>
          </motion.article>
        ) : null}
      </div>
    </div>
  );
}

export function Content() {
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <PageHeader
          eyebrow="Alan adı"
          title="WHOIS sorgulama"
          description="Bir alan adının kayıt firmasını, kayıt ve bitiş tarihlerini, nameserver'larını ve durum kodlarını ücretsiz sorgulayın."
          breadcrumbs={[{ label: "Domain", href: "/domain/kayit" }, { label: "WHOIS sorgulama" }]}
        >
          <Suspense fallback={<div className="mx-auto h-16 max-w-3xl rounded-xl border bg-background" />}>
            <WhoisTool />
          </Suspense>
        </PageHeader>

        <Section divider>
          <SectionHeading
            eyebrow="WHOIS / RDAP"
            title="Sorgu sonucunda neler görürsünüz?"
            description="Sonuçlar, alan adının kayıt kuruluşunun yayınladığı herkese açık kayıt verisinden gelir."
            className="mb-12"
          />
          <FeatureGrid items={infoItems} columns={4} />
        </Section>

        <FaqSection
          items={faqs}
          title="WHOIS hakkında sorular"
          description="Sorgu sonuçlarını yorumlamak için bilmeniz gerekenler."
          tone="muted"
          divider
        />

        <CtaBand
          eyebrow="Alan adı"
          title="Aradığınız alan adı kayıtlı değil mi?"
          description="Alan adı sorgulayın ve uzantı bazında kayıt, yenileme ve transfer fiyatlarını görün."
          primary={{ label: "Alan adı sorgula", href: "/domain/kayit" }}
          secondary={{ label: "Domain transferi", href: "/domain/transfer" }}
        />
      </main>
      <Footer />
    </div>
  );
}

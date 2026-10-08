"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown, FileCheck2, Headphones, Loader2, Network, Search, UserCheck } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import {
  CtaBand,
  FaqSection,
  FeatureGrid,
  PageHeader,
  Price,
  Section,
  SectionHeading,
  TrustBar,
  buttonClasses,
  type FaqItem,
  type FeatureItem,
  type TrustBarItem,
} from "@/components/site";
import { CornerTicks } from "@/components/site/grid-lines";
import { DomainResultList, type DomainResultItem } from "@/components/site/domain/domain-results";
import { searchDomainAvailability } from "@/lib/actions/public/domains";
import { formatTRY } from "@/lib/format/price";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface BelgesizTld {
  ext: string;
  registerPrice: number;
  renewPrice: number;
  description: string;
}

const trustItems: TrustBarItem[] = [
  { icon: FileCheck2, label: "Belge gerekmez", description: "Marka/şirket belgesi istenmez" },
  { icon: UserCheck, label: "Kimlik doğrulama", description: "TRABİS kurallarına göre" },
  { icon: Network, label: "DNS yönetimi", description: "Müşteri panelinden" },
  { icon: Headphones, label: "7/24 Destek", description: "Destek talebi ve e-posta" },
];

const features: FeatureItem[] = [
  {
    icon: FileCheck2,
    title: "Belge yükleme yok",
    description: "Bu uzantılarda marka tescili, ticaret sicili veya vergi levhası gibi belgeler istenmez; ilk başvuran kaydeder.",
  },
  {
    icon: UserCheck,
    title: "Kimlik bilgisi gerekir",
    description:
      ".tr alan adları TRABİS üzerinden kaydedilir. Kayıt sırasında T.C. kimlik veya vergi numarası gibi bilgilerin doğrulanması istenebilir.",
  },
  {
    icon: Network,
    title: "Panelden yönetim",
    description: "Kayıttan sonra DNS kayıtlarını ve nameserver'ları müşteri panelinden yönetirsiniz.",
  },
];

const faqs: FaqItem[] = [
  {
    question: "Belgesiz .tr alan adı nedir?",
    answer:
      "Kaydı için marka, şirket veya kurum belgesi istenmeyen .tr uzantılarıdır. Bu sayfada listelenen uzantılar ilk başvuran esasına göre kaydedilir.",
  },
  {
    question: "Kayıt için hangi bilgiler gerekiyor?",
    answer:
      ".tr alan adları TRABİS (.tr Ağ Bilgi Sistemi) üzerinden kaydedilir. Belge istenmese de kayıt sahibinin kimlik veya vergi bilgilerinin doğrulanması gerekebilir. Bilgilerinizin güncel ve doğru olduğundan emin olun.",
  },
  {
    question: "Kayıt ne kadar sürer?",
    answer:
      "Ödemeniz onaylandıktan sonra başvuru TRABİS'e iletilir. Süre, kimlik doğrulamasının tamamlanmasına bağlıdır; doğrulama bekleyen başvurular tamamlanana kadar aktif olmaz.",
  },
  {
    question: ".com.tr de belgesiz alınabilir mi?",
    answer:
      ".com.tr, .net.tr ve .org.tr için kayıt koşulları farklıdır. Bu uzantılar Alan adı kaydı sayfasında listelenir; koşullar hakkında destek ekibimize danışabilirsiniz.",
  },
  {
    question: "Fiyatlara KDV dahil mi?",
    answer: "Hayır. Gösterilen fiyatlara KDV dahil değildir; %20 KDV ödeme adımında eklenir.",
  },
];

export const BelgesizTRContent = ({ tlds }: { tlds: BelgesizTld[] }) => {
  const [domain, setDomain] = useState("");
  const [selectedTld, setSelectedTld] = useState(tlds[0]?.ext ?? ".gen.tr");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<DomainResultItem[]>([]);
  const inputId = useId();
  const selectId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const lowest = tlds.length > 0 ? Math.min(...tlds.map((t) => t.registerPrice)) : null;

  const handleSearch = async () => {
    if (!domain.trim()) return;

    setIsSearching(true);
    setResults([]);

    try {
      const response = await searchDomainAvailability(domain, [selectedTld]);
      if (!response.success || !response.data) {
        toast.error(response.error ?? "Domain sorgusu tamamlanamadı");
        return;
      }

      const firstResult = response.data.results[0];
      if (!firstResult) {
        toast.error("Sorgu sonucu alınamadı");
        return;
      }

      setResults([
        {
          domain: firstResult.domain,
          available: firstResult.available,
          price: firstResult.price,
          renewPrice: firstResult.renewPrice,
        },
      ]);
    } catch {
      toast.error("Domain sorgusu şu anda tamamlanamadı. Lütfen tekrar deneyin.");
    } finally {
      setIsSearching(false);
    }
  };

  const pickTld = (ext: string) => {
    setSelectedTld(ext);
    setResults([]);
    inputRef.current?.focus({ preventScroll: true });
    document.getElementById("belgesiz-ara")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="flex-1">
        <PageHeader
          eyebrow="Alan adı"
          title="Belgesiz .tr alan adı"
          description={
            lowest !== null
              ? `Marka veya şirket belgesi gerektirmeyen .tr uzantıları, yıllık ${formatTRY(lowest)} + KDV'den başlayan fiyatlarla.`
              : "Marka veya şirket belgesi gerektirmeyen .tr uzantıları."
          }
          breadcrumbs={[{ label: "Domain", href: "/domain/kayit" }, { label: "Belgesiz .tr" }]}
        >
          <div id="belgesiz-ara" className="mx-auto max-w-3xl scroll-mt-24 text-left">
            <form
              role="search"
              aria-label="Belgesiz .tr alan adı sorgulama"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSearch();
              }}
              className="relative rounded-xl border bg-background p-2 shadow-[0_16px_32px_-20px_rgba(0,0,0,0.25)] dark:shadow-none"
            >
              <CornerTicks />
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex flex-1 items-center">
                  <label htmlFor={inputId} className="sr-only">
                    Alan adı
                  </label>
                  <input
                    ref={inputRef}
                    id={inputId}
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="ornek-isim"
                    className="h-12 min-w-0 flex-1 rounded-lg bg-transparent px-4 text-base outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring sm:h-14 sm:text-lg"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                  />
                  <label htmlFor={selectId} className="sr-only">
                    Uzantı
                  </label>
                  <div className="relative shrink-0">
                    <select
                      id={selectId}
                      value={selectedTld}
                      onChange={(e) => {
                        setSelectedTld(e.target.value);
                        setResults([]);
                      }}
                      className="h-11 appearance-none rounded-md border bg-muted/50 pl-3 pr-8 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {tlds.map((tld) => (
                        <option key={tld.ext} value={tld.ext}>
                          {tld.ext}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      aria-hidden
                      className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                  </div>
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
            <div aria-live="polite">
              {results.length > 0 && !isSearching ? <DomainResultList results={results} className="mt-6" /> : null}
            </div>
          </div>
        </PageHeader>

        <TrustBar items={trustItems} bordered={false} />

        <Section tone="muted" divider>
          <SectionHeading
            eyebrow="Uzantılar"
            title="Belgesiz .tr uzantıları"
            description="Fiyatlar yıllıktır ve KDV hariçtir. Yenileme fiyatı ilk yıl kayıt fiyatından farklı olabilir."
            className="mb-10"
          />
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tlds.map((tld) => {
              const active = tld.ext === selectedTld;
              return (
                <li
                  key={tld.ext}
                  className={cn(
                    "flex flex-col rounded-2xl p-1.5 ring-1",
                    active ? "bg-muted ring-foreground/30" : "bg-muted/60 ring-border dark:bg-muted/30"
                  )}
                >
                  <div className="rounded-xl bg-background px-5 py-4 shadow-[0_6px_10px_-6px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
                    <h3 className="font-mono text-xl font-semibold">{tld.ext}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{tld.description}</p>
                  </div>
                  <div className="flex flex-1 flex-col px-5 pb-4 pt-5">
                    <Price amount={tld.registerPrice} period="yıl" size="md" />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Yenileme: {formatTRY(tld.renewPrice)}/yıl
                    </p>
                    <button
                      type="button"
                      onClick={() => pickTld(tld.ext)}
                      aria-label={`${tld.ext} uzantısında alan adı sorgula`}
                      className={buttonClasses({ variant: active ? "primary" : "outline", className: "mt-4 w-full" })}
                    >
                      {tld.ext} sorgula
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-6 text-xs text-muted-foreground">
            Fiyatlara KDV dahil değildir; %20 KDV ödeme adımında eklenir.
          </p>
        </Section>

        <Section divider>
          <SectionHeading
            eyebrow="Kayıt koşulları"
            title="Belge gerekmez, bilgileriniz doğru olmalı"
            description="Belgesiz uzantılar hızlı başlamak için uygundur. Kayıt yine de TRABİS kurallarına tabidir."
            className="mb-12"
          />
          <FeatureGrid items={features} columns={3} />
        </Section>

        <FaqSection
          items={faqs}
          title="Belgesiz .tr hakkında sorular"
          description="Kayıt koşulları ve süreç hakkında merak edilenler."
          tone="muted"
          divider
        />

        <CtaBand
          eyebrow="Diğer uzantılar"
          title=".com veya .com.tr mi arıyorsunuz?"
          description="Tüm uzantıların kayıt, yenileme ve transfer fiyatlarını tek listede karşılaştırın."
          primary={{ label: "Alan adı sorgula", href: "/domain/kayit" }}
          secondary={{ label: "Fiyat listesi", href: "/domain/kayit#fiyatlar" }}
        />
      </main>
      <Footer />
    </div>
  );
};

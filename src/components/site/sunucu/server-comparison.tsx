import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComparisonTable, type ComparisonRow } from "@/components/site/comparison-table";
import { Price } from "@/components/site/price";
import { Section } from "@/components/site/section";
import { SectionHeading } from "@/components/site/section-heading";
import type { FamilySummary, ServerFamilyKey } from "./server-catalog";

/** Short "who is it for" guidance; the technical bits come from the DB summary. */
function guide(s: FamilySummary): { title: string; body: string } {
  const disk = s.diskType ? `${s.diskType} disk` : "disk";
  const port = s.port ? `${s.port} port` : "";
  switch (s.key) {
    case "vps":
      return {
        title: "Ekonomik başlangıç",
        body: `Kişisel projeler, test ortamları, botlar ve küçük siteler için. ${disk}${port ? `, ${port}` : ""} ve aylık trafik kotası.`,
      };
    case "vds":
      return {
        title: "Ayrılmış kaynak",
        body: `Kaynakları size ayrılmış sanal sunucu. ${disk}${port ? ` ve ${port}` : ""} ile web uygulamaları, API'ler ve oyun sunucuları için.`,
      };
    case "bulut":
      return {
        title: "Yüksek kaynak",
        body: `Daha fazla işlemci ve bellek${s.ramType ? ` (${s.ramType})` : ""}${port ? `, ${port}` : ""}. Büyüyen e-ticaret, SaaS ve yoğun trafikli projeler için.`,
      };
    case "fiziksel":
      return {
        title: "Size özel donanım",
        body: `Sunucunun tamamı sizin${s.hasConsole ? "; IPMI/KVM ile uzaktan konsol erişimi" : ""}. Büyük veritabanları, sanallaştırma ve yüksek işlem yükü için.`,
      };
  }
}

export function ServerComparison({
  summaries,
  current,
}: {
  summaries: FamilySummary[];
  current: ServerFamilyKey;
}) {
  const families = summaries.filter((s) => s.count > 0);
  if (families.length < 2) return null;

  const rows: ComparisonRow[] = [
    {
      label: "Sunucu tipi",
      values: Object.fromEntries(
        families.map((s) => [s.key, s.key === "fiziksel" ? "Fiziksel (dedicated)" : "Sanal sunucu"])
      ),
    },
    { label: "İşlemci", values: Object.fromEntries(families.map((s) => [s.key, s.cpuModel])) },
    { label: "Çekirdek", values: Object.fromEntries(families.map((s) => [s.key, s.cpu])) },
    {
      label: "Bellek",
      values: Object.fromEntries(families.map((s) => [s.key, [s.ram, s.ramType].filter(Boolean).join(" ")])),
    },
    {
      label: "Disk",
      values: Object.fromEntries(families.map((s) => [s.key, [s.disk, s.diskType].filter(Boolean).join(" · ")])),
    },
    { label: "Port", values: Object.fromEntries(families.map((s) => [s.key, s.port])) },
    { label: "Trafik", values: Object.fromEntries(families.map((s) => [s.key, s.traffic])) },
    { label: "Root erişimi", values: Object.fromEntries(families.map((s) => [s.key, true])) },
    { label: "IPMI / KVM konsol", values: Object.fromEntries(families.map((s) => [s.key, s.hasConsole])) },
    { label: "Lokasyon", values: Object.fromEntries(families.map((s) => [s.key, "İstanbul"])) },
  ];

  return (
    <Section tone="muted" divider aria-labelledby="karsilastirma-heading">
      <SectionHeading
        id="karsilastirma-heading"
        eyebrow="Karşılaştırma"
        title="Hangisi bana uygun?"
        description="Tüm sunucu paketlerimiz İstanbul lokasyonunda barındırılır; aralarındaki farkı kaynak miktarı, disk ve port hızı ile donanımın size ayrılıp ayrılmaması belirler."
        className="mb-12"
      />

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {families.map((s) => {
          const g = guide(s);
          const isCurrent = s.key === current;
          return (
            <li
              key={s.key}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-background p-5",
                isCurrent && "ring-1 ring-foreground/30"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {s.label}
                </span>
                {isCurrent ? (
                  <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Bu sayfa
                  </span>
                ) : null}
              </div>
              <h3 className="mt-3 text-lg font-semibold tracking-tight">{g.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{g.body}</p>
              {s.startingPrice !== null ? (
                <div className="mt-5 border-t border-dashed pt-4">
                  <Price amount={s.startingPrice} period="ay" size="sm" from />
                </div>
              ) : null}
              {isCurrent ? (
                <a
                  href="#paketler"
                  className={buttonLike}
                >
                  Paketlere git
                  <ArrowRight aria-hidden className="size-4" />
                </a>
              ) : (
                <Link href={s.href} className={buttonLike}>
                  {s.label} paketleri
                  <ArrowRight aria-hidden className="size-4" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <ComparisonTable
        className="mt-10"
        caption="Sunucu türlerinin karşılaştırması"
        columns={families.map((s) => ({
          key: s.key,
          label: s.key === current ? `${s.label} (bu sayfa)` : s.label,
          footer:
            s.startingPrice !== null ? <Price amount={s.startingPrice} period="ay" size="sm" from /> : null,
        }))}
        rows={rows}
        footerLabel="Başlangıç fiyatı"
      />
      <p className="mt-4 text-xs text-muted-foreground">
        Değerler paket aralığını gösterir ve ürün kayıtlarından alınır. Fiyatlar aylık ödeme içindir, KDV hariçtir.
      </p>
    </Section>
  );
}

const buttonLike =
  "mt-4 inline-flex min-h-11 items-center gap-2 self-start rounded-md text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

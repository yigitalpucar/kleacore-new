import {
  ArrowDown,
  ArrowRight,
  Database,
  FileCode2,
  FolderOpen,
  Globe,
  HardDrive,
  Lock,
  Mail,
  PanelsTopLeft,
  RefreshCcw,
  Server,
  Users,
} from "lucide-react";
import { CornerTicks } from "@/components/site/grid-lines";
import { StatusDot } from "@/components/site/status-pill";
import { cn } from "@/lib/utils";

/* Decorative, schematic panels for the hosting pages. They show no live data. */

function PanelFrame({
  title,
  note,
  children,
  className,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("relative", className)}>
      <div className="relative overflow-hidden rounded-2xl border bg-background shadow-[0_24px_48px_-24px_rgba(0,0,0,0.25)] dark:shadow-none">
        <CornerTicks />
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </span>
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2 rounded-full bg-foreground/15" />
            <span className="size-2 rounded-full bg-foreground/15" />
            <span className="size-2 rounded-full bg-foreground/15" />
          </span>
        </div>
        {children}
      </div>
      {note ? <figcaption className="mt-3 text-xs text-muted-foreground">{note}</figcaption> : null}
    </figure>
  );
}

/* ---------------------------------------------------------------- Linux */

const CPANEL_TOOLS = [
  { icon: FolderOpen, label: "Dosya Yöneticisi" },
  { icon: Mail, label: "E-posta Hesapları" },
  { icon: Database, label: "MySQL Veritabanları" },
  { icon: Globe, label: "Alt Alan Adları" },
  { icon: Lock, label: "SSL/TLS" },
  { icon: HardDrive, label: "Yedekleme" },
];

/** Schematic of the cPanel tools a Linux hosting customer uses daily. */
export function CpanelPanel({ className }: { className?: string }) {
  return (
    <PanelFrame
      title="cpanel / araçlar"
      note="Temsili görünüm — cPanel arayüzü sürüme göre farklılık gösterebilir."
      className={className}
    >
      <ul className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
        {CPANEL_TOOLS.map((tool) => (
          <li key={tool.label} className="flex flex-col gap-3 bg-background p-4 sm:p-5">
            <span className="flex size-9 items-center justify-center rounded-md border bg-muted/40">
              <tool.icon aria-hidden className="size-4 text-foreground/80" />
            </span>
            <span className="text-sm font-medium leading-tight">{tool.label}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t px-5 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <StatusDot pulse={false} />
          LiteSpeed web sunucu
        </span>
        <span className="font-mono">Let&apos;s Encrypt SSL</span>
      </div>
    </PanelFrame>
  );
}

/* ------------------------------------------------------------ WordPress */

/** Staging workflow: live site -> staging copy -> test -> publish. */
export function WpStagingPanel({ className }: { className?: string }) {
  return (
    <PanelFrame
      title="wp staging / akış"
      note="Temsili akış — staging kopyası canlı siteyi etkilemeden test yapmanızı sağlar."
      className={className}
    >
      <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:p-6">
        <SiteCard label="Canlı site" host="ornek.com" live />
        <div className="flex items-center justify-center text-muted-foreground">
          <span className="flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 font-mono text-[10px] uppercase tracking-wider">
            <RefreshCcw aria-hidden className="size-3" />
            kopyala
          </span>
        </div>
        <SiteCard label="Staging" host="staging.ornek.com" />
      </div>
      <ol className="divide-y divide-dashed border-t text-sm">
        {[
          "Tema ve eklenti güncellemesini staging kopyasında deneyin",
          "LiteSpeed Cache ayarlarını test edin, sayfaları kontrol edin",
          "Sorun yoksa değişiklikleri canlı siteye aktarın",
        ].map((item, index) => (
          <li key={item} className="flex items-start gap-3 px-5 py-3">
            <span className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-foreground/90">{item}</span>
          </li>
        ))}
      </ol>
    </PanelFrame>
  );
}

function SiteCard({ label, host, live = false }: { label: string; host: string; live?: boolean }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {live ? <StatusDot pulse={false} /> : <span aria-hidden className="size-2 rounded-full bg-foreground/25" />}
      </div>
      <div className="mt-3 space-y-1.5 rounded-lg border bg-background p-2.5" aria-hidden>
        <span className="block h-1.5 w-2/3 rounded-full bg-foreground/20" />
        <span className="block h-1.5 w-full rounded-full bg-foreground/10" />
        <span className="block h-1.5 w-5/6 rounded-full bg-foreground/10" />
        <span className="mt-2 block h-6 w-full rounded bg-foreground/5" />
      </div>
      <p className="mt-2 truncate font-mono text-xs text-foreground/80">{host}</p>
    </div>
  );
}

/* ------------------------------------------------------------- Reseller */

/** KLEACORE infrastructure -> your WHM -> your customers' cPanel accounts. */
export function ResellerTree({ className }: { className?: string }) {
  return (
    <PanelFrame
      title="reseller / yapı"
      note="Temsili şema — hesap sayısı ve kaynaklar seçtiğiniz pakete göre belirlenir."
      className={className}
    >
      <div className="flex flex-col items-center gap-3 p-5 sm:p-6">
        <TreeNode icon={Server} title="KLEACORE altyapısı" detail="Sunucu, ağ ve yedekleme" />
        <ArrowDown aria-hidden className="size-4 text-muted-foreground" />
        <TreeNode
          icon={PanelsTopLeft}
          title="WHM — bayi paneliniz"
          detail="Paket tanımlama, hesap açma, DNS"
          strong
        />
        <ArrowDown aria-hidden className="size-4 text-muted-foreground" />
        <div className="grid w-full grid-cols-3 gap-2">
          {["musteri-a.com", "musteri-b.com", "musteri-c.com"].map((domain) => (
            <div key={domain} className="min-w-0 rounded-lg border bg-muted/30 p-2.5 text-center">
              <Users aria-hidden className="mx-auto size-4 text-foreground/70" />
              <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                cPanel
              </p>
              <p className="truncate text-xs text-foreground/80">{domain}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t px-5 py-3 text-xs text-muted-foreground">
        <FileCode2 aria-hidden className="size-3.5" />
        White label: müşterileriniz hizmeti sizin markanızla görür.
      </div>
    </PanelFrame>
  );
}

function TreeNode({
  icon: Icon,
  title,
  detail,
  strong = false,
}: {
  icon: typeof Server;
  title: string;
  detail: string;
  strong?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex w-full max-w-sm items-center gap-3 rounded-xl border p-3",
        strong ? "dark bg-neutral-950 text-foreground dark:bg-neutral-900" : "bg-muted/30"
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-background">
        <Icon aria-hidden className="size-4 text-foreground/80" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
    </div>
  );
}

/* -------------------------------------------------------------- Kurumsal */

/** Business essentials checklist panel. */
export function BusinessPanel({ className }: { className?: string }) {
  const rows = [
    { icon: Mail, label: "Kurumsal e-posta", value: "ad@firmaniz.com" },
    { icon: Lock, label: "Wildcard SSL", value: "*.firmaniz.com" },
    { icon: HardDrive, label: "Otomatik yedek", value: "Günlük" },
    { icon: Server, label: "CPU / RAM", value: "Pakete göre" },
  ];
  return (
    <PanelFrame title="firmaniz.com / hizmetler" className={className}>
      <ul className="divide-y divide-dashed">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-4 px-5 py-4">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                <row.icon aria-hidden className="size-4 text-foreground/80" />
              </span>
              <span className="text-sm font-medium">{row.label}</span>
            </span>
            <span className="flex items-center gap-2 truncate font-mono text-xs text-muted-foreground">
              {row.value}
              <ArrowRight aria-hidden className="hidden size-3 sm:block" />
            </span>
          </li>
        ))}
      </ul>
    </PanelFrame>
  );
}

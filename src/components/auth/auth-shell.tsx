import { Check } from "lucide-react";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Container, CornerTicks, Eyebrow, GridBackground, GridLineHorizontal } from "@/components/site";
import { cn } from "@/lib/utils";

/**
 * Split auth layout (shadcnblocks login / signup / verify-email "split"
 * pattern) on the public-site kit: an always-dark branding column with
 * factual account benefits, and the form column carrying the page's <h1>.
 */
export function AuthShell({
  eyebrow,
  title,
  description,
  aside,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  /** Branding column content; defaults to the customer-panel benefits. */
  aside?: AuthAside;
  children: React.ReactNode;
  /** Small print under the form (links to support etc.). */
  footer?: React.ReactNode;
}) {
  const side = aside ?? defaultAside;

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main id="main" className="relative flex-1 overflow-x-clip bg-background">
        <GridBackground />
        <Container className="relative py-10 md:py-16 lg:py-20">
          <div className="relative mx-auto grid max-w-5xl overflow-hidden rounded-xl border bg-background shadow-sm lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <CornerTicks />
            <AuthAsidePanel {...side} />
            <div className="flex flex-col justify-center px-5 py-8 sm:px-10 sm:py-12 lg:px-14">
              <div className="mx-auto w-full max-w-sm">
                <Eyebrow>{eyebrow}</Eyebrow>
                <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
                {description ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
                ) : null}
                <div className="mt-8">{children}</div>
                {footer ? (
                  <div className="mt-8 border-t border-dashed pt-6 text-sm text-muted-foreground">
                    {footer}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}

export interface AuthAside {
  label: string;
  heading: string;
  text: string;
  points: string[];
}

const defaultAside: AuthAside = {
  label: "Müşteri paneli",
  heading: "Tüm hizmetleriniz tek panelde.",
  text: "Hosting, sunucu, alan adı ve SSL hizmetlerinizi; faturalarınızı ve destek taleplerinizi aynı yerden yönetin.",
  points: [
    "Hizmet, alan adı ve SSL yönetimi",
    "Fatura geçmişi ve online ödeme",
    "7/24 destek talebi",
    "İki faktörlü doğrulama (2FA) desteği",
  ],
};

function AuthAsidePanel({ label, heading, text, points }: AuthAside) {
  return (
    <aside className="dark relative hidden overflow-hidden border-r bg-neutral-950 dark:bg-neutral-900 px-10 py-12 text-foreground lg:flex lg:flex-col lg:justify-center">
      <GridBackground mask="center" className="opacity-60" />
      <div className="relative">
        <Eyebrow>{label}</Eyebrow>
        <p className="mt-4 text-2xl font-semibold leading-snug tracking-tight">{heading}</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text}</p>
      </div>
      <div className="relative mt-10">
        <GridLineHorizontal className="top-0" />
        <ul className="space-y-3 pt-6">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-sm">
              <span
                aria-hidden
                className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-sm border border-white/15 bg-white/5"
              >
                <Check className="size-3" />
              </span>
              <span className="text-foreground/90">{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/** Inline error/notice box used by the auth forms. */
export function AuthAlert({
  children,
  tone = "error",
  className,
}: {
  children: React.ReactNode;
  tone?: "error" | "info";
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-md border px-3 py-2.5 text-sm",
        tone === "error"
          ? "border-destructive/40 bg-destructive/5 text-destructive dark:border-destructive/50 dark:bg-destructive/10 dark:text-red-300"
          : "border-border bg-muted/50 text-foreground",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Shared field styles: 44px inputs with an optional leading icon. */
export const authInputClass = "h-11 bg-background";
export const authIconClass =
  "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground";

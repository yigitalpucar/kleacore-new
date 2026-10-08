"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Clock,
  CreditCard,
  FileCheck,
  Globe,
  HardDrive,
  Key,
  Mail,
  Plug,
  Server,
  Shield,
  Smartphone,
  Users,
  Webhook,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton, IconTile, StatusBadge, type StatusTone } from "@/components/app";
import { cn } from "@/lib/utils";
import type { IntegrationModule } from "@/lib/integrations/module-status";

/* ------------------------------------------------------------------ */
/* Control styles                                                      */
/* ------------------------------------------------------------------ */

/** Native <select> styled like the kit's inputs (44px on phones, 36px on md+). */
export const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 md:h-9";

/** Extra classes for `components/ui/input` so it matches the dense app size. */
export const inputClass = "h-11 shadow-sm md:h-9";

/** Two-column field grid inside a FormSection card. */
export function FieldGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-5 md:grid-cols-2", className)}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Switch row that posts "true"/"false" through a hidden input         */
/* ------------------------------------------------------------------ */

export function ToggleRow({
  title,
  description,
  fieldName,
  defaultChecked,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  fieldName: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/30 px-3 py-3 md:px-4">
      <div className="min-w-0 space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {title}
        </label>
        {description ? (
          <p id={`${id}-desc`} className="text-xs text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={setChecked}
        aria-describedby={description ? `${id}-desc` : undefined}
      />
      <input type="hidden" name={fieldName} value={checked ? "true" : "false"} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Read-only URL / code value with copy                                */
/* ------------------------------------------------------------------ */

export function CodeValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1 rounded-md border border-dashed bg-muted/30 py-1 pl-3 pr-1">
        <code className="min-w-0 flex-1 break-all font-mono text-xs">{value}</code>
        <CopyButton value={value} label={`${label} kopyala`} />
      </div>
    </div>
  );
}

/** Environment variable presence row (never shows the value). */
export function EnvRow({ name, description, configured }: { name: string; description: string; configured: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 md:px-5">
      <div className="min-w-0">
        <p className="break-all font-mono text-[13px] font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <StatusBadge tone={configured ? "success" : "warning"} label={configured ? "Tanımlı" : "Eksik"} />
    </li>
  );
}

/** Dashed info note inside a form card. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Module metadata                                                     */
/* ------------------------------------------------------------------ */

export const categoryLabels: Record<IntegrationModule["category"], string> = {
  domain: "Domain",
  hosting: "Hosting",
  payment: "Ödeme",
  communication: "İletişim",
  automation: "Otomasyon",
  api: "API",
  marketing: "Pazarlama",
};

export const moduleIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  registrar: Globe,
  "cpanel-whm": Server,
  "vps-vds": HardDrive,
  provisioning: Server,
  stripe: CreditCard,
  iyzico: CreditCard,
  paytr: CreditCard,
  smtp: Mail,
  sms: Smartphone,
  webhooks: Webhook,
  "public-api": Key,
  cron: Clock,
  affiliate: Users,
  efatura: FileCheck,
  ssl: Shield,
};

const moduleStatusMeta: Record<IntegrationModule["status"], { label: string; tone: StatusTone }> = {
  active: { label: "Aktif", tone: "success" },
  builtin: { label: "Dahili", tone: "info" },
  inactive: { label: "Pasif", tone: "muted" },
  warning: { label: "Uyarı", tone: "warning" },
  error: { label: "Hata", tone: "danger" },
};

export function ModuleStatusBadge({ status }: { status: IntegrationModule["status"] }) {
  const meta = moduleStatusMeta[status] ?? { label: status, tone: "neutral" as StatusTone };
  return <StatusBadge tone={meta.tone} label={meta.label} />;
}

/** One module row (settings-integrations2 list pattern). Links to its tab when `href` is set. */
export function ModuleRow({ module, href }: { module: IntegrationModule; href?: string }) {
  const Icon = moduleIcons[module.id] ?? Plug;
  const body = (
    <>
      <IconTile>
        <Icon />
      </IconTile>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-medium">{module.name}</p>
          <span className="font-mono text-[11px] text-muted-foreground">
            {categoryLabels[module.category]}
            {module.provider && !["disabled", "builtin"].includes(module.provider) ? ` · ${module.provider}` : ""}
          </span>
        </div>
        <p className="text-[13px] text-muted-foreground">{module.description}</p>
        {module.message ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">{module.message}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
        <ModuleStatusBadge status={module.status} />
        {href ? (
          <ArrowUpRight
            aria-hidden
            className="hidden size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground sm:block"
          />
        ) : null}
      </div>
    </>
  );

  return (
    <li className="border-t first:border-t-0">
      {href ? (
        <Link
          href={href}
          className="group flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:flex-row sm:items-center sm:gap-4 md:px-5"
        >
          {body}
        </Link>
      ) : (
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 md:px-5">{body}</div>
      )}
    </li>
  );
}

/** Status strip at the top of an integration tab (modules that belong to it). */
export function TabModuleStatus({ modules }: { modules: IntegrationModule[] }) {
  if (modules.length === 0) return null;
  return (
    <ul aria-label="Modül durumu" className="overflow-hidden rounded-lg border bg-card shadow-sm">
      {modules.map((m) => (
        <ModuleRow key={m.id} module={m} />
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Underline tab bar (scrolls inside its own row on phones)            */
/* ------------------------------------------------------------------ */

export function SettingsTabBar({
  items,
  label,
}: {
  items: { value: string; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  label: string;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      <TabsList
        aria-label={label}
        className="h-auto w-max min-w-full justify-start gap-1 rounded-none border-b bg-transparent p-0"
      >
        {items.map(({ value, label: itemLabel, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="-mb-px h-11 gap-2 rounded-none border-b-2 border-transparent px-3 text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none md:h-10"
          >
            {Icon ? <Icon aria-hidden className="size-4" /> : null}
            {itemLabel}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}

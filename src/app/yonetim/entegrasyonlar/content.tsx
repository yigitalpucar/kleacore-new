"use client";

import { Activity } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { PageHeader, StatCard, StatGrid } from "@/components/app";
import { formatDateTime } from "@/lib/format/date";
import { ApiSection } from "@/components/admin-b/integrations/api-section";
import { CpanelSection } from "@/components/admin-b/integrations/cpanel-section";
import { CronSection } from "@/components/admin-b/integrations/cron-section";
import { EfaturaSection } from "@/components/admin-b/integrations/efatura-section";
import { EmailSection } from "@/components/admin-b/integrations/email-section";
import { OverviewSection } from "@/components/admin-b/integrations/overview-section";
import { PaymentSection } from "@/components/admin-b/integrations/payment-section";
import { RegistrarSection } from "@/components/admin-b/integrations/registrar-section";
import { SmsSection } from "@/components/admin-b/integrations/sms-section";
import { SslSection } from "@/components/admin-b/integrations/ssl-section";
import { VpsVdsSection } from "@/components/admin-b/integrations/vps-vds-section";
import { WebhooksSection } from "@/components/admin-b/integrations/webhooks-section";
import { SettingsTabBar, TabModuleStatus } from "@/components/admin-b/integrations/shared";
import type {
  ApiKeyItem,
  CpanelConfig,
  CronJobItem,
  EfaturaConfig,
  EnvFlags,
  IntegrationOverview,
  PaymentGatewayConfig,
  RegistrarConfig,
  SmsConfig,
  SmtpConfig,
  SslConfig,
  VpsVdsConfig,
  WebhooksConfig,
} from "@/components/admin-b/integrations/types";
import { IntegrationsFeedbackToast } from "./integrations-feedback-toast";

interface EntegrasyonlarContentProps {
  defaultTab: string;
  toastStatus?: string;
  toastMessage?: string;
  overview: IntegrationOverview;
  cronJobs: CronJobItem[];
  apiKeys: ApiKeyItem[];
  registrar: RegistrarConfig;
  cpanel: CpanelConfig;
  vpsVds: VpsVdsConfig;
  smtp: SmtpConfig;
  sms: SmsConfig;
  webhooks: WebhooksConfig;
  paymentGateway: PaymentGatewayConfig;
  efatura: EfaturaConfig;
  ssl: SslConfig;
  env: EnvFlags;
}

const TABS = [
  { value: "overview", label: "Genel bakış" },
  { value: "registrar", label: "Registrar" },
  { value: "cpanel", label: "cPanel/WHM" },
  { value: "vps-vds", label: "VPS/VDS" },
  { value: "payment", label: "Ödeme" },
  { value: "efatura", label: "E-Fatura" },
  { value: "ssl", label: "SSL" },
  { value: "email", label: "E-posta" },
  { value: "sms", label: "SMS" },
  { value: "webhooks", label: "Webhook" },
  { value: "api", label: "Public API" },
  { value: "cron", label: "Cron" },
];

export function EntegrasyonlarContent({
  defaultTab,
  toastStatus,
  toastMessage,
  overview,
  cronJobs,
  apiKeys,
  registrar,
  cpanel,
  vpsVds,
  smtp,
  sms,
  webhooks,
  paymentGateway,
  efatura,
  ssl,
  env,
}: EntegrasyonlarContentProps) {
  const { summary } = overview;
  const problems = summary.error + summary.warning;
  const modulesFor = (tab: string) => overview.modules.filter((m) => m.tab === tab);

  const panel = (value: string, children: React.ReactNode) => (
    <TabsContent key={value} value={value} className="mt-6 space-y-8 focus-visible:ring-offset-0">
      {value !== "overview" ? <TabModuleStatus modules={modulesFor(value)} /> : null}
      {children}
    </TabsContent>
  );

  return (
    <>
      <IntegrationsFeedbackToast status={toastStatus} message={toastMessage} activeTab={defaultTab} />

      <PageHeader
        title="Entegrasyonlar ve modüller"
        description="Harici servisleri ve sistem modüllerini tek yerden yönetin."
        meta={
          <span className="inline-flex items-center gap-1.5">
            <Activity aria-hidden className="size-4" />
            Son kontrol: <time dateTime={overview.checkedAt}>{formatDateTime(overview.checkedAt)}</time>
          </span>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Toplam modül" value={summary.total} />
        <StatCard label="Aktif" value={summary.active} tone={summary.active ? "success" : undefined} hint="Yapılandırılmış ve çalışıyor" />
        <StatCard label="Pasif" value={summary.inactive} hint="Kapalı veya yapılandırılmamış" />
        <StatCard
          label="Sorunlu"
          value={problems}
          tone={summary.error ? "danger" : problems ? "warning" : undefined}
          hint={problems ? `${summary.error} hata · ${summary.warning} uyarı` : "Sorun yok"}
        />
      </StatGrid>

      <Tabs key={defaultTab} defaultValue={defaultTab} className="w-full">
        <SettingsTabBar items={TABS} label="Entegrasyon bölümleri" />

        {panel("overview", <OverviewSection modules={overview.modules} />)}
        {panel("registrar", <RegistrarSection registrar={registrar} />)}
        {panel("cpanel", <CpanelSection cpanel={cpanel} />)}
        {panel("vps-vds", <VpsVdsSection vpsVds={vpsVds} />)}
        {panel("payment", <PaymentSection paymentGateway={paymentGateway} env={env} />)}
        {panel("efatura", <EfaturaSection efatura={efatura} />)}
        {panel("ssl", <SslSection ssl={ssl} />)}
        {panel("email", <EmailSection smtp={smtp} />)}
        {panel("sms", <SmsSection sms={sms} />)}
        {panel("webhooks", <WebhooksSection webhooks={webhooks} />)}
        {panel("api", <ApiSection apiKeys={apiKeys} env={env} />)}
        {panel("cron", <CronSection cronJobs={cronJobs} env={env} />)}
      </Tabs>
    </>
  );
}

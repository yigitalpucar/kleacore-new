"use client";

import { HardDrive, Network, Power, RefreshCcw, Shield, Terminal, Wrench } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  AppBreadcrumbLabel,
  DetailList,
  PageHeader,
  SectionCard,
  StatusBadge,
  UnavailableAction,
  UsageMeter,
} from "@/components/app";
import { formatDateTime } from "@/lib/format/date";
import { getServerStatus, serverStatusMeta } from "@/components/admin-b/sunucular/server-status";

interface ServerData {
  id: string;
  name: string;
  hostname: string;
  ipAddress: string;
  location: string;
  provider: string;
  cpuModel: string | null;
  cpuCores: number;
  ramTotal: number;
  diskTotal: number;
  cpuUsage: number;
  ramUsage: number;
  diskUsage: number;
  isActive: boolean;
  isOnline: boolean;
  uptime: number;
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ServerDetailContentProps {
  server: ServerData;
}

const num = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 2 });

export function ServerDetailContent({ server }: ServerDetailContentProps) {
  const status = getServerStatus(server);
  const liveUsage = status === "online" || status === "warning";

  return (
    <TooltipProvider delayDuration={200}>
      <AppBreadcrumbLabel segment={server.id} label={server.name} />
      <PageHeader
        back={{ href: "/yonetim/sunucular", label: "Sunuculara dön" }}
        eyebrow="Sunucu"
        title={server.name}
        description={`${server.hostname} · ${server.location} · ${server.provider}`}
        meta={
          <>
            <StatusBadge size="md" {...serverStatusMeta[status]} />
            {server.lastCheckedAt ? <span>Son kontrol: {formatDateTime(server.lastCheckedAt)}</span> : null}
          </>
        }
        actions={
          <>
            <UnavailableAction label="SSH konsol" icon={<Terminal aria-hidden />} />
            <UnavailableAction label="Yeniden başlat" icon={<RefreshCcw aria-hidden />} />
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <SectionCard
            title="Kaynak kullanımı"
            description={liveUsage ? "Son ölçümdeki kullanım oranları" : "Sunucu çevrimdışı veya bakımda; CPU ve RAM ölçümü gösterilmiyor."}
          >
            <div className="space-y-5">
              {liveUsage ? (
                <>
                  <UsageMeter label={`CPU · ${server.cpuCores} çekirdek`} percent={server.cpuUsage} />
                  <UsageMeter label={`RAM · ${num(server.ramTotal)} GB`} percent={server.ramUsage} />
                </>
              ) : null}
              <UsageMeter label={`Disk · ${num(server.diskTotal)} GB`} percent={server.diskUsage} />
            </div>
          </SectionCard>

          <SectionCard title="Sunucu özeti">
            <DetailList
              layout="grid"
              columns={2}
              items={[
                { label: "Uptime", value: `%${num(server.uptime)}` },
                { label: "CPU çekirdek", value: num(server.cpuCores) },
                { label: "Toplam RAM", value: `${num(server.ramTotal)} GB` },
                { label: "Toplam disk", value: `${num(server.diskTotal)} GB` },
              ]}
            />
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-6">
          <SectionCard title="Sunucu bilgileri">
            <DetailList
              items={[
                { label: "IP adresi", value: server.ipAddress, mono: true, copy: server.ipAddress },
                { label: "Hostname", value: server.hostname, copy: server.hostname },
                { label: "Konum", value: server.location },
                { label: "Sağlayıcı", value: server.provider },
                { label: "İşlemci", value: server.cpuModel },
                { label: "Eklenme", value: formatDateTime(server.createdAt) },
              ]}
            />
          </SectionCard>

          <SectionCard title="İşlemler" description="Uzaktan yönetim henüz bağlı değil.">
            <div className="grid gap-2">
              <UnavailableAction label="Bakım modu" icon={<Wrench aria-hidden />} className="w-full justify-start" />
              <UnavailableAction label="Güvenlik taraması" icon={<Shield aria-hidden />} className="w-full justify-start" />
              <UnavailableAction label="Ağ testi" icon={<Network aria-hidden />} className="w-full justify-start" />
              <UnavailableAction label="Yedek al" icon={<HardDrive aria-hidden />} className="w-full justify-start" />
              <UnavailableAction label="Kapat" icon={<Power aria-hidden />} className="w-full justify-start" />
            </div>
          </SectionCard>
        </div>
      </div>
    </TooltipProvider>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Server,
  Cpu,
  MemoryStick,
  HardDrive,
  Activity,
  RefreshCcw,
  Wrench,
  Power,
  Globe,
  CheckCircle,
  Copy,
  Check,
  Settings,
  Terminal,
  Shield,
  Network,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/magicui/blur-fade";

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

type ServerStatus = "online" | "warning" | "maintenance" | "offline";

const getServerStatus = (server: ServerData): ServerStatus => {
  if (!server.isActive) return "maintenance";
  if (!server.isOnline) return "offline";
  if (server.cpuUsage >= 90 || server.ramUsage >= 90) return "warning";
  return "online";
};

const statusConfig: Record<ServerStatus, { label: string; color: string }> = {
  online: { label: "Cevrimici", color: "bg-green-500/10 text-green-500 border-green-500/30" },
  warning: { label: "Uyari", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30" },
  maintenance: { label: "Bakimda", color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  offline: { label: "Cevrimdisi", color: "bg-red-500/10 text-red-500 border-red-500/30" },
};

const getUsageColor = (percent: number) => {
  if (percent >= 90) return "bg-red-500";
  if (percent >= 70) return "bg-yellow-500";
  return "bg-green-500";
};

const getUsageTextColor = (percent: number) => {
  if (percent >= 90) return "text-red-500";
  if (percent >= 70) return "text-yellow-500";
  return "text-green-500";
};

export function ServerDetailContent({ server }: ServerDetailContentProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const status = getServerStatus(server);
  const statusInfo = statusConfig[status];

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const usageStats = [
    { label: "CPU", value: server.cpuUsage, icon: Cpu },
    { label: "RAM", value: server.ramUsage, icon: MemoryStick },
    { label: "Disk", value: server.diskUsage, icon: HardDrive },
  ];

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <BlurFade delay={0}>
        <Link
          href="/yonetim/sunucular"
          className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Sunuculara Don
        </Link>
      </BlurFade>

      {/* Header */}
      <BlurFade delay={0.05}>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
              <Server className="h-7 w-7 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{server.name}</h1>
                <Badge className={cn("border", statusInfo.color)}>
                  {statusInfo.label}
                </Badge>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400">{server.hostname}</p>
              <p className="text-sm text-zinc-500 mt-1">{server.location} - {server.provider}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Terminal className="mr-2 h-4 w-4" />
              SSH Konsol
            </Button>
            <Button variant="outline" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Yeniden Baslat
            </Button>
            <Button variant="outline" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <Wrench className="mr-2 h-4 w-4" />
              Bakim Modu
            </Button>
            <Button variant="outline" className="border-red-500/30 text-red-500 hover:bg-red-500/10">
              <Power className="mr-2 h-4 w-4" />
              Kapat
            </Button>
          </div>
        </div>
      </BlurFade>

      {/* Usage Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {usageStats.map((stat, index) => (
          <BlurFade key={stat.label} delay={0.1 + index * 0.05}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      <stat.icon className="h-4 w-4 text-zinc-500" />
                    </div>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">{stat.label}</span>
                  </div>
                  <span className={cn("text-lg font-bold", getUsageTextColor(stat.value))}>
                    {stat.value}%
                  </span>
                </div>
                <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", getUsageColor(stat.value))}
                    style={{ width: `${stat.value}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </BlurFade>
        ))}
      </div>

      {/* Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <BlurFade delay={0.3}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base">Sunucu Ozeti</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <p className="text-2xl font-bold text-green-500">{server.uptime}%</p>
                    <p className="text-xs text-zinc-500">Uptime</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">{server.cpuCores}</p>
                    <p className="text-xs text-zinc-500">CPU Cekirdek</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">{server.ramTotal} GB</p>
                    <p className="text-xs text-zinc-500">Toplam RAM</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                    <p className="text-2xl font-bold text-zinc-900 dark:text-white">{server.diskTotal} GB</p>
                    <p className="text-xs text-zinc-500">Toplam Disk</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </BlurFade>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Server Info */}
          <BlurFade delay={0.35}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Sunucu Bilgileri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">IP Adresi</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-zinc-900 dark:text-white">{server.ipAddress}</span>
                    <button
                      onClick={() => copyToClipboard(server.ipAddress, "ip")}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      {copiedField === "ip" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Hostname</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-900 dark:text-white">{server.hostname}</span>
                    <button
                      onClick={() => copyToClipboard(server.hostname, "hostname")}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      {copiedField === "hostname" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {server.cpuModel && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-500">Islemci</span>
                    <span className="text-sm text-zinc-900 dark:text-white text-right max-w-[200px] truncate" title={server.cpuModel}>
                      {server.cpuModel}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Uptime</span>
                  <span className="text-sm font-medium text-green-500">{server.uptime}%</span>
                </div>
                {server.lastCheckedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-500">Son Kontrol</span>
                    <span className="text-sm text-zinc-900 dark:text-white">
                      {new Date(server.lastCheckedAt).toLocaleDateString("tr-TR")} {new Date(server.lastCheckedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </BlurFade>

          {/* Hardware Specs */}
          <BlurFade delay={0.4}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Donanim
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {server.cpuModel && (
                  <div>
                    <span className="text-xs text-zinc-500">Islemci</span>
                    <p className="text-sm text-zinc-900 dark:text-white">{server.cpuModel}</p>
                    <p className="text-xs text-zinc-500">{server.cpuCores} Cekirdek</p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-zinc-500">Bellek</span>
                  <p className="text-sm text-zinc-900 dark:text-white">{server.ramTotal} GB</p>
                </div>
                <div>
                  <span className="text-xs text-zinc-500">Depolama</span>
                  <p className="text-sm text-zinc-900 dark:text-white">{server.diskTotal} GB</p>
                </div>
              </CardContent>
            </Card>
          </BlurFade>

          {/* Quick Actions */}
          <BlurFade delay={0.45}>
            <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              <CardHeader>
                <CardTitle className="text-zinc-900 dark:text-white text-base">Hızlı İşlemler</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <Shield className="mr-2 h-4 w-4" />
                  Güvenlik Taraması
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <Network className="mr-2 h-4 w-4" />
                  Ağ Testi
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <HardDrive className="mr-2 h-4 w-4" />
                  Yedek Al
                </Button>
              </CardContent>
            </Card>
          </BlurFade>
        </div>
      </div>
    </div>
  );
}

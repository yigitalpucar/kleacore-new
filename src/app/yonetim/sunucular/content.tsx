"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Server,
  Cpu,
  MemoryStick,
  HardDrive,
  Activity,
  CheckCircle,
  AlertTriangle,
  Wrench,
  MoreVertical,
  RefreshCcw,
  Power,
  Eye,
  Globe,
  Plus,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface SunucularContentProps {
  servers: ServerData[];
}

type ServerStatus = "online" | "warning" | "maintenance" | "offline";

const getServerStatus = (server: ServerData): ServerStatus => {
  if (!server.isActive) return "maintenance";
  if (!server.isOnline) return "offline";
  if (server.cpuUsage >= 90 || server.ramUsage >= 90) return "warning";
  return "online";
};

const statusConfig: Record<ServerStatus, { label: string; color: string; bgColor: string; icon: typeof CheckCircle }> = {
  online: { label: "Çevrimiçi", color: "text-green-600 dark:text-green-500", bgColor: "bg-green-500", icon: CheckCircle },
  warning: { label: "Uyarı", color: "text-yellow-600 dark:text-yellow-500", bgColor: "bg-yellow-500", icon: AlertTriangle },
  maintenance: { label: "Bakımda", color: "text-blue-600 dark:text-blue-500", bgColor: "bg-blue-500", icon: Wrench },
  offline: { label: "Çevrimdışı", color: "text-red-600 dark:text-red-500", bgColor: "bg-red-500", icon: Power },
};

const statusButtons: { value: string; label: string; icon: typeof Server }[] = [
  { value: "all", label: "Tümü", icon: Server },
  { value: "online", label: "Çevrimiçi", icon: CheckCircle },
  { value: "warning", label: "Uyarı", icon: AlertTriangle },
  { value: "maintenance", label: "Bakımda", icon: Wrench },
  { value: "offline", label: "Çevrimdışı", icon: Power },
];

const getUsageColor = (percent: number) => {
  if (percent >= 90) return "bg-red-500";
  if (percent >= 70) return "bg-yellow-500";
  return "bg-green-500";
};

const getUsageBadgeColor = (percent: number) => {
  if (percent >= 90) return "bg-red-500/10 text-red-600 dark:text-red-500";
  if (percent >= 70) return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500";
  return "bg-green-500/10 text-green-600 dark:text-green-500";
};

export function SunucularContent({ servers }: SunucularContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const serversWithStatus = servers.map((s) => ({
    ...s,
    status: getServerStatus(s),
  }));

  const filteredServers = serversWithStatus.filter((server) => {
    const matchesSearch =
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.ipAddress.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || server.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const onlineCount = serversWithStatus.filter((s) => s.status === "online").length;
  const warningCount = serversWithStatus.filter((s) => s.status === "warning").length;
  const avgUptime = servers.length > 0
    ? (servers.reduce((sum, s) => sum + s.uptime, 0) / servers.length).toFixed(2)
    : "0";

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Sunucular</h1>
            <p className="text-zinc-600 dark:text-zinc-400">Sunucu durumlarını izleyin ve yönetin</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10">
              <Server className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-primary">{servers.length} Sunucu</span>
            </div>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Sunucu Ekle
            </Button>
          </div>
        </div>
      </BlurFade>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <BlurFade delay={0.05}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Server className="h-5 w-5 text-zinc-500" />
                <span className="text-xs text-zinc-500">Toplam</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{servers.length}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Toplam Sunucu</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.1}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-xs text-green-500">
                  %{servers.length > 0 ? ((onlineCount / servers.length) * 100).toFixed(0) : 0}
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{onlineCount}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Çevrimiçi</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.15}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="text-xs text-yellow-500">Dikkat</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{warningCount}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Uyarı</p>
            </CardContent>
          </Card>
        </BlurFade>
        <BlurFade delay={0.2}>
          <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Activity className="h-5 w-5 text-blue-500" />
                <span className="text-xs text-blue-500">Son 30 gün</span>
              </div>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">{avgUptime}%</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Ort. Uptime</p>
            </CardContent>
          </Card>
        </BlurFade>
      </div>

      {/* Status Filters */}
      <BlurFade delay={0.25}>
        <div className="flex flex-wrap gap-2">
          {statusButtons.map((btn) => {
            const isActive = statusFilter === btn.value;
            const count = btn.value === "all"
              ? servers.length
              : serversWithStatus.filter((s) => s.status === btn.value).length;

            return (
              <Button
                key={btn.value}
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(btn.value)}
                className={cn(
                  isActive
                    ? "bg-primary hover:bg-primary/90"
                    : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white"
                )}
              >
                <btn.icon className="mr-1.5 h-3.5 w-3.5" />
                {btn.label}
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-2",
                    isActive
                      ? "bg-white dark:bg-zinc-900 text-primary"
                      : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  )}
                >
                  {count}
                </Badge>
              </Button>
            );
          })}
        </div>
      </BlurFade>

      {/* Search */}
      <BlurFade delay={0.3}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                type="search"
                placeholder="Sunucu adı, hostname veya IP ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder:text-zinc-500"
              />
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Servers Table */}
      <BlurFade delay={0.35}>
        <Card className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Sunucu</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">IP / Konum</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Durum</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">CPU</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">RAM</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Disk</th>
                    <th className="text-left p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">Uptime</th>
                    <th className="text-right p-4 text-sm font-medium text-zinc-600 dark:text-zinc-400">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServers.map((server) => {
                    const status = statusConfig[server.status];
                    const StatusIcon = status.icon;

                    return (
                      <tr
                        key={server.id}
                        className={cn(
                          "border-b border-zinc-200 dark:border-zinc-800 last:border-0 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors",
                          server.status === "offline" && "opacity-60"
                        )}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                              <Server className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <Link
                                href={`/yonetim/sunucular/${server.id}`}
                                className="text-sm font-medium text-zinc-900 dark:text-white hover:text-primary"
                              >
                                {server.name}
                              </Link>
                              <p className="text-xs text-zinc-500">{server.hostname}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div>
                            <code className="text-sm text-zinc-900 dark:text-white font-mono">
                              {server.ipAddress}
                            </code>
                            <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                              <Globe className="h-3 w-3" />
                              {server.location}
                            </p>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge
                            className={cn(
                              "gap-1",
                              server.status === "online" && "bg-green-500/10 text-green-600 dark:text-green-500",
                              server.status === "warning" && "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500",
                              server.status === "maintenance" && "bg-blue-500/10 text-blue-600 dark:text-blue-500",
                              server.status === "offline" && "bg-red-500/10 text-red-600 dark:text-red-500"
                            )}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </td>
                        <td className="p-4">
                          {server.status !== "maintenance" && server.status !== "offline" ? (
                            <div className="w-20">
                              <div className="flex items-center justify-between mb-1">
                                <Cpu className="h-3 w-3 text-zinc-400" />
                                <span className={cn("text-xs font-medium", getUsageBadgeColor(server.cpuUsage).replace("bg-", "text-").replace("/10", ""))}>
                                  {server.cpuUsage}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full", getUsageColor(server.cpuUsage))}
                                  style={{ width: `${server.cpuUsage}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-500">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          {server.status !== "maintenance" && server.status !== "offline" ? (
                            <div className="w-20">
                              <div className="flex items-center justify-between mb-1">
                                <MemoryStick className="h-3 w-3 text-zinc-400" />
                                <span className={cn("text-xs font-medium", getUsageBadgeColor(server.ramUsage).replace("bg-", "text-").replace("/10", ""))}>
                                  {server.ramUsage}%
                                </span>
                              </div>
                              <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full", getUsageColor(server.ramUsage))}
                                  style={{ width: `${server.ramUsage}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-500">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="w-20">
                            <div className="flex items-center justify-between mb-1">
                              <HardDrive className="h-3 w-3 text-zinc-400" />
                              <span className={cn("text-xs font-medium", getUsageBadgeColor(server.diskUsage).replace("bg-", "text-").replace("/10", ""))}>
                                {server.diskUsage}%
                              </span>
                            </div>
                            <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", getUsageColor(server.diskUsage))}
                                style={{ width: `${server.diskUsage}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge className="bg-green-500/10 text-green-600 dark:text-green-500">
                            {server.uptime}%
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                              asChild
                              title="Detaylar"
                            >
                              <Link href={`/yonetim/sunucular/${server.id}`}>
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                              >
                                <DropdownMenuItem asChild className="cursor-pointer">
                                  <Link href={`/yonetim/sunucular/${server.id}`}>
                                    <Activity className="mr-2 h-4 w-4" />
                                    Detayları Gör
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer">
                                  <RefreshCcw className="mr-2 h-4 w-4" />
                                  Yeniden Başlat
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
                                <DropdownMenuItem className="cursor-pointer text-blue-500">
                                  <Wrench className="mr-2 h-4 w-4" />
                                  Bakım Modu
                                </DropdownMenuItem>
                                <DropdownMenuItem className="cursor-pointer text-red-500">
                                  <Power className="mr-2 h-4 w-4" />
                                  Kapat
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredServers.length === 0 && (
              <div className="p-8 text-center">
                <Server className="h-12 w-12 text-zinc-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                  Sunucu bulunamadı
                </h3>
                <p className="text-zinc-600 dark:text-zinc-400">
                  Arama kriterlerinize uygun sunucu bulunmuyor.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Server,
  Cloud,
  Search,
  MoreVertical,
  Power,
  RotateCcw,
  Terminal,
  HardDrive,
  Cpu,
  Activity,
  CheckCircle2,
  XCircle,
  Pause,
  Play,
  Camera,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { restartServer, stopServer, startServer } from "@/lib/actions/customer/servers";
import { toast } from "@/lib/toast";

const statusConfig: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof CheckCircle2;
}> = {
  ACTIVE: {
    label: "Aktif",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    icon: CheckCircle2,
  },
  SUSPENDED: {
    label: "Durduruldu",
    color: "text-gray-500",
    bgColor: "bg-gray-500/10",
    icon: Pause,
  },
  CANCELLED: {
    label: "İptal",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    icon: XCircle,
  },
  EXPIRED: {
    label: "Süresi Doldu",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    icon: XCircle,
  },
};

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const percentage = (value / max) * 100;
  return (
    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

interface ServerServiceItem {
  id: string;
  label: string;
  productName: string;
  categorySlug: string;
  domain: string | null;
  ipAddress: string | null;
  status: string;
  cpuUsage: number;
  ramUsage: number;
  diskUsed: number;
  diskLimit: number;
  createdAt: string;
  expiresAt: string | null;
}

interface SunucularContentProps {
  servers: ServerServiceItem[];
  stats: {
    total: number;
    active: number;
    suspended: number;
  };
}

export function SunucularContent({ servers, stats }: SunucularContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [localServers, setLocalServers] = useState(servers);

  const handleRestart = async (serviceId: string) => {
    setActionInProgress(serviceId);
    const result = await restartServer(serviceId);
    if (result.success) {
      toast.success("Sunucu yeniden baslatildi");
    } else {
      toast.error(result.error || "Islem basarisiz");
    }
    setActionInProgress(null);
  };

  const handleStop = async (serviceId: string) => {
    setActionInProgress(serviceId);
    const result = await stopServer(serviceId);
    if (result.success) {
      setLocalServers((prev) =>
        prev.map((s) => (s.id === serviceId ? { ...s, status: "SUSPENDED" } : s))
      );
      toast.success("Sunucu durduruldu");
    } else {
      toast.error(result.error || "Islem basarisiz");
    }
    setActionInProgress(null);
  };

  const handleStart = async (serviceId: string) => {
    setActionInProgress(serviceId);
    const result = await startServer(serviceId);
    if (result.success) {
      setLocalServers((prev) =>
        prev.map((s) => (s.id === serviceId ? { ...s, status: "ACTIVE" } : s))
      );
      toast.success("Sunucu baslatildi");
    } else {
      toast.error(result.error || "Islem basarisiz");
    }
    setActionInProgress(null);
  };

  const filteredServers = localServers.filter(
    (server) =>
      server.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (server.ipAddress || "").includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0.1} inView>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sunucularım</h1>
            <p className="text-muted-foreground">
              VPS, VDS ve Bulut sunucularınızı yönetin.
            </p>
          </div>
          <Button asChild>
            <Link href="/sunucu/vds">Yeni Sunucu</Link>
          </Button>
        </div>
      </BlurFade>

      {/* Stats */}
      <BlurFade delay={0.15} inView>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Server className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Sunucu</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Activity className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aktif</p>
                  <p className="text-2xl font-bold">{stats.active}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-500/10">
                  <Pause className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Durduruldu</p>
                  <p className="text-2xl font-bold">{stats.suspended}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </BlurFade>

      {/* Search */}
      <BlurFade delay={0.2} inView>
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sunucu adı veya IP ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {/* Servers List */}
      <BlurFade delay={0.25} inView>
        <div className="grid gap-4">
          {filteredServers.map((server) => {
            const status = statusConfig[server.status] || statusConfig.ACTIVE;
            const StatusIcon = status.icon;
            const isActive = server.status === "ACTIVE";
            const isCloud = server.categorySlug === "cloud";

            return (
              <Card key={server.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                    {/* Server Info */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className={cn("p-3 rounded-lg", status.bgColor)}>
                        {isCloud ? (
                          <Cloud className={cn("h-6 w-6", status.color)} />
                        ) : (
                          <Server className={cn("h-6 w-6", status.color)} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{server.label || server.productName}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted">
                            {server.categorySlug.toUpperCase()}
                          </span>
                          <div className={cn("flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", status.bgColor, status.color)}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {server.ipAddress || "-"}{server.domain ? ` - ${server.domain}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Resources */}
                    {isActive && (server.cpuUsage > 0 || server.ramUsage > 0 || server.diskLimit > 0) && (
                      <div className="grid grid-cols-3 gap-6 flex-1">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Cpu className="h-3 w-3" /> CPU
                            </span>
                            <span>{Math.round(Number(server.cpuUsage))}%</span>
                          </div>
                          <ProgressBar
                            value={Number(server.cpuUsage)}
                            max={100}
                            color={Number(server.cpuUsage) > 80 ? "bg-red-500" : Number(server.cpuUsage) > 60 ? "bg-orange-500" : "bg-green-500"}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Activity className="h-3 w-3" /> RAM
                            </span>
                            <span>{Math.round(Number(server.ramUsage))}%</span>
                          </div>
                          <ProgressBar
                            value={Number(server.ramUsage)}
                            max={100}
                            color={Number(server.ramUsage) > 80 ? "bg-red-500" : Number(server.ramUsage) > 60 ? "bg-orange-500" : "bg-green-500"}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <HardDrive className="h-3 w-3" /> Disk
                            </span>
                            <span>{Math.round(Number(server.diskUsed))} GB</span>
                          </div>
                          <ProgressBar
                            value={Number(server.diskUsed)}
                            max={Number(server.diskLimit) || 1}
                            color={server.diskLimit > 0 && (Number(server.diskUsed) / Number(server.diskLimit)) * 100 > 80 ? "bg-red-500" : "bg-green-500"}
                          />
                          {server.diskLimit > 0 && (
                            <p className="text-xs text-muted-foreground">{Math.round(Number(server.diskLimit))} GB</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <Button variant="outline" size="sm" disabled={actionInProgress === server.id}>
                          <Terminal className="mr-2 h-4 w-4" />
                          Konsol
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={actionInProgress === server.id || server.status === "CANCELLED"}
                          onClick={() => handleStart(server.id)}
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Başlat
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={actionInProgress === server.id}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={!isActive}
                            onClick={() => handleRestart(server.id)}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Yeniden Başlat
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => isActive ? handleStop(server.id) : handleStart(server.id)}
                            disabled={server.status === "CANCELLED"}
                          >
                            <Power className="mr-2 h-4 w-4" />
                            {isActive ? "Durdur" : "Başlat"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                            <Camera className="mr-2 h-4 w-4" />
                            Snapshot Al
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <HardDrive className="mr-2 h-4 w-4" />
                            OS Yeniden Kur
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredServers.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Aramanızla eşleşen sunucu bulunamadı.
              </CardContent>
            </Card>
          )}
        </div>
      </BlurFade>
    </div>
  );
}

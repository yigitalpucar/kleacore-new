"use client";

import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  HardDrive,
  Cpu,
  Wifi,
  Activity,
  Database,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OverviewStats {
  totalBandwidth: number;
  totalDisk: number;
  avgCpu: number;
}

interface ServiceUsageItem {
  id: string;
  name: string;
  label: string;
  categorySlug: string;
  disk: { used: number; total: number };
  bandwidth: { used: number; total: number };
  cpu: number;
  ram: number;
  status: string;
}

interface IstatistiklerContentProps {
  overviewStats: OverviewStats;
  serviceUsage: ServiceUsageItem[];
  serviceCount: number;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export function IstatistiklerContent({
  overviewStats,
  serviceUsage,
  serviceCount,
}: IstatistiklerContentProps) {
  const statCards = [
    {
      title: "Toplam Bandwidth",
      value: `${overviewStats.totalBandwidth} GB`,
      period: "Toplam",
      icon: Wifi,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Disk Kullanimi",
      value: `${overviewStats.totalDisk} GB`,
      period: "Toplam",
      icon: HardDrive,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Ortalama CPU",
      value: `${overviewStats.avgCpu}%`,
      period: "Anlik",
      icon: Cpu,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Toplam Hizmet",
      value: serviceCount.toString(),
      period: "Aktif",
      icon: Database,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0.1} inView>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">İstatistikler</h1>
          <p className="text-muted-foreground">
            Hizmetlerinizin anlık kaynak kullanımını görüntüleyin.
          </p>
        </div>
      </BlurFade>

      {/* Overview Stats */}
      <BlurFade delay={0.15} inView>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {stat.period}
                      </span>
                    </div>
                  </div>
                  <div className={cn("p-3 rounded-lg", stat.bgColor)}>
                    <stat.icon className={cn("h-6 w-6", stat.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </BlurFade>

      {/* Service usage from database */}
      <BlurFade delay={0.5} inView>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-indigo-500" />
                  Hizmet Bazli Kullanim
                </CardTitle>
                <CardDescription>
                  Her hizmetin kaynak kullanim detaylari
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Yenile
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {serviceUsage.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Henüz aktif hizmetiniz bulunmuyor.
              </div>
            ) : (
              <div className="space-y-6">
                {serviceUsage.map((service) => (
                  <div key={service.id} className="p-4 rounded-lg border">
                    <p className="font-semibold mb-4">
                      {service.label || service.name}
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <HardDrive className="h-4 w-4" />
                            Disk
                          </span>
                          <span>
                            {service.disk.used} / {service.disk.total} GB
                          </span>
                        </div>
                        <ProgressBar
                          value={service.disk.used}
                          max={service.disk.total}
                          color={
                            service.disk.total > 0 &&
                            (service.disk.used / service.disk.total) * 100 > 80
                              ? "bg-red-500"
                              : service.disk.total > 0 &&
                                (service.disk.used / service.disk.total) * 100 > 60
                              ? "bg-orange-500"
                              : "bg-green-500"
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Wifi className="h-4 w-4" />
                            Bandwidth
                          </span>
                          <span>
                            {service.bandwidth.used} / {service.bandwidth.total} GB
                          </span>
                        </div>
                        <ProgressBar
                          value={service.bandwidth.used}
                          max={service.bandwidth.total}
                          color={
                            service.bandwidth.total > 0 &&
                            (service.bandwidth.used / service.bandwidth.total) * 100 > 80
                              ? "bg-red-500"
                              : service.bandwidth.total > 0 &&
                                (service.bandwidth.used / service.bandwidth.total) * 100 > 60
                              ? "bg-orange-500"
                              : "bg-blue-500"
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Cpu className="h-4 w-4" />
                            CPU
                          </span>
                          <span>{service.cpu}%</span>
                        </div>
                        <ProgressBar
                          value={service.cpu}
                          max={100}
                          color={
                            service.cpu > 80
                              ? "bg-red-500"
                              : service.cpu > 60
                              ? "bg-orange-500"
                              : "bg-purple-500"
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Activity className="h-4 w-4" />
                            RAM
                          </span>
                          <span>{service.ram}%</span>
                        </div>
                        <ProgressBar
                          value={service.ram}
                          max={100}
                          color={
                            service.ram > 80
                              ? "bg-red-500"
                              : service.ram > 60
                              ? "bg-orange-500"
                              : "bg-cyan-500"
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}

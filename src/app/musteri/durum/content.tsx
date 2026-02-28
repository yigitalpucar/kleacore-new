"use client";

import { BlurFade } from "@/components/magicui/blur-fade";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { subscribeNewsletter } from "@/lib/actions/contact";
import { toast } from "@/lib/toast";

interface ServiceStatus {
  id: string;
  serviceName: string;
  status: string;
  description: string;
  updatedAt: string;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  serviceName: string;
  startedAt: string;
  resolvedAt: string | null;
  updates: unknown;
  createdAt: string;
}

function getStatusIcon(status: string) {
  switch (status) {
    case "OPERATIONAL":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "DEGRADED":
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case "PARTIAL_OUTAGE":
    case "MAJOR_OUTAGE":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "MAINTENANCE":
      return <Clock className="h-5 w-5 text-blue-500" />;
    case "RESOLVED":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    case "INVESTIGATING":
    case "IDENTIFIED":
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case "MONITORING":
      return <Clock className="h-5 w-5 text-blue-500" />;
    default:
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  }
}

function getStatusText(status: string) {
  switch (status) {
    case "OPERATIONAL":
      return "Çalışıyor";
    case "DEGRADED":
      return "Performans Düşük";
    case "PARTIAL_OUTAGE":
      return "Kısmi Kesinti";
    case "MAJOR_OUTAGE":
      return "Büyük Kesinti";
    case "MAINTENANCE":
      return "Bakımda";
    case "RESOLVED":
      return "Çözüldü";
    case "INVESTIGATING":
      return "İnceleniyor";
    case "IDENTIFIED":
      return "Tespit Edildi";
    case "MONITORING":
      return "İzleniyor";
    default:
      return "Çalışıyor";
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "OPERATIONAL":
    case "RESOLVED":
      return "bg-green-500/10 text-green-600";
    case "DEGRADED":
    case "INVESTIGATING":
    case "IDENTIFIED":
      return "bg-yellow-500/10 text-yellow-600";
    case "PARTIAL_OUTAGE":
    case "MAJOR_OUTAGE":
      return "bg-red-500/10 text-red-600";
    case "MAINTENANCE":
    case "MONITORING":
      return "bg-blue-500/10 text-blue-600";
    default:
      return "bg-green-500/10 text-green-600";
  }
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-500/10 text-red-600 border-red-500/30";
    case "MAJOR":
      return "bg-orange-500/10 text-orange-600 border-orange-500/30";
    case "MINOR":
      return "bg-yellow-500/10 text-yellow-600 border-yellow-500/30";
    default:
      return "bg-gray-500/10 text-gray-600 border-gray-500/30";
  }
}

function getOverallStatus(statuses: ServiceStatus[]) {
  if (statuses.length === 0) return { status: "OPERATIONAL", message: "Tüm sistemler çalışıyor" };

  const hasOutage = statuses.some(
    (s) => s.status === "MAJOR_OUTAGE" || s.status === "PARTIAL_OUTAGE",
  );
  if (hasOutage) return { status: "outage", message: "Bazı servislerde kesinti var" };

  const hasDegraded = statuses.some(
    (s) => s.status === "DEGRADED",
  );
  if (hasDegraded) return { status: "degraded", message: "Bazı servislerde performans düşüklüğü" };

  const hasMaintenance = statuses.some(
    (s) => s.status === "MAINTENANCE",
  );
  if (hasMaintenance) return { status: "maintenance", message: "Planlı bakım devam ediyor" };

  return { status: "operational", message: "Tüm sistemler çalışıyor" };
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Az önce";
  if (minutes < 60) return `${minutes} dakika önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

export function DurumContent({
  statuses,
  activeIncidents,
  recentIncidents,
}: {
  statuses: ServiceStatus[];
  activeIncidents: Incident[];
  recentIncidents: Incident[];
}) {
  const router = useRouter();
  const [subscriberEmail, setSubscriberEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const overall = getOverallStatus(statuses);
  const lastUpdated =
    statuses.length > 0
      ? timeAgo(
          statuses.reduce((latest, s) =>
            new Date(s.updatedAt) > new Date(latest.updatedAt) ? s : latest,
          ).updatedAt,
        )
      : "Bilinmiyor";

  const handleSubscribe = async () => {
    if (!subscriberEmail.trim()) {
      toast.error("Lutfen e-posta adresinizi girin.");
      return;
    }

    setIsSubscribing(true);
    try {
      const result = await subscribeNewsletter(subscriberEmail, "system-status");
      if (!result.success) {
        toast.error(result.error ?? "Abonelik tamamlanamadi.");
        return;
      }

      toast.success(result.message ?? "Abonelik basariyla tamamlandi.");
      setSubscriberEmail("");
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <>
      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-green-500/5 to-background">
        <div className="container">
          <BlurFade delay={0.1} inView>
            <div className="text-center mb-12">
              <div
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium mb-4 ${
                  overall.status === "operational"
                    ? "bg-green-500/10 text-green-600 border border-green-500/30"
                    : overall.status === "degraded"
                    ? "bg-yellow-500/10 text-yellow-600 border border-yellow-500/30"
                    : overall.status === "outage"
                    ? "bg-red-500/10 text-red-600 border border-red-500/30"
                    : "bg-blue-500/10 text-blue-600 border border-blue-500/30"
                }`}
              >
                {overall.status === "operational" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : overall.status === "degraded" ? (
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                ) : overall.status === "outage" ? (
                  <XCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <Clock className="h-5 w-5 text-blue-500" />
                )}
                {overall.message}
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                Sistem Durumu
              </h1>
              <p className="mt-4 text-muted-foreground">
                Son güncelleme: {lastUpdated}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => router.refresh()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Yenile
              </Button>
            </div>
          </BlurFade>

          {/* Active Incidents */}
          {activeIncidents.length > 0 && (
            <BlurFade delay={0.15} inView>
              <div className="space-y-4 max-w-4xl mx-auto mb-8">
                {activeIncidents.map((incident) => (
                  <Card key={incident.id} className={`border-l-4 ${
                    incident.severity === "CRITICAL"
                      ? "border-l-red-500"
                      : incident.severity === "MAJOR"
                      ? "border-l-orange-500"
                      : "border-l-yellow-500"
                  }`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{incident.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {incident.serviceName} - {formatDate(incident.startedAt)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityBadge(incident.severity)}`}>
                            {incident.severity}
                          </span>
                          <span className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(incident.status)}`}>
                            {getStatusIcon(incident.status)}
                            {getStatusText(incident.status)}
                          </span>
                        </div>
                      </div>
                      {incident.description && (
                        <p className="text-sm text-muted-foreground">{incident.description}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </BlurFade>
          )}

          {/* Services Status */}
          <BlurFade delay={0.2} inView>
            <Card className="max-w-4xl mx-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Servis Durumları
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statuses.length > 0 ? (
                  <div className="space-y-4">
                    {statuses.map((service) => (
                      <div
                        key={service.id}
                        className="flex items-center justify-between py-3 border-b last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{service.serviceName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(service.status)}
                          <span className="text-sm">
                            {getStatusText(service.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Servis bilgisi henüz eklenmemiş.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </BlurFade>
        </div>
      </section>

      {/* Recent Incidents */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container">
          <BlurFade delay={0.1} inView>
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Son Olaylar
              </h2>
              <p className="mt-4 text-muted-foreground">
                Geçmiş kesinti ve bakım çalışmaları
              </p>
            </div>
          </BlurFade>

          <BlurFade delay={0.2} inView>
            <div className="space-y-4 max-w-3xl mx-auto">
              {recentIncidents.length > 0 ? (
                recentIncidents.map((incident) => (
                  <Card key={incident.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{incident.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(incident.startedAt)} • {incident.serviceName}
                            {incident.resolvedAt && (
                              <> • Çözüldü: {formatDate(incident.resolvedAt)}</>
                            )}
                          </p>
                        </div>
                        <div
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getStatusBadgeClass(incident.status)}`}
                        >
                          {getStatusIcon(incident.status)}
                          {getStatusText(incident.status)}
                        </div>
                      </div>
                      {incident.description && (
                        <p className="text-sm text-muted-foreground">
                          {incident.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Yakın zamanda herhangi bir olay kaydedilmedi.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </BlurFade>
        </div>
      </section>

      {/* Subscribe */}
      <section className="py-16 md:py-24 bg-primary/5">
        <div className="container">
          <BlurFade delay={0.1} inView>
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
                Durum Bildirimleri
              </h2>
              <p className="text-muted-foreground mb-8">
                Kesinti ve bakım çalışmalarından e-posta ile haberdar olun.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="E-posta adresiniz"
                  value={subscriberEmail}
                  onChange={(event) => setSubscriberEmail(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <Button onClick={handleSubscribe} disabled={isSubscribing}>
                  {isSubscribing ? "Kaydediliyor..." : "Abone Ol"}
                </Button>
              </div>
            </div>
          </BlurFade>
        </div>
      </section>
    </>
  );
}

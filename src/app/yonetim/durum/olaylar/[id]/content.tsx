import { ExternalLink } from "lucide-react";
import {
  AppBreadcrumbLabel,
  DetailList,
  PageHeader,
  SectionCard,
  StatusBadge,
  appButton,
  enumLabel,
} from "@/components/app";
import { DeleteIncidentButton, IncidentUpdateForm } from "@/components/admin-b/durum/incident-actions";
import { IncidentForm } from "@/components/admin-b/durum/incident-form";
import { IncidentTimeline, durationLabel, severityTone, type IncidentRow } from "@/components/admin-b/durum/shared";
import { formatDateTime } from "@/lib/format/date";

export function OlayDetayContent({
  incident,
  components,
  generatedAt,
}: {
  incident: IncidentRow;
  components: string[];
  generatedAt: string;
}) {
  const resolved = incident.status === "RESOLVED";

  return (
    <>
      <AppBreadcrumbLabel segment={incident.id} label={incident.title} />
      <PageHeader
        back={{ href: "/yonetim/durum", label: "Sistem durumu" }}
        eyebrow={`Olay · ${incident.serviceName}`}
        title={incident.title}
        meta={
          <>
            <StatusBadge kind="incident" status={incident.status} />
            <StatusBadge tone={severityTone(incident.severity)} label={`${enumLabel("incidentSeverity", incident.severity)} etki`} />
            <span className="tabular-nums">
              {resolved && incident.resolvedAt
                ? `${durationLabel(incident.startedAt, incident.resolvedAt)} sürdü`
                : `${durationLabel(incident.startedAt, generatedAt)} sürüyor`}
            </span>
          </>
        }
        actions={
          <a href="/musteri/durum" target="_blank" rel="noopener noreferrer" className={appButton({ variant: "outline" })}>
            <ExternalLink aria-hidden />
            Durum sayfasında gör
          </a>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <SectionCard title="Zaman çizelgesi" description="Herkese açık sayfada en yeni güncelleme üstte görünür.">
            <IncidentTimeline entries={incident.updates} />
          </SectionCard>

          <IncidentForm components={components} incident={incident} />
        </div>

        <div className="min-w-0 space-y-6">
          <SectionCard
            title={resolved ? "Olayı yeniden aç" : "Güncelleme ekle"}
            description={
              resolved
                ? "Sorun tekrarladıysa yeni bir durumla güncelleme ekleyin; olay yeniden açık olaylara taşınır."
                : "Durumu ilerletin. “Çözüldü” seçildiğinde olay kapanır ve geçmişe taşınır."
            }
          >
            <IncidentUpdateForm key={`${incident.status}-${incident.updates.length}`} incidentId={incident.id} currentStatus={incident.status} />
          </SectionCard>

          <SectionCard title="Özet" headingLevel={2}>
            <DetailList
              items={[
                { label: "Bileşen", value: incident.serviceName },
                { label: "Başlangıç", value: formatDateTime(incident.startedAt) },
                { label: "Çözüldü", value: incident.resolvedAt ? formatDateTime(incident.resolvedAt) : null },
                { label: "Güncelleme sayısı", value: String(incident.updates.length) },
                { label: "Son değişiklik", value: formatDateTime(incident.updatedAt) },
              ]}
            />
          </SectionCard>

          <DeleteIncidentButton incidentId={incident.id} title={incident.title} />
        </div>
      </div>
    </>
  );
}

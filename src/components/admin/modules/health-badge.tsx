import { StatusBadge } from "@/components/app";
import { formatDateTime } from "@/lib/format/date";

/** Last health check result of a module instance. */
export function HealthBadge({
  status,
  error,
  at,
}: {
  status: "UNKNOWN" | "OK" | "ERROR";
  error?: string | null;
  at?: string | null;
}) {
  const when = at ? formatDateTime(at) : null;
  if (status === "OK") return <StatusBadge tone="success" label={when ? `Bağlı · ${when}` : "Bağlı"} />;
  if (status === "ERROR") {
    return (
      <span title={error ?? undefined}>
        <StatusBadge tone="danger" label={when ? `Hata · ${when}` : "Hata"} />
      </span>
    );
  }
  return <StatusBadge tone="muted" label="Test edilmedi" />;
}

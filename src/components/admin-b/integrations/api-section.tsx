import Link from "next/link";
import { ArrowUpRight, Key, Users } from "lucide-react";
import { EmptyState, FormSection, IconTile, StatusBadge, appButton } from "@/components/app";
import { formatDate } from "@/lib/format/date";
import { CodeValue } from "./shared";
import type { ApiKeyItem, EnvFlags } from "./types";

function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.substring(0, 7) + "****" + key.substring(key.length - 4);
}

export function ApiSection({ apiKeys, env }: { apiKeys: ApiKeyItem[]; env: EnvFlags }) {
  return (
    <div className="space-y-8">
      <FormSection
        title="Public API v1"
        description="REST API ile fatura ve destek taleplerine erişim."
        footer={
          <>
            <Link href="/api-docs" target="_blank" className={appButton({ variant: "outline" })}>
              Dokümantasyon
              <ArrowUpRight aria-hidden />
            </Link>
            <Link href="/yonetim/ayarlar?tab=api" className={appButton()}>
              API anahtarlarını yönet
            </Link>
          </>
        }
      >
        <CodeValue label="Base URL" value={`${env.appBaseUrl}/api/v1`} />
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Aktif API anahtarları <span className="tabular-nums text-muted-foreground">({apiKeys.length})</span>
          </p>
          {apiKeys.length === 0 ? (
            <EmptyState compact icon={Key} title="Henüz aktif API anahtarı yok." />
          ) : (
            <ul className="divide-y rounded-md border">
              {apiKeys.slice(0, 5).map((apiKey) => (
                <li key={apiKey.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{apiKey.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{maskApiKey(apiKey.keyPrefix)}</p>
                  </div>
                  <p className="text-xs tabular-nums text-muted-foreground">{formatDate(apiKey.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </FormSection>

      <FormSection title="Satış ortaklığı" description="Dahili modül; komisyon oranı %10.">
        <div className="flex items-start gap-3">
          <IconTile>
            <Users />
          </IconTile>
          <div className="min-w-0 flex-1 space-y-1 text-[13px] text-muted-foreground">
            <p>
              Referans linki biçimi: <code className="break-all font-mono text-xs text-foreground">{env.appBaseUrl}/ref/[kod]</code>
            </p>
            <p>Çerez süresi: 30 gün</p>
          </div>
          <StatusBadge tone="info" label="Dahili · Aktif" />
        </div>
      </FormSection>
    </div>
  );
}

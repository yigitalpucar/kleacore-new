import { Clock } from "lucide-react";
import { CopyButton, EmptyState, SectionCard, StatusBadge } from "@/components/app";
import type { CronJobItem, EnvFlags } from "./types";

export function CronSection({ cronJobs, env }: { cronJobs: CronJobItem[]; env: EnvFlags }) {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Zamanlanmış görevler"
        description="Vercel Cron veya harici bir zamanlayıcı ile tetiklenir."
        flush
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-muted/30 px-4 py-3 md:px-5">
          <div className="min-w-0">
            <p className="font-mono text-[13px] font-medium">CRON_SECRET</p>
            <p className="text-xs text-muted-foreground">
              İstekte <code className="font-mono">Authorization: Bearer [CRON_SECRET]</code> başlığı gerekir.
            </p>
          </div>
          <StatusBadge
            tone={env.cronSecretConfigured ? "success" : "warning"}
            label={env.cronSecretConfigured ? "Tanımlı" : "Eksik"}
          />
        </div>
        {cronJobs.length === 0 ? (
          <div className="p-4 md:p-5">
            <EmptyState compact icon={Clock} title="Tanımlı zamanlanmış görev yok." />
          </div>
        ) : (
          <ul className="divide-y">
            {cronJobs.map((job) => (
              <li key={job.path} className="flex items-start gap-3 px-4 py-3.5 md:px-5">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{job.name}</p>
                    <span className="rounded border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {job.schedule}
                    </span>
                  </div>
                  <p className="break-all font-mono text-xs text-muted-foreground">{job.url}</p>
                </div>
                <CopyButton value={job.url} label={`${job.name} adresini kopyala`} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

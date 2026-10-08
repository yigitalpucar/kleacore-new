import { SectionCard } from "@/components/app";
import { ModuleRow, categoryLabels } from "./shared";
import type { IntegrationModule } from "./types";

const categoryOrder: IntegrationModule["category"][] = [
  "domain",
  "hosting",
  "payment",
  "communication",
  "automation",
  "api",
  "marketing",
];

/** Overview tab: modules grouped by category (settings-integrations2 list pattern). */
export function OverviewSection({ modules }: { modules: IntegrationModule[] }) {
  const groups = categoryOrder
    .map((category) => ({ category, items: modules.filter((m) => m.category === category) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {groups.map(({ category, items }) => (
        <SectionCard key={category} title={categoryLabels[category]} flush>
          <ul>
            {items.map((module) => (
              <ModuleRow
                key={module.id}
                module={module}
                href={module.tab && module.tab !== "overview" ? `/yonetim/entegrasyonlar?tab=${module.tab}` : undefined}
              />
            ))}
          </ul>
        </SectionCard>
      ))}
    </div>
  );
}

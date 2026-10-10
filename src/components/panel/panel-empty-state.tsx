import Link from "next/link";
import { EmptyState, appButton } from "@/components/app";
import { PANEL_EMPTY_PRESETS, type PanelEmptyKind, type PanelEmptyPreset } from "./empty-presets";

/**
 * Customer panel empty state from a preset (./empty-presets.ts). `action`
 * replaces the preset's link when the primary action is a button on the page
 * (e.g. "Kart ekle"); `description` overrides the sentence when it depends on data.
 */
export function PanelEmptyState({
  kind,
  compact,
  className,
  action,
  description,
}: {
  kind: PanelEmptyKind;
  compact?: boolean;
  className?: string;
  action?: React.ReactNode;
  description?: React.ReactNode;
}) {
  const preset: PanelEmptyPreset = PANEL_EMPTY_PRESETS[kind];
  return (
    <EmptyState
      compact={compact}
      className={className}
      icon={preset.icon}
      title={preset.title}
      description={description ?? preset.description}
      action={
        action ??
        (preset.cta ? (
          <Link href={preset.cta.href} className={appButton({ size: compact ? "sm" : "md" })}>
            {preset.cta.label}
          </Link>
        ) : undefined)
      }
    />
  );
}

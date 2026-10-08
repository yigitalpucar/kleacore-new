import type { LucideIcon } from "lucide-react";
import { getIcon } from "@/lib/utils/icon-map";

/**
 * Icons in kit data can be a lucide component (client/server components)
 * or a string name from src/lib/utils/icon-map.ts. Use the string form when
 * data crosses the server -> client boundary (functions are not serialisable).
 */
export type IconRef = LucideIcon | string;

export function resolveIcon(icon: IconRef | undefined): LucideIcon | null {
  if (!icon) return null;
  return typeof icon === "string" ? getIcon(icon) : icon;
}

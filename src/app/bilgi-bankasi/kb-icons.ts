import {
  BookOpen,
  Database,
  FileText,
  Globe,
  HardDrive,
  HelpCircle,
  Mail,
  Server,
  Settings,
  Shield,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** DB `kb_categories.icon` string -> lucide component. */
const kbIconMap: Record<string, LucideIcon> = {
  BookOpen,
  Database,
  FileText,
  Globe,
  HardDrive,
  HelpCircle,
  Mail,
  Server,
  Settings,
  Shield,
  Zap,
};

export function kbIcon(name?: string | null): LucideIcon {
  return (name && kbIconMap[name]) || BookOpen;
}

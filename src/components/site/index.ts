/**
 * KLEACORE public-site design kit. See docs/ui-kit.md for usage rules.
 * Server-safe unless noted ("client" components carry "use client").
 */
export { Container } from "./container";
export { Section, type SectionProps } from "./section";
export { SectionHeading, type SectionHeadingProps } from "./section-heading";
export { Eyebrow } from "./eyebrow";
export {
  GridLineHorizontal,
  GridLineVertical,
  DashedFrame,
  GridBackground,
  CornerTicks,
} from "./grid-lines";
export { Beams } from "./beams"; // client
export { Breadcrumbs, type BreadcrumbItem } from "./breadcrumbs";
export { PageHeader, type PageHeaderProps } from "./page-header";
export { buttonClasses } from "./button-classes";
export { Price, type PriceProps } from "./price";
export { StatusPill, StatusDot } from "./status-pill";
export { TrustBar, defaultTrustItems, backupTrustItem, type TrustBarItem } from "./trust-bar";
export { FeatureGrid, type FeatureItem } from "./feature-grid";
export { CtaBand, type CtaBandProps, type CtaAction } from "./cta-band";
export { FaqSection, FaqList, type FaqItem, type FaqGroup } from "./faq-section"; // client
export { BillingSwitch } from "./billing-switch"; // client
export { PlanCard, type PlanCardData, type PlanSpec } from "./plan-card";
export { PlanGrid, type PlanGridProps } from "./plan-grid"; // client
export {
  ServerPlanTable,
  defaultServerSpecColumns,
  type ServerPlanRow,
  type ServerPlanSpecColumn,
} from "./server-plan-table";
export {
  ComparisonTable,
  type ComparisonColumn,
  type ComparisonRow,
  type ComparisonValue,
} from "./comparison-table";
export { InfraStack } from "./infra-stack";
export { resolveIcon, type IconRef } from "./icon";

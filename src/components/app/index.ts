/**
 * App kit — customer + admin panels. See docs/app-kit.md.
 * Server-safe: PageHeader, SectionCard, StatCard/StatGrid, StatusBadge,
 * EmptyState, DetailList, FormSection/FormField, UsageMeter, ChartCard,
 * ListRow/IconTile, appButton, status-map helpers.
 * Client: AppShell, DataTable, UnavailableAction, CopyButton, topbar items.
 */
export { AppShell, AppBreadcrumbLabel } from "./app-shell";
export type { AppNavGroup, AppNavItem, AppShellProps, AppShellUser } from "./app-shell";
export { AppThemeToggle, AppUserMenu, AppNotifications, AppCommandSearch } from "./topbar-items";
export type { AppNotification, AppUserMenuLink, AppSearchItem } from "./topbar-items";
export { PageHeader } from "./page-header";
export { SectionCard } from "./section-card";
export { StatCard, StatGrid } from "./stat-card";
export type { StatCardProps } from "./stat-card";
export { StatusBadge, ToneDot } from "./status-badge";
export { getStatusMeta, getStatusOptions, enumLabel, ENUM_LABELS } from "./status-map";
export type { StatusKind, StatusTone, StatusAudience, EnumLabelKind } from "./status-map";
export { EmptyState } from "./empty-state";
export { DetailList } from "./detail-list";
export type { DetailItem } from "./detail-list";
export { FormSection, FormField } from "./form-section";
export { UsageMeter } from "./usage-meter";
export { ChartCard } from "./chart-card";
export type { BarDatum } from "./chart-card";
export { DataTable, RowActionsMenu } from "./data-table";
export type { DataTableProps, DataTableFilter, RowAction, ColumnDef } from "./data-table";
export { UnavailableAction } from "./unavailable-action";
export { CopyButton } from "./copy-button";
export { ListRow, IconTile } from "./list-row";
export { appButton } from "./button-classes";
export { PageSkeleton } from "./page-skeleton";
export { TimeSeriesChart } from "./time-series-chart";
export type { TimeSeries } from "./time-series-chart";
export { AppBottomNav } from "./bottom-nav";
export type { AppBottomNavItem } from "./bottom-nav";

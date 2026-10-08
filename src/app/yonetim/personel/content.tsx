"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, ShieldCheck, ShieldOff, UserCheck, UserPlus, UserX, Users } from "lucide-react";
import {
  DataTable,
  EmptyState,
  FormField,
  ListRow,
  PageHeader,
  RowActionsMenu,
  SectionCard,
  StatusBadge,
  appButton,
  type ColumnDef,
  type RowAction,
} from "@/components/app";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  changeStaffRoleAction,
  inviteStaffAction,
  resendStaffInviteAction,
  setRequireStaffTwoFactorAction,
  setStaffActiveAction,
} from "@/lib/actions/admin/staff";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@/lib/auth/permissions";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { toast } from "@/lib/toast";

export interface StaffRow {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  status: string;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const selectClass =
  "flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:h-9";

type Result = { success: true; message?: string } | { success: false; error: string };

export function PersonelContent({
  staff,
  currentUserId,
  requireTwoFactor,
  twoFactorGloballyEnabled,
}: {
  staff: StaffRow[];
  currentUserId: string;
  requireTwoFactor: boolean;
  twoFactorGloballyEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [inviteRole, setInviteRole] = useState<StaffRole>("SUPPORT");
  const [inviteError, setInviteError] = useState<string>();

  const run = (action: () => Promise<Result>, onDone?: () => void) =>
    start(async () => {
      const result = await action();
      if (result.success) {
        if (result.message) toast.success(result.message);
        onDone?.();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });

  const onInvite = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    setInviteError(undefined);
    start(async () => {
      const result = await inviteStaffAction({
        email: String(fd.get("email") ?? ""),
        name: String(fd.get("name") ?? ""),
        surname: String(fd.get("surname") ?? ""),
        role: inviteRole,
      });
      if (result.success) {
        toast.success(result.message ?? "Personel eklendi.");
        form.reset();
        router.refresh();
      } else {
        setInviteError(result.error);
      }
    });
  };

  const changeRole = (row: StaffRow, role: StaffRole) => {
    if (role === row.role) return;
    if (!confirm(`${row.name} için rol "${ROLE_LABELS[role]}" olarak değiştirilsin mi?`)) return;
    run(() => changeStaffRoleAction(row.id, role));
  };

  const rowActions = (row: StaffRow): RowAction[] => {
    const active = row.status === "ACTIVE";
    const self = row.id === currentUserId;
    return [
      {
        label: "Daveti yeniden gönder",
        icon: <Mail aria-hidden />,
        onSelect: () => run(() => resendStaffInviteAction(row.id)),
        disabledReason: active ? undefined : "Pasif",
      },
      active
        ? {
            label: "Devre dışı bırak",
            icon: <UserX aria-hidden />,
            destructive: true,
            separator: true,
            disabledReason: self ? "Siz" : undefined,
            onSelect: () => {
              if (confirm(`${row.name} yönetim paneline erişemeyecek. Devam edilsin mi?`)) {
                run(() => setStaffActiveAction(row.id, false));
              }
            },
          }
        : {
            label: "Yeniden etkinleştir",
            icon: <UserCheck aria-hidden />,
            separator: true,
            onSelect: () => run(() => setStaffActiveAction(row.id, true)),
          },
    ];
  };

  const roleSelect = (row: StaffRow) => (
    <select
      aria-label={`${row.name} rolü`}
      value={row.role}
      disabled={pending}
      onChange={(e) => changeRole(row, e.target.value as StaffRole)}
      className={selectClass}
      data-no-row-click
    >
      {STAFF_ROLES.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  );

  const columns: ColumnDef<StaffRow>[] = [
    {
      accessorKey: "name",
      header: "Personel",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">
            {row.original.name}
            {row.original.id === currentUserId ? <span className="text-muted-foreground"> (siz)</span> : null}
          </p>
          <p className="break-all text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: "Rol",
      cell: ({ row }) => <div className="w-36">{roleSelect(row.original)}</div>,
    },
    {
      accessorKey: "status",
      header: "Durum",
      cell: ({ row }) => <StatusBadge kind="user" status={row.original.status} />,
    },
    {
      id: "twoFactor",
      accessorFn: (r) => (r.twoFactorEnabled ? 1 : 0),
      header: "2FA",
      cell: ({ row }) =>
        row.original.twoFactorEnabled ? (
          <StatusBadge tone="success" label="Açık" />
        ) : (
          <StatusBadge tone={requireTwoFactor ? "danger" : "muted"} label="Kapalı" />
        ),
    },
    {
      id: "lastLoginAt",
      accessorFn: (r) => r.lastLoginAt ?? "",
      header: "Son giriş",
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.lastLoginAt ? formatDateTime(row.original.lastLoginAt) : "Henüz giriş yok"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => <RowActionsMenu actions={rowActions(row.original)} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Personel"
        description="Yönetim paneline erişen kullanıcılar, rolleri ve erişimleri. Rol değişiklikleri en geç 5 dakika içinde oturuma yansır."
      />

      <SectionCard title="Personel listesi" description={`${staff.length} kullanıcı`} flush>
        <DataTable
          framed={false}
          caption="Personel"
          columns={columns}
          data={staff}
          pageSize={0}
          searchFn={(r, q) => r.name.toLocaleLowerCase("tr-TR").includes(q) || r.email.includes(q)}
          searchPlaceholder="Ad veya e-posta ara…"
          mobileCard={(r) => (
            <div className="space-y-2">
              <ListRow
                title={r.name}
                subtitle={r.email}
                trailing={<RowActionsMenu actions={rowActions(r)} />}
                meta={
                  <>
                    <StatusBadge kind="user" status={r.status} size="sm" />
                    <span>2FA {r.twoFactorEnabled ? "açık" : "kapalı"}</span>
                    <span>{r.lastLoginAt ? `Son giriş ${formatDate(r.lastLoginAt)}` : "Henüz giriş yok"}</span>
                  </>
                }
              />
              {roleSelect(r)}
            </div>
          )}
          emptyState={<EmptyState compact icon={Users} title="Personel yok" />}
        />
      </SectionCard>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SectionCard
          title="Personel davet et"
          description="Hesap oluşturulur ve kişiye şifresini belirlemesi için 7 gün geçerli bir bağlantı gönderilir."
        >
          <form onSubmit={onInvite} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Ad" htmlFor="staff-name" required>
                <Input id="staff-name" name="name" required autoComplete="off" className="h-11 md:h-9" />
              </FormField>
              <FormField label="Soyad" htmlFor="staff-surname">
                <Input id="staff-surname" name="surname" autoComplete="off" className="h-11 md:h-9" />
              </FormField>
            </div>
            <FormField label="E-posta" htmlFor="staff-email" required>
              <Input id="staff-email" name="email" type="email" required autoComplete="off" className="h-11 md:h-9" />
            </FormField>
            <FormField label="Rol" htmlFor="staff-role" hint={ROLE_DESCRIPTIONS[inviteRole]}>
              <select
                id="staff-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as StaffRole)}
                className={selectClass}
              >
                {STAFF_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </FormField>
            {inviteError ? (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {inviteError}
              </p>
            ) : null}
            <button type="submit" disabled={pending} className={appButton({ className: "w-full sm:w-auto" })}>
              <UserPlus aria-hidden />
              Davet gönder
            </button>
          </form>
        </SectionCard>

        <SectionCard title="Güvenlik" description="Personel hesapları için iki faktörlü doğrulama.">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-muted-foreground">
              {requireTwoFactor ? <ShieldCheck aria-hidden className="size-5" /> : <ShieldOff aria-hidden className="size-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <label htmlFor="require-staff-2fa" className="text-sm font-medium">
                Personel için 2FA zorunlu
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Açıkken iki faktörlü doğrulaması olmayan personel, yönetim paneline girmeden önce hesap ayarlarında 2FA kurmaya
                yönlendirilir.
              </p>
              {!twoFactorGloballyEnabled ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  İki faktörlü doğrulama Ayarlar → Güvenlik bölümünde kapalı; bu kural o açılana kadar uygulanmaz.
                </p>
              ) : null}
            </div>
            <Switch
              id="require-staff-2fa"
              checked={requireTwoFactor}
              disabled={pending}
              onCheckedChange={(checked) => run(() => setRequireStaffTwoFactorAction(checked))}
            />
          </div>
        </SectionCard>
      </div>
    </>
  );
}

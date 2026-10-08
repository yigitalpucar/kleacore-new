"use client";

import { useMemo, useState } from "react";
import { Loader2, Store, UserPlus, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataTable,
  EmptyState,
  FormField,
  ListRow,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  type ColumnDef,
} from "@/components/app";
import { formatDate } from "@/lib/format/date";
import { toast } from "@/lib/toast";
import {
  assignCustomer,
  enableReseller,
  updateResellerDiscount,
} from "@/lib/actions/admin/resellers";

interface ResellerItem {
  id: string;
  name: string;
  email: string;
  status: string;
  discountPercent: number;
  customerCount: number;
  createdAt: string;
}

interface CustomerItem {
  id: string;
  email: string;
  name: string;
  isReseller: boolean;
  parentResellerId: string | null;
}

interface BayilerContentProps {
  resellers: ResellerItem[];
  customers: CustomerItem[];
}

export function BayilerContent({ resellers, customers }: BayilerContentProps) {
  const [discountDrafts, setDiscountDrafts] = useState<Record<string, string>>({});
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedResellerId, setSelectedResellerId] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  const assignableCustomers = useMemo(
    () =>
      customers.filter(
        (customer) => !customer.isReseller && customer.id !== selectedResellerId
      ),
    [customers, selectedResellerId]
  );

  const setActionPending = (key: string, value: boolean) => {
    setPendingActions((current) => ({ ...current, [key]: value }));
  };

  const handleToggleReseller = async (customer: CustomerItem, enabled: boolean) => {
    const key = `toggle-${customer.id}`;
    setActionPending(key, true);

    const result = await enableReseller(customer.id, enabled);

    setActionPending(key, false);

    if (!result.success) {
      toast.error(result.error ?? "Bayi durumu güncellenemedi");
      return;
    }

    toast.success(enabled ? "Bayi hesabı etkinleştirildi" : "Bayi hesabı devre dışı bırakıldı");
    window.location.reload();
  };

  const handleDiscountUpdate = async (resellerId: string) => {
    const key = `discount-${resellerId}`;
    const draft = discountDrafts[resellerId];
    const discountPercent = Number(draft);

    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      toast.error("İndirim oranı 0-100 arasında olmalıdır");
      return;
    }

    setActionPending(key, true);
    const result = await updateResellerDiscount(resellerId, discountPercent);
    setActionPending(key, false);

    if (!result.success) {
      toast.error(result.error ?? "İndirim oranı güncellenemedi");
      return;
    }

    toast.success("Bayi indirim oranı güncellendi");
    window.location.reload();
  };

  const handleAssignCustomer = async () => {
    if (!selectedResellerId || !selectedCustomerId) {
      toast.error("Bayi ve müşteri seçmelisiniz");
      return;
    }

    const key = `assign-${selectedCustomerId}`;
    setActionPending(key, true);
    const result = await assignCustomer(selectedCustomerId, selectedResellerId);
    setActionPending(key, false);

    if (!result.success) {
      toast.error(result.error ?? "Müşteri atanamadı");
      return;
    }

    toast.success("Müşteri bayiye atandı");
    setAssignDialogOpen(false);
    setSelectedCustomerId("");
    window.location.reload();
  };

  const totalCustomers = resellers.reduce((sum, reseller) => sum + reseller.customerCount, 0);
  const avgDiscount =
    resellers.length > 0
      ? resellers.reduce((sum, item) => sum + item.discountPercent, 0) / resellers.length
      : 0;

  const discountEditor = (reseller: ResellerItem) => {
    const key = `discount-${reseller.id}`;
    const discountValue = discountDrafts[reseller.id] ?? String(reseller.discountPercent);
    return (
      <div className="flex items-center gap-2">
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            %
          </span>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            inputMode="decimal"
            aria-label={`${reseller.name} indirim oranı`}
            value={discountValue}
            onChange={(event) =>
              setDiscountDrafts((current) => ({
                ...current,
                [reseller.id]: event.target.value,
              }))
            }
            className="h-11 w-24 pl-7 tabular-nums md:h-9"
          />
        </div>
        <button
          type="button"
          className={appButton({ variant: "outline", size: "sm" })}
          onClick={() => handleDiscountUpdate(reseller.id)}
          disabled={pendingActions[key]}
        >
          {pendingActions[key] ? <Loader2 aria-label="Kaydediliyor" className="animate-spin" /> : "Kaydet"}
        </button>
      </div>
    );
  };

  const columns: ColumnDef<ResellerItem>[] = [
    {
      accessorKey: "name",
      header: "Bayi",
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[320px]">
          <p className="truncate font-medium">{row.original.name}</p>
          <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Durum",
      enableSorting: false,
      cell: ({ row }) => <StatusBadge kind="user" status={row.original.status} />,
    },
    {
      accessorKey: "customerCount",
      header: "Alt müşteri",
      meta: { align: "right" },
      cell: ({ row }) => <span className="tabular-nums">{row.original.customerCount.toLocaleString("tr-TR")}</span>,
    },
    {
      id: "createdAt",
      accessorFn: (r) => r.createdAt,
      header: "Kayıt",
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
    },
    {
      accessorKey: "discountPercent",
      header: "İndirim oranı",
      meta: { align: "right", className: "w-px" },
      cell: ({ row }) => <div className="flex justify-end">{discountEditor(row.original)}</div>,
    },
  ];

  const toggleList = customers.slice(0, 20);

  return (
    <>
      <PageHeader
        title="Bayi yönetimi"
        description="Bayileri yönetin, indirim oranlarını ayarlayın ve bayilere müşteri atayın."
        actions={
          <button type="button" className={appButton()} onClick={() => setAssignDialogOpen(true)}>
            <UserPlus aria-hidden />
            Müşteri ata
          </button>
        }
      />

      <StatGrid columns={3} className="grid-cols-1 sm:grid-cols-3">
        <StatCard label="Toplam bayi" value={resellers.length.toLocaleString("tr-TR")} icon={Store} />
        <StatCard label="Alt müşteri" value={totalCustomers.toLocaleString("tr-TR")} icon={Users} />
        <StatCard
          label="Ort. indirim"
          value={`%${avgDiscount.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`}
          hint="Bayi indirim oranlarının ortalaması"
        />
      </StatGrid>

      <SectionCard title="Bayi listesi" description="Bayiler, alt müşteri sayıları ve indirim oranları" flush>
        <DataTable
          caption="Bayiler"
          framed={false}
          columns={columns}
          data={resellers}
          initialSort={[{ id: "createdAt", desc: true }]}
          searchFn={(r, q) =>
            r.name.toLocaleLowerCase("tr-TR").includes(q) || r.email.toLocaleLowerCase("tr-TR").includes(q)
          }
          searchPlaceholder="Bayi adı veya e-posta ara…"
          mobileCard={(r) => (
            <div className="space-y-3">
              <ListRow
                title={r.name}
                subtitle={r.email}
                meta={
                  <>
                    <StatusBadge kind="user" status={r.status} />
                    <span>{r.customerCount.toLocaleString("tr-TR")} alt müşteri</span>
                    <span className="tabular-nums">Kayıt {formatDate(r.createdAt)}</span>
                  </>
                }
              />
              {discountEditor(r)}
            </div>
          )}
          emptyState={
            <EmptyState
              compact
              icon={Store}
              title="Henüz bayi yok"
              description="Aşağıdan müşterileri bayi olarak etkinleştirebilirsiniz."
            />
          }
        />
      </SectionCard>

      <SectionCard
        title="Bayi olarak etkinleştir"
        description={`Müşterileri bayi hesabına dönüştürün veya devre dışı bırakın. Son kaydolan ${toggleList.length} müşteri gösteriliyor.`}
        flush
      >
        {toggleList.length === 0 ? (
          <div className="p-4 md:p-5">
            <EmptyState compact icon={Users} title="Henüz müşteri yok" />
          </div>
        ) : (
          <ul className="divide-y">
            {toggleList.map((customer) => {
              const switchId = `reseller-toggle-${customer.id}`;
              return (
                <li key={customer.id} className="flex items-center justify-between gap-4 px-4 py-3 md:px-5">
                  <label htmlFor={switchId} className="min-w-0 cursor-pointer">
                    <span className="block truncate text-sm font-medium">{customer.name || customer.email}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">{customer.email}</span>
                  </label>
                  <div className="flex shrink-0 items-center gap-3">
                    {customer.isReseller ? (
                      <StatusBadge tone="neutral" label="Bayi" />
                    ) : customer.parentResellerId ? (
                      <StatusBadge tone="muted" label="Atanmış müşteri" />
                    ) : null}
                    <Switch
                      id={switchId}
                      checked={customer.isReseller}
                      disabled={pendingActions[`toggle-${customer.id}`]}
                      onCheckedChange={(checked) => handleToggleReseller(customer, checked)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Müşteri ata</DialogTitle>
            <DialogDescription>Bir müşteriyi seçili bayiye alt müşteri olarak bağlayın.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <FormField label="Bayi" htmlFor="assign-reseller">
              <Select value={selectedResellerId} onValueChange={setSelectedResellerId}>
                <SelectTrigger id="assign-reseller">
                  <SelectValue placeholder="Bayi seçin" />
                </SelectTrigger>
                <SelectContent>
                  {resellers.map((reseller) => (
                    <SelectItem key={reseller.id} value={reseller.id}>
                      {reseller.name} ({reseller.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Müşteri" htmlFor="assign-customer">
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger id="assign-customer">
                  <SelectValue placeholder="Müşteri seçin" />
                </SelectTrigger>
                <SelectContent>
                  {assignableCustomers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} ({customer.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <DialogFooter className="gap-2">
            <button type="button" className={appButton({ variant: "outline" })} onClick={() => setAssignDialogOpen(false)}>
              İptal
            </button>
            <button
              type="button"
              className={appButton()}
              onClick={handleAssignCustomer}
              disabled={pendingActions[`assign-${selectedCustomerId}`]}
            >
              {pendingActions[`assign-${selectedCustomerId}`] ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : (
                <UserPlus aria-hidden />
              )}
              Ata
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Mail, Plus, Trash2 } from "lucide-react";
import {
  AppBreadcrumbLabel,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  UsageMeter,
  appButton,
} from "@/components/app";
import {
  createEmailAccount,
  deleteEmailAccount,
} from "@/lib/actions/customer/email-accounts";
import { toast } from "@/lib/toast";

const QUOTA_OPTIONS = [
  { value: "250", label: "250 MB" },
  { value: "512", label: "512 MB" },
  { value: "1024", label: "1 GB" },
  { value: "2048", label: "2 GB" },
  { value: "5120", label: "5 GB" },
  { value: "10240", label: "10 GB" },
];

interface ServiceEmailAccount {
  id?: string;
  address: string;
  localPart: string;
  quotaMb: number;
  usedMb: number;
  status: string;
  createdAt?: string;
}

interface ServiceEpostaContentProps {
  serviceId: string;
  serviceName: string;
  serviceDomain: string;
  accounts: ServiceEmailAccount[];
}

function formatQuota(mb: number) {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${mb} MB`;
}

export function ServiceEpostaContent({
  serviceId,
  serviceName,
  serviceDomain,
  accounts,
}: ServiceEpostaContentProps) {
  const router = useRouter();
  const [items, setItems] = useState(accounts);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [localPart, setLocalPart] = useState("");
  const [password, setPassword] = useState("");
  const [quotaMb, setQuotaMb] = useState("2048");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingAddress, setDeletingAddress] = useState<string | null>(null);

  const previewAddress = useMemo(() => {
    const normalized = localPart.trim().toLowerCase();
    return normalized ? `${normalized}@${serviceDomain}` : `@${serviceDomain}`;
  }, [localPart, serviceDomain]);

  const handleCreate = async () => {
    if (isCreating) return;

    setIsCreating(true);
    const result = await createEmailAccount({
      serviceId,
      localPart,
      password,
      quotaMb: Number(quotaMb),
    });

    if (!result.success || !result.data) {
      toast.error(result.error ?? "E-posta hesabı oluşturulamadı");
      setIsCreating(false);
      return;
    }

    setItems((current) =>
      [...current, result.data!].sort((a, b) => a.address.localeCompare(b.address, "tr-TR"))
    );
    toast.success(`${result.data.address} oluşturuldu`);
    setIsCreateOpen(false);
    setLocalPart("");
    setPassword("");
    setQuotaMb("2048");
    router.refresh();
    setIsCreating(false);
  };

  const handleDelete = async (address: string) => {
    if (deletingAddress) return;

    const confirmed = window.confirm(`${address} hesabını silmek istediğinize emin misiniz?`);
    if (!confirmed) return;

    setDeletingAddress(address);
    const result = await deleteEmailAccount({ serviceId, address });

    if (!result.success) {
      toast.error(result.error ?? "E-posta hesabı silinemedi");
      setDeletingAddress(null);
      return;
    }

    setItems((current) => current.filter((item) => item.address !== address));
    toast.success(`${address} silindi`);
    router.refresh();
    setDeletingAddress(null);
  };

  const createDialog = (
    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <DialogTrigger asChild>
        <button type="button" className={appButton()}>
          <Plus aria-hidden />
          Yeni hesap
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>E-posta hesabı oluştur</DialogTitle>
          <DialogDescription>
            Hesap cPanel üzerinde oluşturulur ve bu hosting hizmetine bağlanır.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="local-part">Kullanıcı adı</Label>
            <div className="flex items-center gap-2">
              <Input
                id="local-part"
                placeholder="info"
                value={localPart}
                onChange={(event) => setLocalPart(event.target.value)}
              />
              <span className="whitespace-nowrap text-sm text-muted-foreground">@{serviceDomain}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Önizleme: <span className="font-mono">{previewAddress}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Şifre</Label>
            <Input
              id="password"
              type="password"
              placeholder="En az 8 karakter"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quota">Kota</Label>
            <Select value={quotaMb} onValueChange={setQuotaMb}>
              <SelectTrigger id="quota">
                <SelectValue placeholder="Kota seçin" />
              </SelectTrigger>
              <SelectContent>
                {QUOTA_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <button
            type="button"
            className={appButton({ variant: "outline" })}
            onClick={() => setIsCreateOpen(false)}
            disabled={isCreating}
          >
            Vazgeç
          </button>
          <button
            type="button"
            className={appButton()}
            onClick={() => void handleCreate()}
            disabled={isCreating || localPart.trim().length < 2 || password.length < 8}
          >
            {isCreating ? <Loader2 aria-hidden className="animate-spin" /> : null}
            {isCreating ? "Oluşturuluyor…" : "Oluştur"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      <AppBreadcrumbLabel segment={serviceId} label={serviceName} />

      <PageHeader
        back={{ href: `/musteri/panel/hizmetlerim/${serviceId}`, label: serviceName }}
        title="E-posta hesapları"
        description={`${serviceName} · ${serviceDomain}`}
        actions={createDialog}
      />

      <StatGrid columns={3}>
        <StatCard label="Toplam hesap" value={items.length} />
        <StatCard label="Alan adı" value={<span className="block truncate text-lg md:text-xl">{serviceDomain}</span>} />
        <StatCard
          label="Toplam kota"
          value={formatQuota(items.reduce((sum, item) => sum + item.quotaMb, 0))}
          className="col-span-2 lg:col-span-1"
        />
      </StatGrid>

      <SectionCard title="Hesaplar" flush>
        {items.length === 0 ? (
          <EmptyState
            compact
            className="m-4"
            icon={Mail}
            title="Henüz e-posta hesabı yok"
            description={`${serviceDomain} için ilk e-posta adresinizi oluşturabilirsiniz.`}
          />
        ) : (
          <ul className="divide-y">
            {items.map((account) => (
              <li
                key={account.address}
                className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center md:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-mono text-[13px] font-medium">{account.address}</p>
                    <StatusBadge kind="emailAccount" status={account.status} />
                  </div>
                  <UsageMeter
                    className="mt-2 max-w-sm"
                    label="Kullanım"
                    used={Math.round(account.usedMb)}
                    limit={account.quotaMb}
                    unit="MB"
                  />
                </div>
                <button
                  type="button"
                  className={appButton({ variant: "destructive", size: "sm", className: "self-start sm:self-center" })}
                  onClick={() => void handleDelete(account.address)}
                  disabled={deletingAddress === account.address}
                  aria-label={`${account.address} hesabını sil`}
                >
                  {deletingAddress === account.address ? (
                    <Loader2 aria-hidden className="animate-spin" />
                  ) : (
                    <Trash2 aria-hidden />
                  )}
                  Sil
                </button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

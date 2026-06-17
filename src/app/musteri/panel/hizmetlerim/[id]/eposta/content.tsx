"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  ArrowLeft,
  Mail,
  Plus,
  Trash2,
  Loader2,
  HardDrive,
  Globe,
} from "lucide-react";
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

  return (
    <div className="space-y-6">
      <BlurFade delay={0.1} inView>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href={`/musteri/panel/hizmetlerim/${serviceId}`}>
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">E-posta Hesapları</h1>
              <p className="text-muted-foreground">
                {serviceName} · {serviceDomain}
              </p>
            </div>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Yeni Hesap
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>E-posta Hesabı Oluştur</DialogTitle>
                <DialogDescription>
                  Hesap cPanel üzerinde oluşturulur ve bu hosting hizmetine bağlanır.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="local-part">Kullanıcı Adı</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="local-part"
                      placeholder="info"
                      value={localPart}
                      onChange={(event) => setLocalPart(event.target.value)}
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      @{serviceDomain}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Önizleme: {previewAddress}</p>
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
                  <Label>Kota</Label>
                  <Select value={quotaMb} onValueChange={setQuotaMb}>
                    <SelectTrigger>
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

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>
                  Vazgeç
                </Button>
                <Button
                  onClick={() => void handleCreate()}
                  disabled={isCreating || localPart.trim().length < 2 || password.length < 8}
                >
                  {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isCreating ? "Oluşturuluyor..." : "Oluştur"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </BlurFade>

      <BlurFade delay={0.15} inView>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Hesap</p>
                  <p className="text-2xl font-bold">{items.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Globe className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Domain</p>
                  <p className="text-lg font-semibold">{serviceDomain}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <HardDrive className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Kota</p>
                  <p className="text-lg font-semibold">
                    {formatQuota(items.reduce((sum, item) => sum + item.quotaMb, 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </BlurFade>

      <BlurFade delay={0.2} inView>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Hesaplar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Bu hizmet için henüz e-posta hesabı yok.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((account) => (
                  <div
                    key={account.address}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold">{account.address}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Kota: {formatQuota(account.quotaMb)}
                        {account.usedMb > 0 ? ` · Kullanım: ${formatQuota(account.usedMb)}` : ""}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => void handleDelete(account.address)}
                      disabled={deletingAddress === account.address}
                    >
                      {deletingAddress === account.address ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Sil
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </BlurFade>
    </div>
  );
}
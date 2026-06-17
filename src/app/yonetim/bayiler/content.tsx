"use client";

import { useMemo, useState } from "react";
import {
  Store,
  Search,
  Users,
  Percent,
  UserPlus,
  Loader2,
} from "lucide-react";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
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

const statusConfig: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Aktif", color: "bg-green-500/10 text-green-500" },
  SUSPENDED: { label: "Askıda", color: "bg-orange-500/10 text-orange-500" },
  CLOSED: { label: "Kapalı", color: "bg-red-500/10 text-red-500" },
};

export function BayilerContent({ resellers, customers }: BayilerContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [discountDrafts, setDiscountDrafts] = useState<Record<string, string>>({});
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedResellerId, setSelectedResellerId] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  const filteredResellers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return resellers;
    }

    return resellers.filter(
      (reseller) =>
        reseller.name.toLowerCase().includes(query) ||
        reseller.email.toLowerCase().includes(query)
    );
  }, [resellers, searchQuery]);

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

  return (
    <div className="space-y-6">
      <BlurFade delay={0.1} inView>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bayi Yönetimi</h1>
            <p className="text-muted-foreground">
              Bayileri yönetin, indirim oranlarını ayarlayın ve müşteri atayın.
            </p>
          </div>
          <Button onClick={() => setAssignDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Müşteri Ata
          </Button>
        </div>
      </BlurFade>

      <BlurFade delay={0.15} inView>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Store className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Toplam Bayi</p>
                  <p className="text-2xl font-bold">{resellers.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-500/10 p-2">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Alt Müşteri</p>
                  <p className="text-2xl font-bold">{totalCustomers}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-500/10 p-2">
                  <Percent className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ort. İndirim</p>
                  <p className="text-2xl font-bold">
                    %
                    {resellers.length > 0
                      ? (
                          resellers.reduce((sum, item) => sum + item.discountPercent, 0) /
                          resellers.length
                        ).toFixed(1)
                      : "0"}
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
            <CardTitle>Bayi Listesi</CardTitle>
            <CardDescription>Aktif bayiler ve indirim oranları</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Bayi adı veya e-posta ara..."
                className="pl-9"
              />
            </div>

            <div className="space-y-3">
              {filteredResellers.map((reseller) => {
                const status = statusConfig[reseller.status] ?? statusConfig.ACTIVE;
                const discountValue =
                  discountDrafts[reseller.id] ?? String(reseller.discountPercent);

                return (
                  <div
                    key={reseller.id}
                    className="rounded-lg border p-4 space-y-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{reseller.name}</p>
                          <Badge className={cn("font-normal", status.color)}>
                            {status.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{reseller.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {reseller.customerCount} alt müşteri · Kayıt:{" "}
                          {new Date(reseller.createdAt).toLocaleDateString("tr-TR")}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={discountValue}
                          onChange={(event) =>
                            setDiscountDrafts((current) => ({
                              ...current,
                              [reseller.id]: event.target.value,
                            }))
                          }
                          className="w-28"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                        <Button
                          size="sm"
                          onClick={() => handleDiscountUpdate(reseller.id)}
                          disabled={pendingActions[`discount-${reseller.id}`]}
                        >
                          {pendingActions[`discount-${reseller.id}`] ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Kaydet"
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredResellers.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  Henüz bayi bulunmuyor. Aşağıdan müşterileri bayi olarak etkinleştirebilirsiniz.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      <BlurFade delay={0.25} inView>
        <Card>
          <CardHeader>
            <CardTitle>Bayi Olarak Etkinleştir</CardTitle>
            <CardDescription>
              Müşterileri bayi hesabına dönüştürün veya devre dışı bırakın.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {customers.slice(0, 20).map((customer) => (
              <div
                key={customer.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-sm text-muted-foreground">{customer.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  {customer.isReseller ? (
                    <Badge className="bg-primary/10 text-primary">Bayi</Badge>
                  ) : customer.parentResellerId ? (
                    <Badge variant="outline">Atanmış müşteri</Badge>
                  ) : null}
                  <Switch
                    checked={customer.isReseller}
                    disabled={pendingActions[`toggle-${customer.id}`]}
                    onCheckedChange={(checked) => handleToggleReseller(customer, checked)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </BlurFade>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Müşteri Ata</DialogTitle>
            <DialogDescription>
              Bir müşteriyi seçili bayiye alt müşteri olarak bağlayın.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Bayi</Label>
              <Select value={selectedResellerId} onValueChange={setSelectedResellerId}>
                <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <Label>Müşteri</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger>
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
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              İptal
            </Button>
            <Button
              onClick={handleAssignCustomer}
              disabled={pendingActions[`assign-${selectedCustomerId}`]}
            >
              {pendingActions[`assign-${selectedCustomerId}`] ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Ata
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FormField, appButton } from "@/components/app";
import { updateCustomer } from "@/lib/actions/admin/customers";
import { toast } from "@/lib/toast";

type EditableCustomer = {
  id: string;
  name: string;
  surname: string;
  phone: string | null;
  customerType: string | null;
  companyName: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
  address: string | null;
  city: string | null;
};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** "Düzenle" dialog → `updateCustomer(id, formData)` with the same field names as before. */
export function EditCustomerDialog({ customer }: { customer: EditableCustomer }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (saving) return;
    const fd = new FormData(e.currentTarget);
    const formData = new FormData();
    for (const key of ["name", "surname", "phone", "customerType", "companyName", "taxNumber", "taxOffice", "address", "city"]) {
      formData.set(key, String(fd.get(key) ?? "").trim());
    }

    setSaving(true);
    const result = await updateCustomer(customer.id, formData);
    setSaving(false);
    if (!result.success) {
      toast.error(result.error ?? "Müşteri güncellenemedi");
      return;
    }
    toast.success("Müşteri bilgileri güncellendi");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className={appButton({ variant: "outline" })}>
          <Pencil aria-hidden />
          Düzenle
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Müşteri bilgilerini düzenle</DialogTitle>
          <DialogDescription>E-posta adresi ve şifre bu formdan değiştirilemez.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Ad" htmlFor="edit-name" required>
              <Input id="edit-name" name="name" defaultValue={customer.name} required />
            </FormField>
            <FormField label="Soyad" htmlFor="edit-surname" required>
              <Input id="edit-surname" name="surname" defaultValue={customer.surname} required />
            </FormField>
            <FormField label="Telefon" htmlFor="edit-phone">
              <Input id="edit-phone" name="phone" type="tel" defaultValue={customer.phone ?? ""} />
            </FormField>
            <FormField label="Müşteri tipi" htmlFor="edit-type">
              <select id="edit-type" name="customerType" defaultValue={customer.customerType ?? "INDIVIDUAL"} className={selectClass}>
                <option value="INDIVIDUAL">Bireysel</option>
                <option value="CORPORATE">Kurumsal</option>
              </select>
            </FormField>
          </div>
          <FormField label="Firma adı" htmlFor="edit-company">
            <Input id="edit-company" name="companyName" defaultValue={customer.companyName ?? ""} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Vergi numarası" htmlFor="edit-tax">
              <Input id="edit-tax" name="taxNumber" inputMode="numeric" defaultValue={customer.taxNumber ?? ""} />
            </FormField>
            <FormField label="Vergi dairesi" htmlFor="edit-office">
              <Input id="edit-office" name="taxOffice" defaultValue={customer.taxOffice ?? ""} />
            </FormField>
          </div>
          <FormField label="Adres" htmlFor="edit-address">
            <Input id="edit-address" name="address" defaultValue={customer.address ?? ""} />
          </FormField>
          <FormField label="Şehir" htmlFor="edit-city">
            <Input id="edit-city" name="city" defaultValue={customer.city ?? ""} />
          </FormField>
          <DialogFooter className="gap-2 sm:gap-2">
            <button type="button" className={appButton({ variant: "outline" })} onClick={() => setOpen(false)}>
              Vazgeç
            </button>
            <button type="submit" className={appButton()} disabled={saving}>
              {saving ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

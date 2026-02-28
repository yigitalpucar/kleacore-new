"use client";

import { useRouter } from "next/navigation";
import {
  activateCustomer,
  deleteCustomer,
  suspendCustomer,
} from "@/lib/actions/admin/customers";
import { toast } from "@/lib/toast";

export function useCustomerActions() {
  const router = useRouter();

  const handleSuspendCustomer = async (customerId: string) => {
    const confirmed = window.confirm(
      "Bu müşteriyi askıya almak istediğinize emin misiniz?"
    );
    if (!confirmed) return;

    const result = await suspendCustomer(customerId);
    if (!result.success) {
      toast.error(result.error ?? "Müşteri askıya alınamadı");
      return;
    }

    toast.success("Müşteri askıya alındı");
    router.refresh();
  };

  const handleActivateCustomer = async (customerId: string) => {
    const result = await activateCustomer(customerId);
    if (!result.success) {
      toast.error(result.error ?? "Müşteri aktifleştirilemedi");
      return;
    }

    toast.success("Müşteri aktifleştirildi");
    router.refresh();
  };

  const handleCloseCustomer = async (customerId: string) => {
    const confirmed = window.confirm(
      "Bu müşterinin hesabını kapatmak istediğinize emin misiniz?"
    );
    if (!confirmed) return;

    const result = await deleteCustomer(customerId);
    if (!result.success) {
      toast.error(result.error ?? "Müşteri hesabı kapatılamadı");
      return;
    }

    toast.success("Müşteri hesabı kapatıldı");
    router.refresh();
  };

  return {
    handleSuspendCustomer,
    handleActivateCustomer,
    handleCloseCustomer,
  };
}

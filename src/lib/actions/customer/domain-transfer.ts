"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import {
  getRegistrarConfig,
  isGriRegistrarEnabled,
} from "@/lib/integrations/registrar/config";
import {
  createManualDomainTransferTicket,
  processAutomatedDomainTransfer,
} from "@/lib/domains/transfer";
import type { DomainTransferInput } from "@/lib/domains/transfer";

export async function isAutomatedDomainTransferAvailable() {
  const session = await auth();
  if (!session?.user?.id) {
    return { isLoggedIn: false, isAutomatedTransferAvailable: false };
  }

  const config = await getRegistrarConfig();
  return {
    isLoggedIn: true,
    isAutomatedTransferAvailable: isGriRegistrarEnabled(config),
  };
}

export async function submitCustomerDomainTransfer(input: DomainTransferInput) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Giriş yapmalısınız" };
  }

  const customer = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      surname: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      country: true,
      companyName: true,
    },
  });

  if (!customer) {
    return { success: false, error: "Kullanıcı bulunamadı" };
  }

  const config = await getRegistrarConfig();
  if (isGriRegistrarEnabled(config)) {
    try {
      return await processAutomatedDomainTransfer(customer, input);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.startsWith("DOMAIN_TLD_NOT_FOUND")) {
          return { success: false, error: "Bu domain uzantısı için transfer fiyatı bulunamadı" };
        }
        if (error.message === "DOMAIN_TRANSFER_PRICE_UNAVAILABLE") {
          return { success: false, error: "Bu domain uzantısı için transfer fiyatı tanımlı değil" };
        }
        if (error.message === "DOMAIN_PRODUCT_NOT_FOUND") {
          return { success: false, error: "Domain ürünü yapılandırması eksik" };
        }
      }
      return { success: false, error: "Domain transferi başlatılırken bir hata oluştu" };
    }
  }

  return createManualDomainTransferTicket(customer, input);
}
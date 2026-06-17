"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  createServiceEmailAccount,
  deleteServiceEmailAccount,
  EmailProvisioningError,
  listServiceEmailAccounts,
} from "@/lib/integrations/email-provisioning";
import { requireCustomer } from "@/lib/utils/auth-helpers";

async function assertCustomerOwnsService(serviceId: string, customerId: string) {
  const service = await db.service.findUnique({
    where: { id: serviceId },
    select: {
      id: true,
      customerId: true,
      product: {
        select: {
          category: {
            select: { slug: true },
          },
        },
      },
    },
  });

  if (!service || service.customerId !== customerId) {
    return null;
  }

  return service;
}

function revalidateServiceEmailPaths(serviceId: string) {
  revalidatePath(`/musteri/panel/hizmetlerim/${serviceId}/eposta`);
  revalidatePath(`/musteri/panel/hizmetlerim/${serviceId}`);
  revalidatePath("/musteri/panel/webmail");
}

export async function createEmailAccount(input: {
  serviceId: string;
  localPart: string;
  password: string;
  quotaMb?: number;
}) {
  const session = await requireCustomer();

  try {
    const service = await assertCustomerOwnsService(input.serviceId, session.user.id);
    if (!service) {
      return { success: false, error: "Hizmet bulunamadı" };
    }

    const account = await createServiceEmailAccount(input);

    revalidateServiceEmailPaths(input.serviceId);

    return {
      success: true,
      data: account,
    };
  } catch (error) {
    if (error instanceof EmailProvisioningError) {
      return { success: false, error: error.message };
    }

    return { success: false, error: "E-posta hesabı oluşturulamadı" };
  }
}

export async function deleteEmailAccount(input: {
  serviceId: string;
  address: string;
}) {
  const session = await requireCustomer();

  try {
    const service = await assertCustomerOwnsService(input.serviceId, session.user.id);
    if (!service) {
      return { success: false, error: "Hizmet bulunamadı" };
    }

    const result = await deleteServiceEmailAccount(input);

    revalidateServiceEmailPaths(input.serviceId);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof EmailProvisioningError) {
      return { success: false, error: error.message };
    }

    return { success: false, error: "E-posta hesabı silinemedi" };
  }
}

export async function listEmailAccountsForService(serviceId: string) {
  const session = await requireCustomer();

  try {
    const service = await assertCustomerOwnsService(serviceId, session.user.id);
    if (!service) {
      return { success: false, error: "Hizmet bulunamadı" };
    }

    const accounts = await listServiceEmailAccounts(serviceId);

    return {
      success: true,
      data: accounts,
    };
  } catch (error) {
    if (error instanceof EmailProvisioningError) {
      return { success: false, error: error.message };
    }

    return { success: false, error: "E-posta hesapları listelenemedi" };
  }
}
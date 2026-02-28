"use server";

import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";
import type { DnsRecordType } from "@prisma/client";

interface DnsRecordInput {
  type: DnsRecordType;
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
}

export async function updateDnsRecords(
  domainId: string,
  records: DnsRecordInput[]
) {
  const session = await requireCustomer();

  try {
    const domain = await db.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      return { success: false, error: "Alan adı bulunamadı" };
    }

    if (domain.customerId !== session.user.id) {
      return { success: false, error: "Bu alan adına erişim yetkiniz yok" };
    }

    if (!Array.isArray(records)) {
      return { success: false, error: "Geçersiz DNS kayıt formatı" };
    }

    await db.$transaction([
      db.dnsRecord.deleteMany({ where: { domainId } }),
      ...(records.length > 0
        ? [
            db.dnsRecord.createMany({
              data: records.map((record) => ({
                domainId,
                type: record.type,
                name: record.name,
                value: record.value,
                ttl: record.ttl ?? 3600,
                priority: record.priority ?? null,
              })),
            }),
          ]
        : []),
    ]);

    revalidatePath(`/musteri/panel/domainler/${domainId}`);
    revalidatePath("/musteri/panel/domainler");
    return { success: true };
  } catch {
    return { success: false, error: "DNS kayıtları güncellenirken bir hata oluştu" };
  }
}

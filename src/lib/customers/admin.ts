/**
 * Staff customer create/update, shared by the admin server actions
 * (src/lib/actions/admin/customers.ts, FormData) and the admin API
 * (/api/admin/v1/customers, JSON). The caller checks customers.edit.
 */
import { generateUniqueAffiliateCode } from "@/lib/affiliate";
import { findUserByEmail, normalizeEmail } from "@/lib/auth/email";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/activity-log";
import { hash } from "bcryptjs";

export type CustomerType = "INDIVIDUAL" | "CORPORATE";

export interface CustomerProfileFields {
  phone?: string | null;
  customerType?: CustomerType;
  companyName?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  address?: string | null;
  city?: string | null;
}

export interface CreateCustomerInput extends CustomerProfileFields {
  email: string;
  password: string;
  name: string;
  surname?: string;
}

export type CustomerResult =
  | { success: true; data: { id: string } }
  | { success: false; error: string; status: number };

export async function createCustomerAccount(actorId: string, input: CreateCustomerInput): Promise<CustomerResult> {
  const email = normalizeEmail(input.email ?? "");
  if (!email || !input.password || !input.name) {
    return { success: false, error: "E-posta, şifre ve ad zorunludur", status: 422 };
  }

  const existing = await findUserByEmail(email);
  if (existing) {
    return { success: false, error: "Bu e-posta adresi zaten kayıtlı", status: 409 };
  }

  const hashedPassword = await hash(input.password, 12);

  const user = await db.$transaction(async (tx) => {
    const affiliateCode = await generateUniqueAffiliateCode(tx, input.name);

    return tx.user.create({
      data: {
        email,
        password: hashedPassword,
        name: input.name,
        surname: input.surname || "",
        phone: input.phone || null,
        customerType: input.customerType || "INDIVIDUAL",
        companyName: input.companyName || null,
        taxNumber: input.taxNumber || null,
        taxOffice: input.taxOffice || null,
        address: input.address || null,
        city: input.city || null,
        role: "CUSTOMER",
        status: "ACTIVE",
        affiliateCode,
        // Created by an admin: the address is vouched for, no verification mail.
        emailVerifiedAt: new Date(),
      },
    });
  });

  await logActivity({
    userId: actorId,
    action: "CREATE_CUSTOMER",
    entity: "User",
    entityId: user.id,
    details: {
      email: user.email,
      name: user.name,
      surname: user.surname,
      customerType: user.customerType,
    },
  });

  return { success: true, data: { id: user.id } };
}

/**
 * Updates the given profile fields (undefined = unchanged). Empty name /
 * surname are ignored, as in the admin form.
 */
export async function updateCustomerProfile(
  id: string,
  patch: CustomerProfileFields & { name?: string; surname?: string }
): Promise<CustomerResult> {
  const user = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) {
    return { success: false, error: "Müşteri bulunamadı", status: 404 };
  }

  await db.user.update({
    where: { id },
    data: {
      ...(patch.name && { name: patch.name }),
      ...(patch.surname && { surname: patch.surname }),
      ...(patch.customerType && { customerType: patch.customerType }),
      ...(patch.phone !== undefined && { phone: patch.phone }),
      ...(patch.companyName !== undefined && { companyName: patch.companyName }),
      ...(patch.taxNumber !== undefined && { taxNumber: patch.taxNumber }),
      ...(patch.taxOffice !== undefined && { taxOffice: patch.taxOffice }),
      ...(patch.address !== undefined && { address: patch.address }),
      ...(patch.city !== undefined && { city: patch.city }),
    },
  });

  return { success: true, data: { id } };
}

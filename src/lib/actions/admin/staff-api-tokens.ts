"use server";

import { revalidatePath } from "next/cache";
import { createStaffApiToken, revokeStaffApiToken, TokenError, type CreateTokenInput } from "@/lib/admin-api/tokens";
import { createLogger } from "@/lib/logger";
import { requireAnyPermission, requirePermission } from "@/lib/utils/auth-helpers";

const log = createLogger("admin.api-tokens");

type CreateResult =
  | { success: true; secret: string; token: { id: string; name: string; prefix: string } }
  | { success: false; error: string };

/** New Admin API token for the signed-in staff member; the secret is returned once. */
export async function createStaffApiTokenAction(input: CreateTokenInput): Promise<CreateResult> {
  const session = await requirePermission("api_tokens.manage");
  try {
    const { token, secret } = await createStaffApiToken({ id: session.user.id, role: session.user.role }, input);
    revalidatePath("/yonetim/api-tokenlari");
    revalidatePath("/yonetim/personel");
    return { success: true, secret, token: { id: token.id, name: token.name, prefix: token.tokenPrefix } };
  } catch (error) {
    if (error instanceof TokenError) return { success: false, error: error.message };
    log.error("create staff api token failed", { error });
    return { success: false, error: "Token oluşturulamadı" };
  }
}

/** Revokes an own token, or anyone's with staff.manage (/yonetim/personel). */
export async function revokeStaffApiTokenAction(tokenId: string): Promise<{ success: true; message: string } | { success: false; error: string }> {
  const session = await requireAnyPermission("api_tokens.manage", "staff.manage");
  try {
    await revokeStaffApiToken({ id: session.user.id, role: session.user.role }, tokenId);
    revalidatePath("/yonetim/api-tokenlari");
    revalidatePath("/yonetim/personel");
    return { success: true, message: "Token iptal edildi" };
  } catch (error) {
    if (error instanceof TokenError) return { success: false, error: error.message };
    log.error("revoke staff api token failed", { tokenId, error });
    return { success: false, error: "Token iptal edilemedi" };
  }
}

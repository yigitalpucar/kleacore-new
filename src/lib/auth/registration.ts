import { hash } from "bcryptjs";
import { createCustomerUser } from "@/lib/affiliate";
import { findUserByEmail } from "@/lib/auth/email";
import { sendVerificationEmail } from "@/lib/auth/email-verification";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { getCurrentLegalDocument, recordKvkkAcknowledgement } from "@/lib/legal/documents";
import { TURNSTILE_ERROR_MESSAGE, verifyTurnstileToken } from "@/lib/security/turnstile";

export const REGISTER_CAPTCHA_ACTION = "register";
export const KVKK_REQUIRED_MESSAGE = "Devam etmek için KVKK Aydınlatma Metni'ni okuduğunuzu onaylayın.";

export interface RegisterCustomerInput {
  name: string;
  surname: string;
  email: string;
  phone?: string | null;
  /** Plain password, already validated by registerSchema. */
  password: string;
  kvkkAccepted: boolean;
  turnstileToken: string | null;
  refCode?: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export type RegisterCustomerResult =
  | { success: true; userId: string }
  | { success: false; error: string; status: 400 | 403 | 409 | 500 };

/**
 * Self-service sign-up shared by the register server action and
 * POST /api/auth/register: Turnstile, KVKK acknowledgement, the account (with
 * emailVerifiedAt null) and the verification e-mail.
 */
export async function registerCustomerAccount(input: RegisterCustomerInput): Promise<RegisterCustomerResult> {
  if (!input.kvkkAccepted) {
    return { success: false, error: KVKK_REQUIRED_MESSAGE, status: 400 };
  }

  const captcha = await verifyTurnstileToken(input.turnstileToken, {
    remoteIp: input.ipAddress,
    action: REGISTER_CAPTCHA_ACTION,
  });
  if (!captcha.success) {
    return { success: false, error: TURNSTILE_ERROR_MESSAGE, status: 403 };
  }

  try {
    if (await findUserByEmail(input.email)) {
      return { success: false, error: "Bu e-posta adresi zaten kayıtlı", status: 409 };
    }

    const hashedPassword = await hash(input.password, 12);
    const kvkkDocument = await getCurrentLegalDocument("KVKK_NOTICE");

    const user = await db.$transaction(async (tx) => {
      const created = await createCustomerUser(
        tx,
        {
          name: input.name,
          surname: input.surname,
          email: input.email,
          phone: input.phone ?? null,
          password: hashedPassword,
        },
        input.refCode
      );
      await recordKvkkAcknowledgement(tx, {
        userId: created.id,
        document: kvkkDocument,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
      await emitEvent(
        tx,
        "user.registered",
        { userId: created.id, email: input.email, name: `${input.name} ${input.surname}`.trim(), source: "signup" },
        { actorId: created.id }
      );
      return created;
    });

    await sendVerificationEmail(user.id);

    return { success: true, userId: user.id };
  } catch (error) {
    console.error("[Register] error:", error);
    return { success: false, error: "Kayıt sırasında bir hata oluştu", status: 500 };
  }
}

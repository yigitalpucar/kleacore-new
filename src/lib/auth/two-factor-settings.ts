import { buildTwoFactorChallenge } from "@/lib/auth/two-factor";
import { db } from "@/lib/db";
import { getSettingValue, isEnabled } from "@/lib/integrations/settings";

export async function isTwoFactorGloballyEnabled() {
  const value = await getSettingValue("two_factor", undefined, "true");
  return isEnabled(value);
}

export async function createLoginTwoFactorChallenge(email: string, userId: string) {
  const globallyEnabled = await isTwoFactorGloballyEnabled();
  if (!globallyEnabled) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      twoFactorEnabled: true,
    },
  });

  if (!user?.twoFactorEnabled) {
    return null;
  }

  return buildTwoFactorChallenge(userId, email);
}

/** Whether a password alone is NOT enough for this user to sign in. */
export async function userRequiresTwoFactor(user: { twoFactorEnabled: boolean }) {
  if (!user.twoFactorEnabled) {
    return false;
  }

  return isTwoFactorGloballyEnabled();
}

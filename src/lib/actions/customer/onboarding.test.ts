import { describe, expect, it, vi } from "vitest";

const { updateMany } = vi.hoisted(() => ({ updateMany: vi.fn().mockResolvedValue({ count: 1 }) }));
vi.mock("@/lib/db", () => ({ db: { user: { updateMany } } }));
vi.mock("@/lib/utils/auth-helpers", () => ({ requireCustomer: vi.fn().mockResolvedValue({ user: { id: "user_1" } }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { dismissOnboarding } from "./onboarding";

describe("dismissOnboarding", () => {
  it("stamps only the signed-in user's row, once", async () => {
    expect(await dismissOnboarding()).toEqual({ success: true });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: "user_1", onboardingDismissedAt: null },
      data: { onboardingDismissedAt: expect.any(Date) },
    });
  });
});

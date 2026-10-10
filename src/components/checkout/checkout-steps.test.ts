import { describe, expect, it } from "vitest";
import { checkoutStepStates } from "./checkout-steps";

describe("checkoutStepStates", () => {
  it("completes earlier steps and marks the current one", () => {
    expect(checkoutStepStates("bilgiler")).toEqual({
      sepet: "complete",
      bilgiler: "current",
      odeme: "upcoming",
      onay: "upcoming",
    });
  });

  it("marks a failed payment step and a fully confirmed order", () => {
    expect(checkoutStepStates("odeme", { error: true }).odeme).toBe("error");
    expect(Object.values(checkoutStepStates("onay", { allComplete: true }))).toEqual([
      "complete",
      "complete",
      "complete",
      "complete",
    ]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  runRemoteServerAction: vi.fn(),
  getVdsPanelView: vi.fn(),
  queueServerReinstall: vi.fn(),
  revealInitialCredentials: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { service: { findFirst: mocks.findFirst, update: mocks.update } } }));
vi.mock("@/lib/utils/auth-helpers", () => ({ requireCustomer: vi.fn().mockResolvedValue({ user: { id: "user_1" } }) }));
vi.mock("@/lib/integrations/provisioning-provider", () => ({ runRemoteServerAction: mocks.runRemoteServerAction }));
vi.mock("@/lib/activity-log", () => ({ logActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/modules/server-panel", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/modules/server-panel")>();
  return {
    parseSshKeysInput: actual.parseSshKeysInput,
    CredentialsError: actual.CredentialsError,
    getVdsPanelView: mocks.getVdsPanelView,
    queueServerReinstall: mocks.queueServerReinstall,
    revealInitialCredentials: mocks.revealInitialCredentials,
  };
});

import { CUSTOMER_STOPPED_REASON } from "@/lib/services/server-power";
import { reinstallServer, revealServerCredentials, startServer, stopServer } from "./servers";

const bound = {
  id: "svc_1",
  customerId: "user_1",
  status: "ACTIVE",
  suspendReason: null,
  moduleInstanceId: "mi_pve",
  remoteId: "1000",
  product: { category: { slug: "vds" } },
};

describe("customer server power actions", () => {
  beforeEach(() => {
    mocks.findFirst.mockReset();
    mocks.update.mockReset().mockResolvedValue({});
    mocks.runRemoteServerAction.mockReset();
  });

  it("does not mark a module-bound server stopped when Proxmox refused", async () => {
    mocks.findFirst.mockResolvedValue(bound);
    mocks.runRemoteServerAction.mockResolvedValue({ ok: false, error: "PROXMOX_POWER: HTTP 500" });

    const result = await stopServer("svc_1");

    expect(result).toMatchObject({ success: false });
    expect(result.error).not.toContain("PROXMOX");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("stops a bound server and records the customer stop reason", async () => {
    mocks.findFirst.mockResolvedValue(bound);
    mocks.runRemoteServerAction.mockResolvedValue({ ok: true });

    expect(await stopServer("svc_1")).toMatchObject({ success: true });
    expect(mocks.runRemoteServerAction).toHaveBeenCalledWith(bound, "stop");
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SUSPENDED", suspendReason: CUSTOMER_STOPPED_REASON }) })
    );
  });

  it("keeps refusing to start a billing-suspended server (no remote call)", async () => {
    mocks.findFirst.mockResolvedValue({ ...bound, status: "SUSPENDED", suspendReason: "Ödenmemiş fatura" });

    const result = await startServer("svc_1");

    expect(result).toMatchObject({ success: false, error: "Askıdaki sunucu, ödeme veya destek sonrası açılır" });
    expect(mocks.runRemoteServerAction).not.toHaveBeenCalled();
  });

  it("legacy (unbound) servers keep the old behaviour on a remote failure", async () => {
    mocks.findFirst.mockResolvedValue({ ...bound, moduleInstanceId: null, remoteId: null });
    mocks.runRemoteServerAction.mockResolvedValue({ ok: false, error: "VPS_DOWN" });

    expect(await stopServer("svc_1")).toMatchObject({ success: true });
    expect(mocks.update).toHaveBeenCalled();
  });
});

describe("credentials and reinstall", () => {
  beforeEach(() => {
    mocks.findFirst.mockReset().mockResolvedValue(bound);
    mocks.getVdsPanelView.mockReset().mockResolvedValue({
      hostname: "kc-abc",
      capabilities: { reinstall: true },
      reinstall: null,
    });
    mocks.queueServerReinstall.mockReset().mockResolvedValue({ id: "job", deduplicated: false });
    mocks.revealInitialCredentials.mockReset();
  });

  it("refuses to reveal credentials of a billing-suspended server", async () => {
    mocks.findFirst.mockResolvedValue({ ...bound, status: "SUSPENDED", suspendReason: "Ödenmemiş fatura" });
    expect(await revealServerCredentials("svc_1")).toMatchObject({ success: false });
    expect(mocks.revealInitialCredentials).not.toHaveBeenCalled();
  });

  it("reveals once and reports the second attempt", async () => {
    const { CredentialsError } = await import("@/lib/modules/server-panel");
    mocks.revealInitialCredentials
      .mockResolvedValueOnce({ username: "kleacore", password: "s3cret", ipAddress: "203.0.113.20", revealedAt: "x" })
      .mockRejectedValueOnce(new CredentialsError("ALREADY_REVEALED", "İlk giriş bilgileri daha önce gösterildi."));

    expect(await revealServerCredentials("svc_1")).toMatchObject({ success: true, credentials: { password: "s3cret" } });
    expect(await revealServerCredentials("svc_1")).toEqual({ success: false, error: "İlk giriş bilgileri daha önce gösterildi." });
  });

  it("requires the typed hostname and valid SSH keys before queueing a reinstall", async () => {
    expect(await reinstallServer("svc_1", { confirmation: "yanlis" })).toMatchObject({ success: false });
    expect(await reinstallServer("svc_1", { confirmation: "kc-abc", sshKeys: "not a key" })).toMatchObject({
      success: false,
      error: "1. satır geçerli bir OpenSSH açık anahtarı değil",
    });
    expect(mocks.queueServerReinstall).not.toHaveBeenCalled();

    expect(await reinstallServer("svc_1", { confirmation: "kc-abc", sshKeys: "ssh-ed25519 AAAAC3Nza me@pc" })).toEqual({ success: true });
    expect(mocks.queueServerReinstall).toHaveBeenCalledWith("svc_1", { sshKeys: ["ssh-ed25519 AAAAC3Nza me@pc"] });
  });

  it("does not queue a second reinstall while one is running", async () => {
    mocks.getVdsPanelView.mockResolvedValue({ hostname: "kc-abc", capabilities: { reinstall: true }, reinstall: { phase: "provision" } });
    expect(await reinstallServer("svc_1", { confirmation: "kc-abc" })).toEqual({ success: false, error: "Yeniden kurulum zaten sürüyor" });
  });
});

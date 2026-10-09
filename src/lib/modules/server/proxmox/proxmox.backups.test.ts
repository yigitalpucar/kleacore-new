process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryModuleState, makeServerContext, makeTestInstance, restoreFetch } from "../../testing";
import type { ServerAccountContext } from "../../contracts";
import {
  createProxmoxModule,
  ownerMarker,
  proxmoxModule,
  vmNameFor,
  type ProxmoxIpam,
  type ProxmoxModuleConfig,
  type ProxmoxProductOptions,
} from ".";
import { createFakePve } from "./fake-pve";
import { archiveFromTaskLog, backupVmidOf } from "./parse";

const SERVICE_ID = "cmabcdefgh0000svc123456";
const OTHER_SERVICE_ID = "cmzzzzzzzz0000svc999999";

const config = {
  apiUrl: "https://pve.test:8006",
  tokenId: "kleacore@pve!kleacore",
  tokenSecret: "pve-secret-0123456789",
  node: "pve",
  vmidStart: 1000,
  vmidEnd: 1009,
  taskTimeoutSeconds: 60,
};

function setup(overrides: { config?: Record<string, unknown>; serviceId?: string; remoteId?: string } = {}) {
  const pve = createFakePve();
  pve.install();
  const serviceId = overrides.serviceId ?? SERVICE_ID;
  pve.addVm({
    vmid: 1000,
    status: "running",
    config: {
      name: vmNameFor(serviceId),
      description: `${ownerMarker(serviceId)}\nVDS`,
      net0: "virtio=BC:24:11:00:00:01,bridge=vmbr0",
      ipconfig0: "ip=203.0.113.20/24,gw=203.0.113.1",
    },
  });

  let clock = 0;
  const runtime = {
    now: () => clock,
    sleep: async (ms: number) => {
      clock += ms;
    },
  };
  const ipam = {
    allocate: vi.fn<ProxmoxIpam["allocate"]>(async () => ({
      address: "203.0.113.30",
      prefix: 24,
      gateway: "203.0.113.1",
      dnsServers: ["203.0.113.2"],
      poolId: "pool_1",
      vlan: null,
    })),
    release: vi.fn<ProxmoxIpam["release"]>(async () => []),
  };
  const instance = makeTestInstance<ProxmoxModuleConfig>(proxmoxModule, { ...config, ...overrides.config });
  const subject = createProxmoxModule(instance, { runtime, ipam, generatePassword: () => "Pass1xxxxxxxxxxxxxxx" });
  const state = createMemoryModuleState();
  const options = proxmoxModule.productOptionsSchema!.parse({ templateVmid: 9000 }) as ProxmoxProductOptions;
  const ctx: ServerAccountContext<ProxmoxProductOptions> = {
    ...makeServerContext(instance, options, {
      id: serviceId,
      remoteId: overrides.remoteId ?? "1000",
      label: "VDS",
      product: { id: "prd_vds", sku: "VDS-1", name: "VDS", categorySlug: "vds" },
    }),
    state,
  };
  return { pve, subject, ctx, state, ipam };
}

describe("proxmox backups: parse helpers", () => {
  it("reads the VMID of dir and PBS archives", () => {
    expect(backupVmidOf("local:backup/vzdump-qemu-1000-2026_10_09-03_00_01.vma.zst")).toBe(1000);
    expect(backupVmidOf("pbs:backup/vm/1234/2026-10-09T00:00:01Z")).toBe(1234);
    expect(backupVmidOf("local:iso/ubuntu.iso")).toBeNull();
  });

  it("finds the archive in a vzdump task log", () => {
    expect(archiveFromTaskLog(["INFO: creating vzdump archive '/var/lib/vz/dump/vzdump-qemu-1000-x.vma.zst'"], "local")).toBe(
      "local:backup/vzdump-qemu-1000-x.vma.zst"
    );
    expect(archiveFromTaskLog(["INFO: creating Proxmox Backup Server archive 'vm/1000/2026-10-09T00:00:01Z'"], "pbs")).toBe(
      "pbs:backup/vm/1000/2026-10-09T00:00:01Z"
    );
  });
});

describe("proxmox backups: createBackup (vzdump)", () => {
  afterEach(() => restoreFetch());

  it("runs vzdump on the VM's node, polls the task and returns the archive found by its notes tag", async () => {
    const { pve, subject, ctx } = setup();
    pve.taskPolls = 2;
    const onStarted = vi.fn(async () => undefined);

    const result = await subject.createBackup!(ctx, { tag: "kleacore-backup:bk1", notes: "manuel", onStarted });

    expect(result).toMatchObject({ ok: true, data: { storage: "local", node: "pve", sizeBytes: 101 * 1024 * 1024 } });
    expect(result.data!.volid).toMatch(/^local:backup\/vzdump-qemu-1000-.*\.vma\.zst$/);
    const vzdump = pve.calls.find((call) => call.path === "/nodes/pve/vzdump")!;
    expect(Object.fromEntries(vzdump.params)).toEqual({
      vmid: "1000",
      storage: "local",
      mode: "snapshot",
      compress: "zstd",
      "notes-template": "kleacore-backup:bk1 manuel",
      remove: "0",
    });
    expect(onStarted).toHaveBeenCalledWith({ upid: result.data!.upid, node: "pve", storage: "local" });
    expect(pve.paths("GET")).toContain("GET /nodes/pve/storage/local/content");
    const content = pve.calls.find((call) => call.path === "/nodes/pve/storage/local/content")!;
    expect(content.params.get("content")).toBe("backup");
    expect(content.params.get("vmid")).toBe("1000");
  });

  it("uses the PBS storage when configured (no compress) and finds the archive through the task log", async () => {
    const { pve, subject, ctx } = setup({ config: { pbsStorage: "pbs-main" } });
    pve.ignoreNotes = true;

    const result = await subject.createBackup!(ctx, { tag: "kleacore-backup:bk2" });

    expect(result.ok).toBe(true);
    expect(result.data!.volid).toBe("pbs-main:backup/vm/1000/2026-10-09T00:00:01Z");
    const vzdump = pve.calls.find((call) => call.path === "/nodes/pve/vzdump")!;
    expect(vzdump.params.get("storage")).toBe("pbs-main");
    expect(vzdump.params.has("compress")).toBe(false);
  });

  it("reports a still-running task as _RUNNING and resumes the same UPID without a second vzdump", async () => {
    const { pve, subject, ctx } = setup({ config: { taskTimeoutSeconds: 30 } });
    pve.taskPolls = 100;
    let upid = "";
    const first = await subject.createBackup!(ctx, {
      tag: "kleacore-backup:bk3",
      onStarted: async (task) => {
        upid = task.upid;
      },
    });
    expect(first.ok).toBe(false);
    expect(first.error).toMatch(/^PROXMOX_BACKUP_RUNNING:/);

    pve.taskPolls = 0;
    pve.tasks.get(upid)!.pollsLeft = 0;
    const second = await subject.createBackup!(ctx, { tag: "kleacore-backup:bk3", resumeUpid: upid });
    expect(second.ok).toBe(true);
    expect(pve.paths("POST").filter((path) => path.endsWith("/vzdump"))).toHaveLength(1);
  });

  it("returns ok: false when the vzdump task fails", async () => {
    const { pve, subject, ctx } = setup();
    pve.failNextBackup = "ERROR: Backup of VM 1000 failed - no space left on device";
    const result = await subject.createBackup!(ctx, { tag: "kleacore-backup:bk4" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/^PROXMOX_BACKUP: .*no space left/);
  });

  it("shuts the VM down first for a final backup", async () => {
    const { pve, subject, ctx } = setup();
    const result = await subject.createBackup!(ctx, { tag: "kleacore-final:x", mode: "stop", shutdownFirst: true });
    expect(result.ok).toBe(true);
    const posts = pve.paths("POST");
    expect(posts.indexOf("POST /nodes/pve/qemu/1000/status/shutdown")).toBeLessThan(posts.indexOf("POST /nodes/pve/vzdump"));
    expect(pve.vms.get(1000)!.status).toBe("stopped");
  });

  it("refuses a VM that does not carry the service's owner marker", async () => {
    const { subject, ctx } = setup({ serviceId: OTHER_SERVICE_ID });
    const foreignCtx = { ...ctx, service: { ...ctx.service, id: SERVICE_ID } };
    const result = await subject.createBackup!(foreignCtx, { tag: "t" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/^PROXMOX_VM: .*bu hizmete ait değil/);
  });
});

describe("proxmox backups: list / delete", () => {
  afterEach(() => restoreFetch());

  it("lists only this VM's archives", async () => {
    const { pve, subject, ctx } = setup();
    pve.addArchive("local", { volid: "local:backup/vzdump-qemu-1000-a.vma.zst", vmid: 1000, size: 5, ctime: 1_791_000_000 });
    pve.addArchive("local", { volid: "local:backup/vzdump-qemu-1001-b.vma.zst", vmid: 1001, size: 6, ctime: 1_791_000_001 });

    const result = await subject.listBackups!(ctx);
    expect(result.ok).toBe(true);
    expect(result.data!.map((item) => item.volid)).toEqual(["local:backup/vzdump-qemu-1000-a.vma.zst"]);
    expect(result.data![0].createdAt).toEqual(new Date(1_791_000_000 * 1000));
  });

  it("deletes an archive (DELETE storage content, waits for the task); a missing one counts as deleted", async () => {
    const { pve, subject, ctx } = setup();
    pve.addArchive("local", { volid: "local:backup/vzdump-qemu-1000-a.vma.zst", vmid: 1000, size: 5, ctime: 1 });

    const deleted = await subject.deleteBackup!(ctx, { volid: "local:backup/vzdump-qemu-1000-a.vma.zst", vmid: 1000 });
    expect(deleted.ok).toBe(true);
    expect(pve.paths("DELETE")).toEqual(["DELETE /nodes/pve/storage/local/content/local:backup/vzdump-qemu-1000-a.vma.zst"]);
    expect(pve.archives("local")).toHaveLength(0);

    const again = await subject.deleteBackup!(ctx, { volid: "local:backup/vzdump-qemu-1000-a.vma.zst", vmid: 1000 });
    expect(again.ok).toBe(true);
  });

  it("refuses to delete an archive of another VM", async () => {
    const { pve, subject, ctx } = setup();
    const result = await subject.deleteBackup!(ctx, { volid: "local:backup/vzdump-qemu-1001-b.vma.zst", vmid: 1000 });
    expect(result.ok).toBe(false);
    expect(pve.paths("DELETE")).toEqual([]);
  });
});

describe("proxmox backups: restoreBackup (qmrestore into the same VMID)", () => {
  afterEach(() => restoreFetch());

  it("stops the VM, restores with force=1 and starts it again", async () => {
    const { pve, subject, ctx } = setup();
    pve.addArchive("local", {
      volid: "local:backup/vzdump-qemu-1000-a.vma.zst",
      vmid: 1000,
      size: 5,
      ctime: 1,
      config: { ...pve.vms.get(1000)!.config, memory: 512 },
    });

    const result = await subject.restoreBackup!(ctx, { volid: "local:backup/vzdump-qemu-1000-a.vma.zst" });

    expect(result.ok).toBe(true);
    expect(pve.paths("POST")).toEqual([
      "POST /nodes/pve/qemu/1000/status/stop",
      "POST /nodes/pve/qemu",
      "POST /nodes/pve/qemu/1000/status/start",
    ]);
    const restore = pve.calls.find((call) => call.method === "POST" && call.path === "/nodes/pve/qemu")!;
    expect(Object.fromEntries(restore.params)).toEqual({ vmid: "1000", archive: "local:backup/vzdump-qemu-1000-a.vma.zst", force: "1" });
    const vm = pve.vms.get(1000)!;
    expect(vm.config.restoredFrom).toBe("local:backup/vzdump-qemu-1000-a.vma.zst");
    expect(vm.status).toBe("running");
  });

  it("refuses an archive of another VM unless it is an explicit foreign restore", async () => {
    const { pve, subject, ctx } = setup();
    pve.addArchive("local", { volid: "local:backup/vzdump-qemu-1001-b.vma.zst", vmid: 1001, size: 5, ctime: 1 });
    const result = await subject.restoreBackup!(ctx, { volid: "local:backup/vzdump-qemu-1001-b.vma.zst" });
    expect(result.ok).toBe(false);
    expect(pve.paths("POST")).toEqual([]);
  });

  it("foreign restore (final backup into a new service) re-applies the new service's marker and network", async () => {
    const { pve, subject, ctx, ipam } = setup();
    pve.addArchive("local", {
      volid: "local:backup/vzdump-qemu-1001-b.vma.zst",
      vmid: 1001,
      size: 5,
      ctime: 1,
      config: { name: vmNameFor(OTHER_SERVICE_ID), description: ownerMarker(OTHER_SERVICE_ID), net0: "virtio=AA:AA:AA:00:00:01,bridge=vmbr0", ipconfig0: "ip=198.51.100.9/24,gw=198.51.100.1" },
    });

    const result = await subject.restoreBackup!(ctx, { volid: "local:backup/vzdump-qemu-1001-b.vma.zst", foreign: true });

    expect(result.ok).toBe(true);
    expect(ipam.allocate).toHaveBeenCalledWith(expect.objectContaining({ serviceId: SERVICE_ID }));
    const vm = pve.vms.get(1000)!;
    expect(String(vm.config.description)).toContain(ownerMarker(SERVICE_ID));
    expect(vm.config.name).toBe(vmNameFor(SERVICE_ID));
    expect(vm.config.ipconfig0).toBe("ip=203.0.113.30/24,gw=203.0.113.1");
    const restore = pve.calls.find((call) => call.method === "POST" && call.path === "/nodes/pve/qemu")!;
    expect(restore.params.get("unique")).toBe("1");
  });

  it("returns ok: false when the restore task fails", async () => {
    const { pve, subject, ctx } = setup();
    pve.addArchive("local", { volid: "local:backup/vzdump-qemu-1000-a.vma.zst", vmid: 1000, size: 5, ctime: 1 });
    pve.failNextRestore = "command 'vma extract' failed";
    const result = await subject.restoreBackup!(ctx, { volid: "local:backup/vzdump-qemu-1000-a.vma.zst" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/^PROXMOX_RESTORE: /);
  });
});

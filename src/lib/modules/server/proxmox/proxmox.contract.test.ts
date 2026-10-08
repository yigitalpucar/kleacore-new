process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptSecret } from "@/lib/secrets/crypto";
import {
  createFetchMock,
  createMemoryModuleState,
  describeModuleContract,
  makeServerContext,
  makeTestInstance,
  restoreFetch,
} from "../../testing";
import type { ServerAccountContext } from "../../contracts";
import {
  createProxmoxModule,
  ownerMarker,
  proxmoxModule,
  vmNameFor,
  type ProxmoxIpam,
  type ProxmoxModuleConfig,
  type ProxmoxProductOptions,
  type ProxmoxServiceState,
} from ".";
import { createFakePve } from "./fake-pve";
import { findBootDisk, parseSize, parseUsage, rewriteNet0 } from "./parse";

const config = {
  apiUrl: "https://pve.test:8006",
  tokenId: "kleacore@pve!kleacore",
  tokenSecret: "pve-secret-0123456789",
  node: "pve",
  vmidStart: 1000,
  vmidEnd: 1009,
  taskTimeoutSeconds: 60,
};

const productOptions = { templateVmid: 9000, cores: 2, memoryMB: 2048, diskGB: 40, osLabel: "Ubuntu 22.04 LTS" };

describeModuleContract(proxmoxModule, {
  config,
  productOptions,
  invalidProductOptions: { cores: 0 },
});

const SERVICE_ID = "cmabcdefgh0000svc123456";

function setup(overrides: { config?: Record<string, unknown>; state?: Record<string, unknown> } = {}) {
  const pve = createFakePve();
  pve.addTemplate(9000);
  pve.install();

  let clock = 0;
  const runtime = {
    now: () => clock,
    sleep: async (ms: number) => {
      clock += ms;
    },
  };
  const ipam = {
    allocate: vi.fn<ProxmoxIpam["allocate"]>(async () => ({
      address: "203.0.113.20",
      prefix: 24,
      gateway: "203.0.113.1",
      dnsServers: ["203.0.113.2", "203.0.113.3"],
      poolId: "pool_1",
      vlan: null,
    })),
    release: vi.fn<ProxmoxIpam["release"]>(async () => ["203.0.113.20"]),
  };
  let passwords = 0;
  const instance = makeTestInstance<ProxmoxModuleConfig>(proxmoxModule, { ...config, ...overrides.config });
  const subject = createProxmoxModule(instance, {
    runtime,
    ipam,
    generatePassword: () => `Pass${++passwords}xxxxxxxxxxxxxxx`,
  });
  const state = createMemoryModuleState(overrides.state);
  const parsed = proxmoxModule.productOptionsSchema!.parse(productOptions) as ProxmoxProductOptions;
  const ctx = (service: Partial<ServerAccountContext["service"]> = {}): ServerAccountContext<ProxmoxProductOptions> => ({
    ...makeServerContext(instance, parsed, {
      id: SERVICE_ID,
      remoteId: null,
      label: "VDS Başlangıç",
      product: { id: "prd_vds", sku: "VDS-1", name: "VDS Başlangıç", categorySlug: "vds" },
      ...service,
    }),
    state,
  });
  return { pve, ipam, subject, state, ctx, runtime };
}

function stateOf(state: { data: Record<string, unknown> }) {
  return state.data as ProxmoxServiceState;
}

describe("proxmox: createAccount pipeline (fake PVE)", () => {
  afterEach(() => restoreFetch());

  it("clones the template, polls the task, configures cloud-init, grows the disk and starts the VM", async () => {
    const { pve, ipam, subject, state, ctx } = setup();
    pve.taskPolls = 2;

    const result = await subject.createAccount(ctx());

    expect(result).toMatchObject({
      ok: true,
      data: { remoteId: "1000", ipAddress: "203.0.113.20", username: "kleacore", hostname: vmNameFor(SERVICE_ID) },
    });
    // The initial password is never returned (it lives encrypted in the service state).
    expect(JSON.stringify(result)).not.toContain("Pass1");
    expect(ipam.allocate).toHaveBeenCalledWith({ serviceId: SERVICE_ID, instanceId: "test-proxmox", poolId: undefined });
    expect(pve.calls.every((call) => call.authorization === `PVEAPIToken=${config.tokenId}=${config.tokenSecret}`)).toBe(true);

    expect(pve.paths("POST")).toEqual([
      "POST /nodes/pve/qemu/9000/clone",
      "POST /nodes/pve/qemu/1000/status/start",
    ]);
    const clone = pve.calls.find((call) => call.path.endsWith("/clone"))!.params;
    expect(Object.fromEntries(clone)).toMatchObject({
      newid: "1000",
      name: vmNameFor(SERVICE_ID),
      full: "1",
      storage: "local-lvm",
      description: ownerMarker(SERVICE_ID),
    });
    // Task polled until stopped.
    expect(pve.paths("GET").filter((path) => path.includes("/tasks/")).length).toBeGreaterThanOrEqual(3);

    const vm = pve.vms.get(1000)!;
    expect(vm.status).toBe("running");
    expect(vm.config).toMatchObject({
      name: vmNameFor(SERVICE_ID),
      tags: "kleacore",
      cores: 2,
      memory: 2048,
      onboot: 1,
      ciuser: "kleacore",
      cipassword: "Pass1xxxxxxxxxxxxxxx",
      ipconfig0: "ip=203.0.113.20/24,gw=203.0.113.1",
      nameserver: "203.0.113.2 203.0.113.3",
      scsi0: "local-lvm:vm-1000-disk-0,size=40G",
    });
    expect(String(vm.config.description)).toContain(ownerMarker(SERVICE_ID));
    expect(vm.config.sshkeys).toBeUndefined();
    expect(vm.config.kvm).toBeUndefined();
    // net0 already on vmbr0 without VLAN: MAC kept, not rewritten.
    expect(pve.calls.find((call) => call.method === "PUT" && call.path.endsWith("/config"))!.params.has("net0")).toBe(false);

    const saved = stateOf(state);
    expect(saved).toMatchObject({ vmid: 1000, node: "pve", step: "done", ipAddress: "203.0.113.20", osLabel: "Ubuntu 22.04 LTS" });
    expect(saved.passwordEnc).toMatch(/^enc:v1:/);
    expect(decryptSecret(saved.passwordEnc!)).toBe("Pass1xxxxxxxxxxxxxxx");
    expect(saved.lastError).toBeUndefined();
  });

  it("sends customer SSH keys URL-encoded, applies VLAN/bridge overrides and the test-only kvm: 0", async () => {
    const { pve, subject, ctx } = setup({
      config: { testDisableKvm: true },
      state: { sshKeys: ["ssh-ed25519 AAAAC3Nza test@kleacore"] },
    });
    const base = ctx();
    const result = await subject.createAccount({ ...base, options: { ...base.options, bridge: "vmbr1", vlan: 42 } });
    expect(result.ok).toBe(true);
    const put = pve.calls.find((call) => call.method === "PUT" && call.path.endsWith("/config"))!.params;
    expect(put.get("sshkeys")).toBe("ssh-ed25519%20AAAAC3Nza%20test%40kleacore");
    expect(put.get("net0")).toBe("virtio=BC:24:11:00:00:01,bridge=vmbr1,tag=42,firewall=1");
    expect(put.get("kvm")).toBe("0");
  });

  it("resumes after a failed start without cloning twice and keeps the same password", async () => {
    const { pve, subject, state, ctx, ipam } = setup();
    pve.failNextStart = "KVM virtualisation configured, but not available";

    const first = await subject.createAccount(ctx());
    expect(first.ok).toBe(false);
    expect(first.error).toMatch(/^PROXMOX_START: .*KVM virtualisation/);
    expect(stateOf(state)).toMatchObject({ vmid: 1000, step: "resized" });
    expect(stateOf(state).lastError).toMatch(/PROXMOX_START/);
    const passwordEnc = stateOf(state).passwordEnc;
    // A transient failure keeps the IP (the retry needs it).
    expect(ipam.release).not.toHaveBeenCalled();

    pve.calls.length = 0;
    const second = await subject.createAccount(ctx());
    expect(second).toMatchObject({ ok: true, data: { remoteId: "1000" } });
    expect(pve.paths("POST")).toEqual(["POST /nodes/pve/qemu/1000/status/start"]);
    expect(pve.paths().some((path) => path.endsWith("/resize"))).toBe(false); // already 40G
    expect(stateOf(state).passwordEnc).toBe(passwordEnc);
    expect(stateOf(state).lastError).toBeUndefined();
    expect(pve.vms.get(1000)!.status).toBe("running");
  });

  it("resumes a clone that outlived the task timeout by polling the same UPID", async () => {
    const { pve, subject, state, ctx } = setup({ config: { taskTimeoutSeconds: 30 } });
    pve.taskPolls = 50; // far longer than one attempt may wait

    const first = await subject.createAccount(ctx());
    expect(first.ok).toBe(false);
    expect(first.error).toMatch(/^PROXMOX_CLONE: .*bitmedi/);
    expect(stateOf(state)).toMatchObject({ vmid: 1000, step: "cloning" });
    const upid = stateOf(state).cloneUpid!;
    expect(upid).toMatch(/^UPID:pve:/);
    expect(pve.vms.get(1000)!.config.lock).toBe("clone");

    pve.tasks.get(upid)!.pollsLeft = 1;
    pve.taskPolls = 0;
    pve.calls.length = 0;
    const second = await subject.createAccount(ctx());
    expect(second).toMatchObject({ ok: true, data: { remoteId: "1000" } });
    expect(pve.paths().filter((path) => path.endsWith("/clone"))).toHaveLength(0);
    expect(pve.paths().some((path) => path.includes(encodeURIComponent(upid)) || path.includes(upid))).toBe(true);
    expect(pve.vms.size).toBe(2);
  });

  it("finds its VM by name + owner marker when the state was lost", async () => {
    const { pve, subject, ctx } = setup();
    pve.addVm({
      vmid: 1004,
      status: "stopped",
      config: {
        name: vmNameFor(SERVICE_ID),
        description: `${ownerMarker(SERVICE_ID)}\nVDS`,
        boot: "order=scsi0",
        scsi0: "local-lvm:vm-1004-disk-0,size=40G",
        net0: "virtio=BC:24:11:00:00:09,bridge=vmbr0",
      },
    });
    const result = await subject.createAccount(ctx());
    expect(result).toMatchObject({ ok: true, data: { remoteId: "1004" } });
    expect(pve.paths().some((path) => path.endsWith("/clone"))).toBe(false);
  });

  it("refuses to adopt a VM with its name but without the owner marker", async () => {
    const { pve, subject, ctx } = setup();
    pve.addVm({ vmid: 1003, config: { name: vmNameFor(SERVICE_ID), description: "someone else" } });
    const result = await subject.createAccount(ctx());
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/^PROXMOX_LOOKUP: .*bu hizmete ait değil/);
    expect(pve.paths().some((path) => path.endsWith("/clone"))).toBe(false);
  });

  it("skips used / reserved VMIDs and retries the clone on a VMID conflict", async () => {
    const { pve, subject, ctx } = setup();
    pve.addVm({ vmid: 1000, config: { name: "other-customer" } });
    pve.reservedIds.add(1001); // /cluster/nextid says taken
    pve.cloneConflicts.add(1002); // free at check time, taken by a parallel clone

    const result = await subject.createAccount(ctx());
    expect(result).toMatchObject({ ok: true, data: { remoteId: "1003" } });
    const clones = pve.calls.filter((call) => call.path.endsWith("/clone")).map((call) => call.params.get("newid"));
    expect(clones).toEqual(["1002", "1003"]);
  });

  it("fails cleanly when the VMID range is full or the template is missing", async () => {
    const full = setup({ config: { vmidStart: 1000, vmidEnd: 1000 } });
    full.pve.addVm({ vmid: 1000, config: { name: "x" } });
    expect((await full.subject.createAccount(full.ctx())).error).toMatch(/^PROXMOX_CLONE: VMID aralığında/);
    restoreFetch();

    const missing = setup();
    missing.pve.vms.delete(9000);
    expect((await missing.subject.createAccount(missing.ctx())).error).toMatch(/Şablon VM 9000 bulunamadı/);
  });

  it("fails without touching Proxmox when no IP can be allocated", async () => {
    const { pve, subject, ctx, ipam } = setup();
    ipam.allocate.mockRejectedValueOnce(new Error("Havuzda boş IP adresi kalmadı."));
    const result = await subject.createAccount(ctx());
    expect(result).toMatchObject({ ok: false, error: "PROXMOX_IP: Havuzda boş IP adresi kalmadı." });
    expect(pve.paths("POST")).toEqual([]);
  });
});

describe("proxmox: giving up releases the IP and flags the VM", () => {
  afterEach(() => restoreFetch());

  it("abandonProvisioning releases the service IPs and leaves the VM for the admin", async () => {
    const { pve, subject, state, ctx, ipam } = setup();
    pve.failNextStart = "KVM virtualisation configured, but not available";
    await subject.createAccount(ctx());

    const result = await subject.abandonProvisioning!(ctx());
    expect(result).toMatchObject({ ok: true, reference: "203.0.113.20" });
    expect(ipam.release).toHaveBeenCalledWith(SERVICE_ID);
    expect(pve.vms.has(1000)).toBe(true); // never deleted automatically
    expect(pve.paths("DELETE")).toEqual([]);
    expect(stateOf(state).needsAdmin).toMatch(/VM 1000 .* bırakıldı/);
    expect(stateOf(state).abandonedAt).toBeTruthy();
    expect(stateOf(state).ipAddress).toBeUndefined();
  });
});

describe("proxmox: operations on an existing VM", () => {
  afterEach(() => restoreFetch());

  async function provisioned() {
    const env = setup();
    const created = await env.subject.createAccount(env.ctx());
    expect(created.ok).toBe(true);
    env.pve.calls.length = 0;
    return { ...env, vmCtx: () => env.ctx({ remoteId: "1000" }) };
  }

  it("maps power actions to PVE endpoints", async () => {
    const { pve, subject, vmCtx } = await provisioned();

    expect(await subject.powerAction!(vmCtx(), "restart")).toMatchObject({ ok: true, reference: "1000" });
    expect(await subject.powerAction!(vmCtx(), "stop")).toMatchObject({ ok: true });
    expect(pve.vms.get(1000)!.status).toBe("stopped");
    expect(await subject.powerAction!(vmCtx(), "stop")).toMatchObject({ ok: true }); // idempotent: no call
    expect(await subject.powerAction!(vmCtx(), "start")).toMatchObject({ ok: true });
    expect(await subject.powerAction!(vmCtx(), "shutdown")).toMatchObject({ ok: true });

    const posts = pve.calls.filter((call) => call.method === "POST");
    expect(posts.map((call) => call.path)).toEqual([
      "/nodes/pve/qemu/1000/status/reboot",
      "/nodes/pve/qemu/1000/status/shutdown",
      "/nodes/pve/qemu/1000/status/start",
      "/nodes/pve/qemu/1000/status/shutdown",
    ]);
    expect(Object.fromEntries(posts[1].params)).toEqual({ timeout: "60", forceStop: "1" });
    expect(Object.fromEntries(posts[3].params)).toEqual({ timeout: "120" });
  });

  it("reports a failed power task", async () => {
    const { pve, subject, vmCtx } = await provisioned();
    await subject.powerAction!(vmCtx(), "stop");
    pve.failNextStart = "start failed: QEMU exited with code 1";
    const result = await subject.powerAction!(vmCtx(), "start");
    expect(result).toMatchObject({ ok: false });
    expect(result.error).toMatch(/^PROXMOX_POWER: .*QEMU exited/);
  });

  it("never touches a VM that does not carry the service's owner marker", async () => {
    const { pve, subject, ctx } = await provisioned();
    pve.addVm({ vmid: 1005, status: "running", config: { name: "foreign", description: "not ours" } });
    const foreign = ctx({ remoteId: "1005" });
    for (const result of [
      await subject.powerAction!(foreign, "stop"),
      await subject.suspend(foreign),
      await subject.terminate(foreign),
    ]) {
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/bu hizmete ait değil/);
    }
    expect(pve.vms.get(1005)!.status).toBe("running");
    expect(pve.paths("POST").concat(pve.paths("DELETE"))).toEqual([]);
  });

  it("suspend stops the VM and disables onboot; unsuspend reverses it", async () => {
    const { pve, subject, state, vmCtx } = await provisioned();
    expect(await subject.suspend(vmCtx(), "Ödenmemiş fatura")).toMatchObject({ ok: true });
    expect(pve.vms.get(1000)).toMatchObject({ status: "stopped", config: { onboot: 0 } });
    expect(stateOf(state).suspendedAt).toBeTruthy();

    expect(await subject.unsuspend(vmCtx())).toMatchObject({ ok: true });
    expect(pve.vms.get(1000)).toMatchObject({ status: "running", config: { onboot: 1 } });
    expect(stateOf(state).suspendedAt).toBeUndefined();
  });

  it("terminate stops and destroys the VM with purge; a missing VM counts as done", async () => {
    const { pve, subject, vmCtx } = await provisioned();
    expect(await subject.terminate(vmCtx())).toMatchObject({ ok: true, reference: "1000" });
    expect(pve.vms.has(1000)).toBe(false);
    const del = pve.calls.find((call) => call.method === "DELETE")!;
    expect(del.path).toBe("/nodes/pve/qemu/1000");
    expect(Object.fromEntries(del.params)).toEqual({ purge: "1", "destroy-unreferenced-disks": "1" });
    expect(pve.paths("POST")).toEqual(["POST /nodes/pve/qemu/1000/status/stop"]);

    expect(await subject.terminate(vmCtx())).toMatchObject({ ok: true });
  });

  it("changePackage updates CPU/RAM and grows the disk", async () => {
    const { pve, subject, vmCtx } = await provisioned();
    const ctx = vmCtx();
    const result = await subject.changePackage({ ...ctx, options: { ...ctx.options, cores: 4, memoryMB: 8192, diskGB: 80 } });
    expect(result.ok).toBe(true);
    expect(pve.vms.get(1000)!.config).toMatchObject({ cores: 4, memory: 8192, scsi0: "local-lvm:vm-1000-disk-0,size=80G" });
  });

  it("reinstall re-clones into the same VMID with the same IP and a new password", async () => {
    const { pve, subject, state, vmCtx, ipam } = await provisioned();
    await state.patch({ credentialsRevealedAt: "2026-10-01T00:00:00.000Z" });
    const before = stateOf(state).passwordEnc;

    const result = await subject.reinstall!(vmCtx(), { sshKeys: ["ssh-ed25519 AAAA new"] });
    expect(result).toMatchObject({ ok: true, reference: "1000" });
    expect(pve.paths()).toEqual(
      expect.arrayContaining(["DELETE /nodes/pve/qemu/1000", "POST /nodes/pve/qemu/9000/clone", "POST /nodes/pve/qemu/1000/status/start"])
    );
    expect(pve.calls.find((call) => call.path.endsWith("/clone"))!.params.get("newid")).toBe("1000");
    expect(pve.vms.get(1000)).toMatchObject({ status: "running", config: { ipconfig0: "ip=203.0.113.20/24,gw=203.0.113.1" } });
    expect(ipam.allocate).toHaveBeenLastCalledWith(expect.objectContaining({ serviceId: SERVICE_ID }));
    const after = stateOf(state);
    expect(after.passwordEnc).not.toBe(before);
    expect(after.credentialsRevealedAt).toBeUndefined();
    expect(after.reinstall).toMatchObject({ phase: "done" });
    expect(after.sshKeys).toEqual(["ssh-ed25519 AAAA new"]);
  });

  it("reinstall resumes after the destroy phase without destroying again", async () => {
    const { pve, subject, state, vmCtx } = await provisioned();
    pve.failNextStart = "KVM not available";
    expect((await subject.reinstall!(vmCtx(), {})).ok).toBe(false);
    expect(stateOf(state).reinstall).toMatchObject({ phase: "provision" });

    pve.calls.length = 0;
    expect(await subject.reinstall!(vmCtx(), {})).toMatchObject({ ok: true });
    expect(pve.paths("DELETE")).toEqual([]);
    expect(pve.paths().some((path) => path.endsWith("/clone"))).toBe(false);
  });

  it("getUsage reads status/current and month traffic from rrddata", async () => {
    const { pve, subject, vmCtx, runtime } = await provisioned();
    void runtime;
    const now = Date.now() / 1000;
    pve.rrd = [
      { time: now - 3 * 3600, netin: 1000, netout: 1000 },
      { time: now - 2 * 3600, netin: 1000, netout: 1000 },
    ];
    const result = await subject.getUsage!(vmCtx());
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ cpuPercent: 12.5, ramUsedMB: 512, ramLimitMB: 2048, diskLimitMB: 40960, powerState: "running" });
  });

  it("listAccounts lists non-template VMs and marks KLEACORE-managed ones", async () => {
    const { subject } = await provisioned();
    const result = await subject.listAccounts!();
    expect(result.data).toEqual([
      expect.objectContaining({ remoteId: "1000", status: "active", raw: expect.objectContaining({ managed: true }) }),
    ]);
  });
});

describe("proxmox: health check", () => {
  afterEach(() => restoreFetch());

  it("reads version and node status with the API token", async () => {
    const { calls } = createFetchMock([
      { method: "GET", url: "https://pve.test:8006/api2/json/version", json: { data: { version: "9.0.3", release: "9.0" } } },
      { method: "GET", url: "https://pve.test:8006/api2/json/nodes/pve/status", json: { data: { uptime: 99 } } },
    ]);
    const health = await proxmoxModule.healthCheck(makeTestInstance(proxmoxModule, config));
    expect(health).toMatchObject({ ok: true, message: "Proxmox VE 9.0.3 · node pve çevrimiçi." });
    expect(calls[0].headers.get("authorization")).toBe("PVEAPIToken=kleacore@pve!kleacore=pve-secret-0123456789");
  });

  it("explains a rejected token without leaking it", async () => {
    createFetchMock([{ url: "https://pve.test:8006/api2/json/*", status: 401, json: { data: null } }]);
    const health = await proxmoxModule.healthCheck(makeTestInstance(proxmoxModule, config));
    expect(health.ok).toBe(false);
    expect(health.message).toMatch(/HTTP 401 \(API token reddedildi\)/);
    expect(health.message).not.toContain("pve-secret");
  });

  it("rejects an inverted VMID range", async () => {
    const health = await proxmoxModule.healthCheck(makeTestInstance(proxmoxModule, { ...config, vmidStart: 2000, vmidEnd: 1000 }));
    expect(health).toMatchObject({ ok: false });
  });
});

describe("proxmox: payload parsing", () => {
  it("parses disk sizes", () => {
    expect(parseSize("10G")).toBe(10 * 1024 ** 3);
    expect(parseSize("2252M")).toBe(2252 * 1024 ** 2);
    expect(parseSize("nope")).toBeNull();
  });

  it("finds the boot disk, skipping cloud-init and CD-ROM drives", () => {
    expect(
      findBootDisk({
        boot: "order=ide2;virtio0;net0",
        ide2: "local:iso/ubuntu.iso,media=cdrom",
        virtio0: "local-lvm:vm-1-disk-0,size=20G",
        scsi1: "local-lvm:vm-1-cloudinit,media=cdrom",
      })
    ).toEqual({ key: "virtio0", sizeBytes: 20 * 1024 ** 3 });
    expect(findBootDisk({ bootdisk: "scsi0", scsi0: "local-lvm:vm-1-disk-0,size=8G" })?.key).toBe("scsi0");
    expect(findBootDisk({ ide2: "local-lvm:vm-1-cloudinit,media=cdrom" })).toBeNull();
  });

  it("rewrites net0 bridge / VLAN keeping the MAC", () => {
    expect(rewriteNet0("virtio=AA:BB:CC:DD:EE:FF,bridge=vmbr0", "vmbr0", null)).toBeNull();
    expect(rewriteNet0("virtio=AA:BB:CC:DD:EE:FF,bridge=vmbr0,tag=5", "vmbr0", null)).toBe("virtio=AA:BB:CC:DD:EE:FF,bridge=vmbr0");
    expect(rewriteNet0(undefined, "vmbr2", 7)).toBe("virtio,bridge=vmbr2,tag=7");
  });

  it("computes usage and month traffic (bytes/s × step) from rrd points", () => {
    const now = new Date(Date.UTC(2026, 9, 8, 12));
    const monthStart = Date.UTC(2026, 9, 1) / 1000;
    const usage = parseUsage(
      { status: "running", qmpstatus: "running", cpu: 0.4567, mem: 1024 ** 3, maxmem: 2 * 1024 ** 3, maxdisk: 40 * 1024 ** 3, disk: 0 },
      [
        { time: monthStart - 43200, netin: 9e9, netout: 9e9 }, // previous month: ignored
        { time: monthStart, netin: 1024, netout: 1024 },
        { time: monthStart + 43200, netin: 1024 * 1024, netout: 0 },
      ],
      now
    );
    expect(usage).toMatchObject({ cpuPercent: 45.7, ramUsedMB: 1024, ramLimitMB: 2048, diskLimitMB: 40960, powerState: "running" });
    expect(usage.diskUsedMB).toBeUndefined();
    // (2048 B/s + 1 MiB/s) × 43200 s ≈ 42 GB
    expect(usage.bandwidthUsedMB).toBe(Math.round(((2048 + 1024 * 1024) * 43200) / 1024 ** 2));
    expect(parseUsage({ status: "stopped" }, [], now).powerState).toBe("stopped");
  });
});

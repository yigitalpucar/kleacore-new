process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { createFetchMock, makeTestInstance, restoreFetch } from "@/lib/modules/testing";
import { cpanelWhmModule, createCpanelWhmModule, parseWhmSize, type CpanelWhmModuleConfig } from "@/lib/modules/server/cpanel-whm";
import type { RegistrarModule } from "@/lib/modules/contracts";
import { parseGriDomainListItem } from "@/lib/integrations/registrar/providers/gri";
import listaccts from "@/lib/modules/server/cpanel-whm/__fixtures__/listaccts.json";
import proxmox from "../__fixtures__/proxmox.json";
import { ImportSourceError } from "./errors";
import { createProxmoxHttpLister, getVirtualMachineLister, ipFromNetConfig, listProxmoxVirtualMachines, totalDiskGB } from "./proxmox";
import { listRegistrarDomains } from "./registrar";
import { listWhmAccounts } from "./whm";

afterEach(() => restoreFetch());

describe("WHM source (listaccts fixture)", () => {
  const config = { host: "whm.test", port: 2087, username: "kleacore", apiToken: "WHM-TOKEN-123", useSsl: true, defaultPlan: "default" };
  const instance = makeTestInstance<CpanelWhmModuleConfig>(cpanelWhmModule, config);

  it("lists accounts read-only and normalises them", async () => {
    const { calls } = createFetchMock([{ method: "GET", url: "https://whm.test:2087/json-api/listaccts*", json: listaccts }]);
    const accounts = await listWhmAccounts(createCpanelWhmModule(instance));

    expect(calls).toHaveLength(1);
    expect(calls[0].headers.get("authorization")).toBe("whm kleacore:WHM-TOKEN-123");
    expect(accounts).toEqual([
      {
        kind: "account",
        remoteId: "ornekweb",
        username: "ornekweb",
        domain: "ornek-web.test",
        email: "Ayse.Yilmaz@musteri.test",
        plan: "kleacore_Baslangic",
        diskUsedMB: 150,
        diskLimitMB: 5120,
        suspended: false,
        suspendReason: null,
        createdAt: new Date(1704103200 * 1000).toISOString(),
        ipAddresses: ["192.0.2.10"],
      },
      expect.objectContaining({
        remoteId: "askidaki",
        email: null, // "*unknown*"
        diskUsedMB: null,
        diskLimitMB: null, // unlimited
        suspended: true,
        suspendReason: "Ödeme gecikti",
      }),
    ]);
  });

  it("turns a WHM error into a readable source error", async () => {
    createFetchMock([{ url: "https://whm.test:2087/json-api/listaccts*", json: { metadata: { result: 0, reason: "Access denied" } } }]);
    await expect(listWhmAccounts(createCpanelWhmModule(instance))).rejects.toThrow(/Access denied/);
  });

  it("parses WHM sizes", () => {
    expect(parseWhmSize("1.5G")).toBe(1536);
    expect(parseWhmSize("512K")).toBe(0.5);
    expect(parseWhmSize("unlimited")).toBeUndefined();
  });
});

describe("Proxmox source (HTTP adapter, GET only)", () => {
  const config = { apiUrl: "https://pve.test:8006", tokenId: "root@pam!import", tokenSecret: "pve-secret" };

  function mockPve() {
    return createFetchMock([
      { method: "GET", url: "https://pve.test:8006/api2/json/cluster/resources?type=vm", json: proxmox.resources },
      { method: "GET", url: "https://pve.test:8006/api2/json/nodes/pve1/qemu/101/config", json: proxmox.config101 },
      { method: "GET", url: "https://pve.test:8006/api2/json/nodes/pve1/qemu/101/agent/network-get-interfaces", json: proxmox.agent101 },
      { method: "GET", url: "https://pve.test:8006/api2/json/nodes/pve1/qemu/102/config", json: proxmox.config102 },
      { method: "GET", url: "https://pve.test:8006/api2/json/nodes/pve2/lxc/200/config", json: proxmox.config200 },
    ]);
  }

  it("lists VMs and containers, skips templates, reads resources and IPs", async () => {
    const { calls } = mockPve();
    const vms = await listProxmoxVirtualMachines(createProxmoxHttpLister(config));

    expect(calls.every((call) => call.method === "GET")).toBe(true);
    expect(calls[0].headers.get("authorization")).toBe("PVEAPIToken=root@pam!import=pve-secret");
    expect(vms.map((vm) => vm.remoteId)).toEqual(["101", "102", "200"]);
    expect(vms[0]).toEqual({
      kind: "vm",
      remoteId: "101",
      name: "vds-musteri",
      node: "pve1",
      status: "running",
      cores: 2,
      memoryMB: 4096,
      diskGB: 40, // cdrom ignored
      ipAddresses: ["203.0.113.40"], // from the guest agent, loopback/IPv6 dropped
      createdAt: new Date(1714521600 * 1000).toISOString(),
    });
    expect(vms[1]).toMatchObject({ status: "stopped", cores: 4, memoryMB: 8192, diskGB: 80, ipAddresses: ["203.0.113.41"] });
    expect(vms[2]).toMatchObject({ name: "ct-web", cores: 1, memoryMB: 1024, diskGB: 10, ipAddresses: ["203.0.113.42"] });
  });

  it("limits to one node when configured", async () => {
    mockPve();
    const vms = await listProxmoxVirtualMachines(createProxmoxHttpLister({ ...config, node: "pve2" }));
    expect(vms.map((vm) => vm.remoteId)).toEqual(["200"]);
  });

  it("reports an API failure without throwing from the lister", async () => {
    createFetchMock([{ url: "https://pve.test:8006/api2/json/cluster/resources?type=vm", status: 401, json: { data: null } }]);
    const result = await createProxmoxHttpLister(config).listVirtualMachines();
    expect(result).toMatchObject({ ok: false, error: "HTTP_401" });
  });

  it("prefers the module's own listVirtualMachines, else needs API credentials in the config", async () => {
    const own = { listVirtualMachines: vi.fn(async () => ({ ok: true, provider: "proxmox", data: [] })) };
    await getVirtualMachineLister(own, {}).listVirtualMachines();
    expect(own.listVirtualMachines).toHaveBeenCalled();
    expect(() => getVirtualMachineLister({}, { apiUrl: "https://pve.test:8006" })).toThrow(ImportSourceError);
  });

  it("parses net configs and disks", () => {
    expect(ipFromNetConfig("ip=203.0.113.5/24,gw=203.0.113.1")).toBe("203.0.113.5");
    expect(ipFromNetConfig("ip=dhcp")).toBeNull();
    expect(totalDiskGB({ scsi0: "local:vm-1-disk-0,size=512M", mp0: "local:vol,size=1T" })).toBe(1024.5);
  });
});

describe("Registrar source", () => {
  function fakeRegistrar(overrides: Partial<RegistrarModule> = {}): RegistrarModule {
    return {
      getDomainInfo: vi.fn(async (domain: string) => ({
        ok: true,
        provider: "gri",
        data: { domain, expiresAt: new Date("2027-03-01T00:00:00Z"), status: "active", nameservers: ["ns1.kleacore.com"] },
      })),
      listDomains: vi.fn(async () => ({
        ok: true,
        provider: "gri",
        data: [
          { domain: "Tam.Test", expiresAt: new Date("2026-12-01T00:00:00Z"), status: "active", nameservers: ["ns1.x.test"], autoRenew: false },
          { domain: "eksik.test" },
        ],
      })),
      ...overrides,
    } as unknown as RegistrarModule;
  }

  it("lists domains and fills missing details with getDomainInfo", async () => {
    const registrar = fakeRegistrar();
    const domains = await listRegistrarDomains(registrar);
    expect(domains[0]).toEqual({
      kind: "domain",
      remoteId: "tam.test",
      name: "tam.test",
      expiresAt: "2026-12-01T00:00:00.000Z",
      status: "active",
      nameservers: ["ns1.x.test"],
      autoRenew: false,
    });
    expect(domains[1]).toMatchObject({ name: "eksik.test", expiresAt: "2027-03-01T00:00:00.000Z", nameservers: ["ns1.kleacore.com"], autoRenew: null });
    expect(registrar.getDomainInfo).toHaveBeenCalledTimes(1);
  });

  it("rejects a registrar without listDomains", async () => {
    await expect(listRegistrarDomains(fakeRegistrar({ listDomains: undefined }))).rejects.toThrow(ImportSourceError);
  });

  it("parses Gri list entries defensively", () => {
    expect(
      parseGriDomainListItem({ attributes: { name: "Ornek.COM.tr.", expiration_date: "2027-01-02 00:00:00", status: "active", auto_renew: 1 } })
    ).toMatchObject({ domain: "ornek.com.tr", status: "active", autoRenew: true });
    expect(parseGriDomainListItem({ attributes: { status: "active" } })).toBeNull();
  });
});

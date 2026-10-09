/**
 * Stateful fake of the Proxmox VE API endpoints the proxmox module uses,
 * installed as global fetch (tests only — never imported by app code).
 * Tasks finish after `taskPolls` status polls; failures are injectable.
 */
import { vi } from "vitest";

export interface FakeVm {
  vmid: number;
  node: string;
  template?: boolean;
  status: "running" | "stopped";
  config: Record<string, string | number>;
}

interface FakeTask {
  node: string;
  pollsLeft: number;
  exitstatus: string;
  done?: () => void;
  finished: boolean;
  log?: string[];
}

export interface FakeArchive {
  volid: string;
  vmid: number;
  size: number;
  ctime: number;
  notes?: string;
  format?: string;
  /** VM config captured at backup time (restored by qmrestore). */
  config: Record<string, string | number>;
}

export interface FakeCall {
  method: string;
  path: string;
  params: URLSearchParams;
  authorization: string | null;
}

export function createFakePve(options: { node?: string; base?: string } = {}) {
  const node = options.node ?? "pve";
  const base = options.base ?? "https://pve.test:8006/api2/json";
  const vms = new Map<number, FakeVm>();
  const tasks = new Map<string, FakeTask>();
  const calls: FakeCall[] = [];
  let taskCounter = 0;

  const fake = {
    node,
    vms,
    tasks,
    calls,
    /** Status polls before a new task stops. */
    taskPolls: 1,
    /** VMIDs whose clone fails with "already exists" (race with another clone). */
    cloneConflicts: new Set<number>(),
    /** VMIDs /cluster/nextid reports as taken although not listed. */
    reservedIds: new Set<number>(),
    /** Next start task fails with this exit status (once). */
    failNextStart: null as string | null,
    rrd: [] as Array<Record<string, number>>,
    /** Backup archives per storage id. */
    storages: new Map<string, FakeArchive[]>(),
    /** Next vzdump task fails with this exit status (once). */
    failNextBackup: null as string | null,
    /** Next restore task fails with this exit status (once). */
    failNextRestore: null as string | null,
    /** vzdump ignores notes-template (older PVE): archive found through the task log. */
    ignoreNotes: false,
    backupSeq: 0,

    archives(storage = "local") {
      return fake.storages.get(storage) ?? [];
    },

    addArchive(storage: string, archive: Omit<FakeArchive, "config"> & { config?: Record<string, string | number> }) {
      fake.storages.set(storage, [...fake.archives(storage), { config: {}, ...archive }]);
    },

    addTemplate(vmid = 9000, config: Record<string, string | number> = {}) {
      vms.set(vmid, {
        vmid,
        node,
        template: true,
        status: "stopped",
        config: {
          name: "tpl-ubuntu-2204",
          template: 1,
          boot: "order=scsi0;ide2;net0",
          scsi0: `local-lvm:base-${vmid}-disk-0,size=10G`,
          ide2: "local-lvm:vm-9000-cloudinit,media=cdrom",
          net0: "virtio=BC:24:11:00:00:01,bridge=vmbr0,firewall=1",
          cores: 1,
          memory: 1024,
          ...config,
        },
      });
    },

    addVm(vm: Partial<FakeVm> & { vmid: number }) {
      vms.set(vm.vmid, { node, status: "stopped", config: {}, ...vm });
    },

    paths(method?: string) {
      return calls.filter((call) => !method || call.method === method).map((call) => `${call.method} ${call.path}`);
    },

    install() {
      vi.stubGlobal("fetch", vi.fn(handle));
    },
  };

  function newTask(exitstatus = "OK", done?: () => void, log?: string[]) {
    const upid = `UPID:${node}:0000${(++taskCounter).toString(16)}:00000001:6700000${taskCounter}:qmtask:${taskCounter}:kleacore@pve!kleacore:`;
    tasks.set(upid, { node, pollsLeft: fake.taskPolls, exitstatus, done, finished: false, log });
    return upid;
  }

  function json(data: unknown, status = 200, statusText = "") {
    return new Response(JSON.stringify({ data }), { status, statusText, headers: { "content-type": "application/json" } });
  }

  function error(status: number, statusText: string, errors?: Record<string, string>) {
    return new Response(JSON.stringify({ data: null, ...(errors ? { errors } : {}) }), {
      status,
      statusText,
      headers: { "content-type": "application/json" },
    });
  }

  async function handle(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    const params = method === "POST" || method === "PUT" ? new URLSearchParams(String(init?.body ?? "")) : url.searchParams;
    if (!url.href.startsWith(base)) throw new Error(`Unexpected request in test: ${method} ${url.href}`);
    const path = decodeURIComponent(url.pathname.slice(new URL(base).pathname.length));
    calls.push({ method, path, params, authorization: headers.get("authorization") });

    let match: RegExpExecArray | null;

    if (method === "GET" && path === "/version") return json({ version: "9.0.3", release: "9.0" });
    if (method === "GET" && path === `/nodes/${node}/status`) return json({ uptime: 1234, pveversion: "pve-manager/9.0.3" });

    if (method === "GET" && path === "/cluster/resources") {
      return json(
        [...vms.values()].map((vm) => ({
          id: `qemu/${vm.vmid}`,
          type: "qemu",
          vmid: vm.vmid,
          node: vm.node,
          name: vm.config.name,
          status: vm.status,
          template: vm.template ? 1 : 0,
          tags: vm.config.tags,
        }))
      );
    }

    if (method === "GET" && path === "/cluster/nextid") {
      const vmid = Number(params.get("vmid"));
      if (vms.has(vmid) || fake.reservedIds.has(vmid)) return error(400, "Parameter verification failed.", { vmid: `VM ${vmid} already exists` });
      return json(String(vmid));
    }

    if ((match = /^\/nodes\/([^/]+)\/tasks\/(.+)\/status$/.exec(path))) {
      const task = tasks.get(match[2]);
      if (!task) return error(500, "no such task");
      if (task.pollsLeft > 0) {
        task.pollsLeft -= 1;
        return json({ status: "running", upid: match[2] });
      }
      if (!task.finished) {
        task.finished = true;
        if (task.exitstatus === "OK") task.done?.();
      }
      return json({ status: "stopped", exitstatus: task.exitstatus, upid: match[2] });
    }

    if ((match = /^\/nodes\/([^/]+)\/tasks\/(.+)\/log$/.exec(path))) {
      const lines = tasks.get(match[2])?.log ?? ["task started", "TASK OK"];
      return json(lines.map((t, index) => ({ n: index + 1, t })));
    }

    if ((match = /^\/nodes\/([^/]+)\/vzdump$/.exec(path)) && method === "POST") {
      const vmid = Number(params.get("vmid"));
      const storage = params.get("storage") ?? "local";
      const vm = vms.get(vmid);
      if (!vm) return error(500, `VM ${vmid} not found`);
      if (fake.failNextBackup) {
        const reason = fake.failNextBackup;
        fake.failNextBackup = null;
        return json(newTask(reason));
      }
      const seq = ++fake.backupSeq;
      const stamp = `2026_10_09-03_00_${String(seq).padStart(2, "0")}`;
      const pbs = storage.startsWith("pbs");
      const volid = pbs ? `${storage}:backup/vm/${vmid}/2026-10-09T00:00:${String(seq).padStart(2, "0")}Z` : `${storage}:backup/vzdump-qemu-${vmid}-${stamp}.vma.zst`;
      const log = [
        `INFO: starting new backup job: vzdump ${vmid} --mode ${params.get("mode")} --storage ${storage}`,
        pbs
          ? `INFO: creating Proxmox Backup Server archive 'vm/${vmid}/2026-10-09T00:00:${String(seq).padStart(2, "0")}Z'`
          : `INFO: creating vzdump archive '/var/lib/vz/dump/vzdump-qemu-${vmid}-${stamp}.vma.zst'`,
        "INFO: Backup job finished successfully",
        "TASK OK",
      ];
      return json(
        newTask(
          "OK",
          () =>
            fake.addArchive(storage, {
              volid,
              vmid,
              size: 1024 * 1024 * (100 + seq),
              ctime: 1_791_500_000 + seq,
              notes: fake.ignoreNotes ? undefined : (params.get("notes-template") ?? undefined),
              format: pbs ? "pbs-vm" : "vma.zst",
              config: { ...vm.config },
            }),
          log
        )
      );
    }

    if ((match = /^\/nodes\/([^/]+)\/storage\/([^/]+)\/content$/.exec(path)) && method === "GET") {
      const vmid = params.get("vmid");
      return json(
        fake
          .archives(match[2])
          .filter((archive) => !vmid || String(archive.vmid) === vmid)
          .map(({ config: _config, ...archive }) => {
            void _config;
            return { ...archive, content: "backup", subtype: "qemu" };
          })
      );
    }

    if ((match = /^\/nodes\/([^/]+)\/storage\/([^/]+)\/content\/(.+)$/.exec(path)) && method === "DELETE") {
      const storage = match[2];
      const volid = match[3];
      if (!fake.archives(storage).some((archive) => archive.volid === volid)) {
        return error(500, `volume '${volid}' does not exist`);
      }
      return json(newTask("OK", () => fake.storages.set(storage, fake.archives(storage).filter((archive) => archive.volid !== volid))));
    }

    if ((match = /^\/nodes\/([^/]+)\/qemu$/.exec(path)) && method === "POST") {
      const vmid = Number(params.get("vmid"));
      const archiveId = params.get("archive") ?? "";
      const archive = [...fake.storages.values()].flat().find((row) => row.volid === archiveId);
      if (!archive) return error(500, `can't find archive '${archiveId}'`);
      const existing = vms.get(vmid);
      if (existing && params.get("force") !== "1") return error(500, `unable to restore VM ${vmid} - VM ${vmid} already exists`);
      if (existing?.status === "running") return error(500, `unable to restore VM ${vmid} - VM is running`);
      if (fake.failNextRestore) {
        const reason = fake.failNextRestore;
        fake.failNextRestore = null;
        return json(newTask(reason));
      }
      if (existing) existing.config = { ...existing.config, lock: "create" };
      return json(
        newTask("OK", () => {
          vms.set(vmid, { vmid, node, status: "stopped", config: { ...archive.config, restoredFrom: archiveId } });
        })
      );
    }

    if ((match = /^\/nodes\/([^/]+)\/qemu\/(\d+)\/clone$/.exec(path)) && method === "POST") {
      const source = vms.get(Number(match[2]));
      const newid = Number(params.get("newid"));
      if (!source) return error(500, `Configuration file 'nodes/${node}/qemu-server/${match[2]}.conf' does not exist`);
      if (vms.has(newid) || fake.cloneConflicts.has(newid)) {
        fake.cloneConflicts.delete(newid);
        return error(500, `unable to create VM ${newid}: config file already exists`);
      }
      // Placeholder config while the clone runs (like PVE).
      vms.set(newid, { vmid: newid, node: params.get("target") || node, status: "stopped", config: { lock: "clone" } });
      const upid = newTask("OK", () => {
        const { template: _template, ...rest } = source.config;
        void _template;
        const disk = String(rest.scsi0 ?? "").replace(`base-${source.vmid}`, `vm-${newid}`);
        vms.set(newid, {
          vmid: newid,
          node: params.get("target") || node,
          status: "stopped",
          config: {
            ...rest,
            scsi0: disk,
            name: params.get("name") ?? `Copy-of-VM-${source.vmid}`,
            description: params.get("description") ?? "",
          },
        });
      });
      return json(upid);
    }

    if ((match = /^\/nodes\/([^/]+)\/qemu\/(\d+)(\/.*)?$/.exec(path))) {
      const vmid = Number(match[2]);
      const rest = match[3] ?? "";
      const vm = vms.get(vmid);
      if (!vm) return error(500, `Configuration file 'nodes/${node}/qemu-server/${vmid}.conf' does not exist`);

      if (rest === "/config" && method === "GET") return json({ ...vm.config, digest: "abc" });
      if (rest === "/config" && method === "PUT") {
        for (const [key, value] of params) vm.config[key] = /^\d+$/.test(value) ? Number(value) : value;
        return json(null);
      }
      if (rest === "/resize" && method === "PUT") {
        const disk = params.get("disk")!;
        const size = params.get("size")!;
        const upid = newTask("OK", () => {
          vm.config[disk] = String(vm.config[disk]).replace(/size=[^,]+/, `size=${size}`);
        });
        return json(upid);
      }
      if (rest === "/status/current" && method === "GET") {
        return json({
          status: vm.status,
          qmpstatus: vm.status,
          cpu: vm.status === "running" ? 0.125 : 0,
          cpus: Number(vm.config.cores ?? 1),
          mem: vm.status === "running" ? 512 * 1024 * 1024 : 0,
          maxmem: Number(vm.config.memory ?? 1024) * 1024 * 1024,
          disk: 0,
          maxdisk: 40 * 1024 ** 3,
          netin: 1000,
          netout: 2000,
          uptime: vm.status === "running" ? 100 : 0,
          name: vm.config.name,
        });
      }
      if (rest === "/rrddata" && method === "GET") return json(fake.rrd);
      if ((match = /^\/status\/(start|stop|shutdown|reboot)$/.exec(rest)) && method === "POST") {
        const verb = match[1];
        if (verb === "start" && fake.failNextStart) {
          const reason = fake.failNextStart;
          fake.failNextStart = null;
          return json(newTask(reason));
        }
        return json(
          newTask("OK", () => {
            vm.status = verb === "start" || verb === "reboot" ? "running" : "stopped";
          })
        );
      }
      if (rest === "" && method === "DELETE") {
        return json(newTask("OK", () => vms.delete(vmid)));
      }
    }

    throw new Error(`Unexpected request in test: ${method} ${url.href}`);
  }

  return fake;
}

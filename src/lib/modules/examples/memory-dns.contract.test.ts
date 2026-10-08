import { randomUUID } from "node:crypto";

process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

import { describeDnsModuleBehaviour, describeModuleContract, makeTestInstance } from "../testing";
import { createMemoryDnsModule, memoryDnsModule, type MemoryDnsConfig } from "./memory-dns";

// No HTTP: the "API down" checks don't apply to an in-memory module.
describeModuleContract(memoryDnsModule, {
  config: { apiToken: "memory-token-123", nameservers: ["ns1.example.test", "ns2.example.test"] },
  skipUnreachable: true,
});

describeDnsModuleBehaviour("memory-dns", () =>
  createMemoryDnsModule(
    makeTestInstance<MemoryDnsConfig>(memoryDnsModule, { apiToken: "memory-token-123" }, { id: `mem-${randomUUID()}` })
  )
);

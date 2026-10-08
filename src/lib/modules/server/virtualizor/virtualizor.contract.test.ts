process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

import { describeModuleContract } from "../../testing";
import { virtualizorModule } from ".";

describeModuleContract(virtualizorModule, {
  config: { apiUrl: "https://virtualizor.test:4085", apiKey: "virt-api-key-123", apiPassword: "virt-api-pass-456" },
});

process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

import { describeModuleContract } from "../../testing";
import { griModule } from ".";

describeModuleContract(griModule, {
  config: {
    username: "gri-user",
    password: "gri-password-123",
    clientId: "client-id",
    clientSecret: "gri-client-secret-456",
    apiUrl: "https://gri.test/api",
    testMode: true,
  },
});

import { afterEach, describe, expect, it } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

import {
  createFetchMock,
  describeModuleContract,
  makeServerContext,
  makeTestInstance,
  restoreFetch,
} from "../../testing";
import { cpanelWhmModule, createCpanelWhmModule, type CpanelWhmModuleConfig } from ".";

const config = { host: "whm.test", port: 2087, username: "kleacore", apiToken: "WHM-TOKEN-123", useSsl: true, defaultPlan: "kc_default" };

describeModuleContract(cpanelWhmModule, {
  config,
  productOptions: { package: "kc_basic" },
  invalidProductOptions: { package: 123 },
});

describe("cpanel-whm module behaviour (WHM fixtures)", () => {
  afterEach(() => restoreFetch());
  const instance = makeTestInstance<CpanelWhmModuleConfig>(cpanelWhmModule, config);
  const ok = { metadata: { result: 1, reason: "OK" }, data: {} };

  it("creates the account with the product's WHM package and returns the username as remoteId", async () => {
    const { calls } = createFetchMock([
      {
        method: "GET",
        url: "https://whm.test:2087/json-api/createacct*",
        json: ok,
        assert: ({ headers }) => expect(headers.get("authorization")).toBe("whm kleacore:WHM-TOKEN-123"),
      },
    ]);
    const subject = createCpanelWhmModule(instance);
    const result = await subject.createAccount(makeServerContext(instance, { package: "kc_pro" }, { username: "ornekcom", remoteId: null }));

    expect(result).toMatchObject({ ok: true, data: { remoteId: "ornekcom", username: "ornekcom" } });
    expect(result.data?.password).toHaveLength(16);
    const query = new URL(calls[0].url).searchParams;
    expect(query.get("username")).toBe("ornekcom");
    expect(query.get("plan")).toBe("kc_pro");
    expect(query.get("domain")).toBe("ornek.com.tr");
    expect(query.get("contactemail")).toBe("musteri@test.local");
  });

  it("falls back to the product SKU, then the default package (legacy behaviour)", async () => {
    const { calls } = createFetchMock([{ url: "https://whm.test:2087/json-api/*", json: ok }]);
    const subject = createCpanelWhmModule(instance);
    await subject.changePackage(makeServerContext(instance, {}));
    await subject.changePackage(makeServerContext(instance, {}, { product: { id: "p", sku: "", name: "x", categorySlug: "hosting" } }));
    expect(new URL(calls[0].url).searchParams.get("pkg")).toBe("HOST-TEST");
    expect(new URL(calls[1].url).searchParams.get("pkg")).toBe("kc_default");
  });

  it("targets the remote id for suspend / unsuspend / terminate", async () => {
    const { calls } = createFetchMock([{ url: "https://whm.test:2087/json-api/*", json: ok }]);
    const subject = createCpanelWhmModule(instance);
    const ctx = makeServerContext(instance, {}, { remoteId: "acct42", username: "other" });
    expect(await subject.suspend(ctx, "Ödeme gecikti")).toMatchObject({ ok: true, reference: "acct42" });
    expect(await subject.unsuspend(ctx)).toMatchObject({ ok: true });
    expect(await subject.terminate(ctx)).toMatchObject({ ok: true });
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/json-api/suspendacct",
      "/json-api/unsuspendacct",
      "/json-api/removeacct",
    ]);
    expect(new URL(calls[0].url).searchParams.get("user")).toBe("acct42");
    expect(new URL(calls[2].url).searchParams.get("username")).toBe("acct42");
  });

  it("maps WHM errors to ok: false with the reason", async () => {
    createFetchMock([{ url: "https://whm.test:2087/json-api/*", json: { metadata: { result: 0, reason: "Account exists" } } }]);
    const result = await createCpanelWhmModule(instance).createAccount(makeServerContext(instance, {}));
    expect(result).toEqual({ ok: false, provider: "cpanel-whm", error: "Account exists" });
  });

  it("refuses to act without an account name", async () => {
    const result = await createCpanelWhmModule(instance).suspend(makeServerContext(instance, {}, { remoteId: null, username: null }));
    expect(result).toMatchObject({ ok: false, error: "CPANEL_USERNAME_MISSING" });
  });
});

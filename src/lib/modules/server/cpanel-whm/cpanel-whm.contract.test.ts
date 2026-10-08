import { afterEach, describe, expect, it } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

import {
  createFetchMock,
  describeModuleContract,
  makeServerContext,
  makeTestInstance,
  restoreFetch,
} from "../../testing";
import {
  cpanelWhmModule,
  createCpanelWhmModule,
  parseWhmMegabytes,
  prefixWhmPackage,
  type CpanelWhmModuleConfig,
} from ".";
import accountSummaryFixture from "./__fixtures__/accountsummary.json";
import createUserSessionFixture from "./__fixtures__/create_user_session.json";
import createUserSessionDeniedFixture from "./__fixtures__/create_user_session_denied.json";
import listAcctsFixture from "./__fixtures__/listaccts.json";
import listPkgsFixture from "./__fixtures__/listpkgs.json";
import passwdFixture from "./__fixtures__/passwd.json";
import showBwAllFixture from "./__fixtures__/showbw_all.json";
import showBwUserFixture from "./__fixtures__/showbw_user.json";

const config = { host: "whm.test", port: 2087, username: "kleacore", apiToken: "WHM-TOKEN-123", useSsl: true, defaultPlan: "kc_default" };
const BASE = "https://whm.test:2087/json-api";

describeModuleContract(cpanelWhmModule, {
  config,
  productOptions: { package: "kc_basic" },
  invalidProductOptions: { package: 123 },
});

describe("cpanel-whm module behaviour (WHM fixtures)", () => {
  afterEach(() => restoreFetch());
  const instance = makeTestInstance<CpanelWhmModuleConfig>(cpanelWhmModule, config);
  const rootInstance = makeTestInstance<CpanelWhmModuleConfig>(cpanelWhmModule, { ...config, username: "root" });
  const noPrefixInstance = makeTestInstance<CpanelWhmModuleConfig>(cpanelWhmModule, { ...config, packagePrefix: "none" });
  const ok = { metadata: { result: 1, reason: "OK" }, data: {} };

  it("creates the account with the reseller-prefixed package and returns the username as remoteId", async () => {
    const { calls } = createFetchMock([
      {
        method: "GET",
        url: `${BASE}/createacct*`,
        json: ok,
        assert: ({ headers }) => expect(headers.get("authorization")).toBe("whm kleacore:WHM-TOKEN-123"),
      },
    ]);
    const subject = createCpanelWhmModule(instance);
    const result = await subject.createAccount(makeServerContext(instance, { package: "Starter" }, { username: "ornekcom", remoteId: null }));

    expect(result).toMatchObject({ ok: true, data: { remoteId: "ornekcom", username: "ornekcom" } });
    expect(result.data?.password).toHaveLength(16);
    const query = new URL(calls[0].url).searchParams;
    expect(query.get("username")).toBe("ornekcom");
    expect(query.get("plan")).toBe("kleacore_Starter");
    expect(query.get("domain")).toBe("ornek.com.tr");
    expect(query.get("contactemail")).toBe("musteri@test.local");
  });

  it("falls back to the product SKU, then the default package, both prefixed", async () => {
    const { calls } = createFetchMock([{ url: `${BASE}/*`, json: ok }]);
    const subject = createCpanelWhmModule(instance);
    await subject.changePackage(makeServerContext(instance, {}));
    await subject.changePackage(makeServerContext(instance, {}, { product: { id: "p", sku: "", name: "x", categorySlug: "hosting" } }));
    expect(new URL(calls[0].url).searchParams.get("pkg")).toBe("kleacore_HOST-TEST");
    expect(new URL(calls[1].url).searchParams.get("pkg")).toBe("kleacore_kc_default");
  });

  it("honours the prefix setting: no double prefix, none for root or packagePrefix=none", async () => {
    expect(prefixWhmPackage("kleacore_Starter", instance.config)).toBe("kleacore_Starter");
    expect(prefixWhmPackage("Starter", rootInstance.config)).toBe("Starter");
    expect(prefixWhmPackage("Starter", noPrefixInstance.config)).toBe("Starter");
    // The admin form uses the same resolution.
    expect(createCpanelWhmModule(instance).resolvePackageName!({ package: "Pro" }, { sku: "X" })).toBe("kleacore_Pro");
    expect(createCpanelWhmModule(noPrefixInstance).resolvePackageName!({}, { sku: "HOST-1" })).toBe("HOST-1");
    // Legacy configs without the field default to "auto".
    expect(cpanelWhmModule.configSchema.parse(config).packagePrefix).toBe("auto");
  });

  it("targets the remote id for suspend / unsuspend / terminate", async () => {
    const { calls } = createFetchMock([{ url: `${BASE}/*`, json: ok }]);
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
    createFetchMock([{ url: `${BASE}/*`, json: { metadata: { result: 0, reason: "Account exists" } } }]);
    const result = await createCpanelWhmModule(instance).createAccount(makeServerContext(instance, {}));
    expect(result).toEqual({ ok: false, provider: "cpanel-whm", error: "Account exists" });
  });

  it("refuses to act without an account name", async () => {
    const subject = createCpanelWhmModule(instance);
    const ctx = makeServerContext(instance, {}, { remoteId: null, username: null });
    expect(await subject.suspend(ctx)).toMatchObject({ ok: false, error: "CPANEL_USERNAME_MISSING" });
    expect(await subject.getSsoUrl!(ctx)).toMatchObject({ ok: false, error: "CPANEL_USERNAME_MISSING" });
    expect(await subject.getUsage!(ctx)).toMatchObject({ ok: false, error: "CPANEL_USERNAME_MISSING" });
  });

  describe("single sign-on (create_user_session)", () => {
    it("returns the one-time cPanel URL for the account", async () => {
      const { calls } = createFetchMock([{ method: "GET", url: `${BASE}/create_user_session*`, json: createUserSessionFixture }]);
      const result = await createCpanelWhmModule(instance).getSsoUrl!(makeServerContext(instance, {}));

      expect(result.ok).toBe(true);
      expect(result.data?.url).toBe(createUserSessionFixture.data.url);
      expect(result.data?.expiresAt).toEqual(new Date(1791000000 * 1000));
      const query = new URL(calls[0].url).searchParams;
      expect(query.get("api.version")).toBe("1");
      expect(query.get("user")).toBe("ornekcom");
      expect(query.get("service")).toBe("cpaneld");
      expect(query.has("app")).toBe(false);
    });

    it("opens webmail with service=webmaild and cPanel apps with app=…", async () => {
      const { calls } = createFetchMock([{ url: `${BASE}/create_user_session*`, json: createUserSessionFixture }]);
      const subject = createCpanelWhmModule(instance);
      const ctx = makeServerContext(instance, {});
      await subject.getSsoUrl!(ctx, "webmail");
      await subject.getSsoUrl!(ctx, "panel", { app: "fileManager" });
      await subject.getSsoUrl!(ctx, "panel", { app: "emailAccounts" });
      await subject.getSsoUrl!(ctx, "panel", { app: "phpMyAdmin" });
      // Webmail ignores cPanel apps.
      await subject.getSsoUrl!(ctx, "webmail", { app: "phpMyAdmin" });

      const params = calls.map((call) => new URL(call.url).searchParams);
      expect(params.map((p) => p.get("service"))).toEqual(["webmaild", "cpaneld", "cpaneld", "cpaneld", "webmaild"]);
      expect(params.map((p) => p.get("app"))).toEqual([null, "FileManager_Home", "Email_Accounts", "Database_phpMyAdmin", null]);
    });

    it("reports a refused session (e.g. account not owned by the reseller) as ok: false", async () => {
      createFetchMock([{ url: `${BASE}/create_user_session*`, json: createUserSessionDeniedFixture }]);
      const result = await createCpanelWhmModule(instance).getSsoUrl!(makeServerContext(instance, {}, { remoteId: "baskasi" }));
      expect(result).toEqual({ ok: false, provider: "cpanel-whm", error: createUserSessionDeniedFixture.metadata.reason });
    });

    it("rejects a success response without a URL", async () => {
      createFetchMock([{ url: `${BASE}/create_user_session*`, json: { metadata: { result: 1 }, data: {} } }]);
      const result = await createCpanelWhmModule(instance).getSsoUrl!(makeServerContext(instance, {}));
      expect(result).toMatchObject({ ok: false, error: "CPANEL_SESSION_URL_MISSING" });
    });

    it("maps HTTP errors (token rejected) to ok: false", async () => {
      createFetchMock([{ url: `${BASE}/create_user_session*`, status: 403, text: "Access denied" }]);
      const result = await createCpanelWhmModule(instance).getSsoUrl!(makeServerContext(instance, {}));
      expect(result).toMatchObject({ ok: false, error: "HTTP_403" });
    });
  });

  describe("password reset (passwd)", () => {
    it("POSTs the new password in the body, never in the URL", async () => {
      const { calls } = createFetchMock([{ method: "POST", url: `${BASE}/passwd`, json: passwdFixture }]);
      const result = await createCpanelWhmModule(instance).resetPassword!(makeServerContext(instance, {}), "Yeni-Sifre-12345");

      expect(result).toMatchObject({ ok: true, reference: "ornekcom" });
      expect(calls[0].url).toBe(`${BASE}/passwd`);
      expect(calls[0].url).not.toContain("Yeni-Sifre");
      expect(calls[0].headers.get("content-type")).toBe("application/x-www-form-urlencoded");
      const body = new URLSearchParams(calls[0].body ?? "");
      expect(body.get("user")).toBe("ornekcom");
      expect(body.get("password")).toBe("Yeni-Sifre-12345");
      expect(body.get("api.version")).toBe("1");
    });

    it("returns the WHM reason when the password is refused", async () => {
      createFetchMock([
        { method: "POST", url: `${BASE}/passwd`, json: { metadata: { result: 0, reason: "The password is too weak." } } },
      ]);
      const result = await createCpanelWhmModule(instance).resetPassword!(makeServerContext(instance, {}), "zayif");
      expect(result).toEqual({ ok: false, provider: "cpanel-whm", error: "The password is too weak." });
    });
  });

  describe("usage", () => {
    it("parses accountsummary + showbw for one account (MB)", async () => {
      const { calls } = createFetchMock([
        { url: `${BASE}/accountsummary*`, json: accountSummaryFixture },
        { url: `${BASE}/showbw*`, json: showBwUserFixture },
      ]);
      const result = await createCpanelWhmModule(instance).getUsage!(makeServerContext(instance, {}));

      expect(result.ok).toBe(true);
      expect(result.data).toMatchObject({ diskUsedMB: 1536, diskLimitMB: 5120, bandwidthUsedMB: 2048, bandwidthLimitMB: 10240 });
      expect(result.data?.collectedAt).toBeInstanceOf(Date);
      const showbw = calls.find((call) => call.url.includes("/showbw"))!;
      expect(new URL(showbw.url).searchParams.get("searchtype")).toBe("user");
    });

    it("reads every account in two calls and marks unlimited limits as null", async () => {
      const { calls } = createFetchMock([
        { url: `${BASE}/listaccts*`, json: listAcctsFixture },
        { url: `${BASE}/showbw*`, json: showBwAllFixture },
      ]);
      const result = await createCpanelWhmModule(instance).listUsage!();

      expect(calls).toHaveLength(2);
      expect(result.ok).toBe(true);
      expect(result.data).toEqual([
        {
          remoteId: "ornekcom",
          usage: { diskUsedMB: 1536, diskLimitMB: 5120, bandwidthUsedMB: 512, bandwidthLimitMB: 10240, collectedAt: expect.any(Date) },
        },
        {
          remoteId: "sinirsiz",
          usage: { diskUsedMB: 0, diskLimitMB: null, bandwidthUsedMB: 0, bandwidthLimitMB: null, collectedAt: expect.any(Date) },
        },
      ]);
    });

    it("fails the bulk read when WHM refuses it", async () => {
      createFetchMock([{ url: `${BASE}/*`, json: { metadata: { result: 0, reason: "Permission denied" } } }]);
      expect(await createCpanelWhmModule(instance).listUsage!()).toMatchObject({ ok: false, error: "Permission denied" });
    });

    it("parses WHM size strings", () => {
      expect(parseWhmMegabytes("102M")).toBe(102);
      expect(parseWhmMegabytes("1.5G")).toBe(1536);
      expect(parseWhmMegabytes("512K")).toBe(0.5);
      expect(parseWhmMegabytes("2048")).toBe(2048);
      expect(parseWhmMegabytes(300)).toBe(300);
      expect(parseWhmMegabytes("unlimited")).toBeNull();
      expect(parseWhmMegabytes("none")).toBeNull();
      expect(parseWhmMegabytes("")).toBeUndefined();
      expect(parseWhmMegabytes("çok")).toBeUndefined();
    });
  });

  describe("packages (listpkgs)", () => {
    it("lists the reseller's packages with limits", async () => {
      const { calls } = createFetchMock([{ method: "GET", url: `${BASE}/listpkgs*`, json: listPkgsFixture }]);
      const result = await createCpanelWhmModule(instance).listPackages!();

      expect(calls).toHaveLength(1);
      expect(result).toMatchObject({
        ok: true,
        data: [
          { name: "kleacore_Starter", diskLimitMB: 5120, bandwidthLimitMB: 10240 },
          { name: "kleacore_Pro", diskLimitMB: null, bandwidthLimitMB: null },
        ],
      });
    });

    it("reports a listpkgs failure as ok: false", async () => {
      createFetchMock([{ url: `${BASE}/listpkgs*`, status: 401, json: { metadata: { result: 0, reason: "Invalid token" } } }]);
      expect(await createCpanelWhmModule(instance).listPackages!()).toMatchObject({ ok: false, error: "Invalid token" });
    });
  });
});

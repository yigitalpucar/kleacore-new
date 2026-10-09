import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => {
  type Row = Record<string, unknown> & { id: string; status: string };
  const state = {
    requests: [] as Row[],
    emitted: [] as Array<{ type: string; payload: Record<string, unknown> }>,
    seq: 0,
  };
  const pick = (where: Record<string, unknown>) =>
    state.requests.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null;
  const dataRequest = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      const row = {
        id: `dr-${state.requests.length + 1}`,
        userId: null,
        exportStorageKey: null,
        exportDownloadedAt: null,
        anonymizedAt: null,
        ...data,
      } as unknown as Row;
      state.requests.push(row);
      return row;
    },
    findUnique: async ({ where }: { where: Record<string, unknown> }) => pick(where),
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const row = pick(where);
      if (!row) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  };
  const user = {
    findUnique: async () => ({ id: "cus-1", email: "ayse@example.com", name: "Ayşe", surname: "Yılmaz" }),
  };
  const client = { dataRequest, user };
  return { state, db: { ...client, $transaction: async (fn: (tx: typeof client) => unknown) => fn(client) } };
});

vi.mock("@/lib/db", () => ({ db: store.db }));
vi.mock("@/lib/events/emit", () => ({
  emitEvent: vi.fn(async (_tx: unknown, type: string, payload: Record<string, unknown>) => {
    store.state.emitted.push({ type, payload });
    return { id: "evt", type, queued: true };
  }),
}));
vi.mock("@/lib/utils/number-generators", () => ({
  generateDataRequestNumber: async () => `KVKK-2026-${String(++store.state.seq).padStart(6, "0")}`,
}));
vi.mock("@/lib/auth/email", () => ({
  normalizeEmail: (email: string) => email.trim().toLowerCase(),
  findUserByEmail: async (email: string) => (email === "ayse@example.com" ? { id: "cus-1" } : null),
}));

import {
  EXPORT_LINK_TTL_MS,
  VERIFICATION_TTL_MS,
  confirmDataRequest,
  createPanelDataRequest,
  createPublicDataRequest,
  hashToken,
  respondToDataRequest,
  setDataRequestStatus,
} from "./requests";

const actor = { id: "admin-1", name: "Yönetici" };
const t0 = new Date("2026-10-09T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  store.state.requests = [];
  store.state.emitted = [];
  store.state.seq = 0;
});

const publicInput = (email = "Ayse@Example.com") => ({
  type: "EXPORT" as const,
  email,
  name: "Ayşe Yılmaz",
  details: "Verilerimin bir kopyasını istiyorum.",
  ipAddress: "203.0.113.5",
});

describe("public request + e-mail verification", () => {
  it("waits for verification; no deadline and no event before the link is used", async () => {
    const { request, token } = await createPublicDataRequest(publicInput(), t0);
    expect(request).toMatchObject({ status: "PENDING_VERIFICATION", email: "ayse@example.com", source: "form" });
    expect(request.dueAt).toBeUndefined();
    expect(request.verificationTokenHash).toBe(hashToken(token));
    expect(request.verificationTokenHash).not.toContain(token);
    expect(store.state.emitted).toEqual([]);
  });

  it("confirming starts the 30-day deadline, links the account and emits privacy.request_received once", async () => {
    const { token } = await createPublicDataRequest(publicInput(), t0);
    const confirmedAt = new Date(t0.getTime() + 60 * 60 * 1000);

    const result = await confirmDataRequest(token, confirmedAt);

    expect(result).toEqual({ ok: true, requestNumber: "KVKK-2026-000001", dueAt: new Date(confirmedAt.getTime() + 30 * DAY) });
    expect(store.state.requests[0]).toMatchObject({ status: "RECEIVED", userId: "cus-1", receivedAt: confirmedAt, verificationTokenHash: null });
    expect(store.state.emitted).toHaveLength(1);
    expect(store.state.emitted[0]).toMatchObject({
      type: "privacy.request_received",
      payload: { requestId: "dr-1", type: "EXPORT", userId: "cus-1", email: "ayse@example.com", source: "form" },
    });

    // The link is single-use.
    expect(await confirmDataRequest(token, confirmedAt)).toEqual({ ok: false, reason: "invalid" });
    expect(store.state.emitted).toHaveLength(1);
  });

  it("keeps an unknown address unlinked (admin sees 'hesap eşleşmedi')", async () => {
    const { token } = await createPublicDataRequest(publicInput("someone@example.com"), t0);
    await confirmDataRequest(token, t0);
    expect(store.state.requests[0]).toMatchObject({ status: "RECEIVED", userId: null });
  });

  it("an expired link cancels the request", async () => {
    const { token } = await createPublicDataRequest(publicInput(), t0);
    const result = await confirmDataRequest(token, new Date(t0.getTime() + VERIFICATION_TTL_MS + 1));
    expect(result).toEqual({ ok: false, reason: "expired", requestNumber: "KVKK-2026-000001" });
    expect(store.state.requests[0].status).toBe("CANCELLED");
    expect(store.state.emitted).toEqual([]);
  });

  it("rejects garbage tokens", async () => {
    expect(await confirmDataRequest("", t0)).toEqual({ ok: false, reason: "invalid" });
    expect(await confirmDataRequest("nope", t0)).toEqual({ ok: false, reason: "invalid" });
  });
});

describe("panel request", () => {
  it("is received immediately for the signed-in account with the deadline", async () => {
    const request = await createPanelDataRequest("cus-1", { type: "ERASURE", details: "Hesabımı silin lütfen." }, t0);
    expect(request).toMatchObject({
      status: "RECEIVED",
      userId: "cus-1",
      email: "ayse@example.com",
      name: "Ayşe Yılmaz",
      source: "panel",
      dueAt: new Date(t0.getTime() + 30 * DAY),
    });
    expect(store.state.emitted.map((e) => e.type)).toEqual(["privacy.request_received"]);
  });
});

describe("admin lifecycle", () => {
  it("RECEIVED → IN_PROGRESS → COMPLETED with the response event", async () => {
    const request = await createPanelDataRequest("cus-1", { type: "INFORMATION", details: "Hangi verilerim işleniyor?" }, t0);
    await setDataRequestStatus(request.id, "IN_PROGRESS", actor);
    expect(store.state.requests[0].status).toBe("IN_PROGRESS");

    await respondToDataRequest(request.id, { outcome: "COMPLETED", responseText: "Verileriniz şu amaçlarla işlenir." }, actor, t0);
    expect(store.state.requests[0]).toMatchObject({ status: "COMPLETED", completedAt: t0, handledById: "admin-1" });
    const completed = store.state.emitted.find((e) => e.type === "privacy.request_completed");
    expect(completed?.payload).toMatchObject({ outcome: "COMPLETED", email: "ayse@example.com", responseText: "Verileriniz şu amaçlarla işlenir." });
    expect(completed?.payload.downloadUrl).toBeUndefined();

    // Closed: no second response, no reopening.
    await expect(respondToDataRequest(request.id, { outcome: "REJECTED", responseText: "Tekrar yanıt deneme." }, actor)).rejects.toThrow("açık değil");
    await expect(setDataRequestStatus(request.id, "RECEIVED", actor)).rejects.toThrow();
  });

  it("completion is only possible through the response form", async () => {
    const request = await createPanelDataRequest("cus-1", { type: "OBJECTION", details: "Pazarlama e-postalarına itiraz." }, t0);
    await expect(setDataRequestStatus(request.id, "COMPLETED", actor)).rejects.toThrow("yanıt formu");
  });

  it("EXPORT needs a prepared export; the response carries a one-time link valid for 7 days", async () => {
    const request = await createPanelDataRequest("cus-1", { type: "EXPORT", details: "Verilerimin kopyası." }, t0);
    await expect(
      respondToDataRequest(request.id, { outcome: "COMPLETED", responseText: "Veri kopyanız hazır." }, actor, t0)
    ).rejects.toThrow("veri kopyasını");

    store.state.requests[0].exportStorageKey = "privacy-exports/2026/10/abc";
    await respondToDataRequest(request.id, { outcome: "COMPLETED", responseText: "Veri kopyanız hazır." }, actor, t0);

    const completed = store.state.emitted.find((e) => e.type === "privacy.request_completed")!;
    const url = new URL(String(completed.payload.downloadUrl));
    expect(url.pathname).toBe("/yasal/kvkk-basvuru/indir");
    const token = url.searchParams.get("token")!;
    expect(store.state.requests[0].exportTokenHash).toBe(hashToken(token));
    expect(store.state.requests[0].exportExpiresAt).toEqual(new Date(t0.getTime() + EXPORT_LINK_TTL_MS));
  });

  it("ERASURE for an account needs the reviewed anonymisation first; rejection does not", async () => {
    const request = await createPanelDataRequest("cus-1", { type: "ERASURE", details: "Hesabımı silin lütfen." }, t0);
    await expect(
      respondToDataRequest(request.id, { outcome: "COMPLETED", responseText: "Verileriniz silindi." }, actor, t0)
    ).rejects.toThrow("anonimleştirme");

    await respondToDataRequest(request.id, { outcome: "REJECTED", responseText: "Aktif hizmetiniz bulunduğu için reddedildi." }, actor, t0);
    expect(store.state.requests[0].status).toBe("REJECTED");
  });
});

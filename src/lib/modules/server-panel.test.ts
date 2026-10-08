import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { parseSshKeysInput } from "./server-panel";

describe("parseSshKeysInput", () => {
  it("accepts OpenSSH public keys one per line", () => {
    expect(
      parseSshKeysInput("ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIK0 ali@laptop\n\n  ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ==  \n")
    ).toEqual({ keys: ["ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIK0 ali@laptop", "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ=="] });
    expect(parseSshKeysInput("")).toEqual({ keys: [] });
  });

  it("rejects private keys and junk with the line number", () => {
    expect(parseSshKeysInput("ssh-ed25519 AAAA ok\n-----BEGIN OPENSSH PRIVATE KEY-----")).toEqual({
      error: "2. satır geçerli bir OpenSSH açık anahtarı değil",
    });
    expect(parseSshKeysInput(Array.from({ length: 11 }, () => "ssh-ed25519 AAAA").join("\n"))).toMatchObject({ error: expect.any(String) });
  });
});

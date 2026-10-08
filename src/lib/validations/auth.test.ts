import { describe, expect, it } from "vitest";
import {
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  registerApiSchema,
  registerSchema,
} from "./auth";

const validPassword = "Secret1a";

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: validPassword,
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid email and empty password", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path[0]);
      expect(paths).toContain("email");
      expect(paths).toContain("password");
    }
  });
});

describe("registerSchema", () => {
  const validInput = {
    name: "Ada",
    surname: "Lovelace",
    email: "ada@example.com",
    phone: "+905551112233",
    password: validPassword,
    confirmPassword: validPassword,
  };

  it("accepts valid registration input", () => {
    expect(registerSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = registerSchema.safeParse({
      ...validInput,
      confirmPassword: "Different1a",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["confirmPassword"]);
    }
  });

  it("rejects weak passwords", () => {
    const result = registerSchema.safeParse({
      ...validInput,
      password: "secret1",
      confirmPassword: "secret1",
    });

    expect(result.success).toBe(false);
  });

  it("rejects names shorter than two characters", () => {
    const result = registerSchema.safeParse({
      ...validInput,
      name: "A",
    });

    expect(result.success).toBe(false);
  });
});

describe("passwordResetRequestSchema", () => {
  it("requires a valid email", () => {
    expect(
      passwordResetRequestSchema.safeParse({ email: "reset@example.com" }).success
    ).toBe(true);
    expect(
      passwordResetRequestSchema.safeParse({ email: "invalid" }).success
    ).toBe(false);
  });
});

describe("passwordResetSchema", () => {
  it("accepts matching passwords with a token", () => {
    const result = passwordResetSchema.safeParse({
      token: "reset-token",
      password: validPassword,
      confirmPassword: validPassword,
    });

    expect(result.success).toBe(true);
  });

  it("rejects empty token and mismatched passwords", () => {
    const tokenResult = passwordResetSchema.safeParse({
      token: "",
      password: validPassword,
      confirmPassword: validPassword,
    });
    const mismatchResult = passwordResetSchema.safeParse({
      token: "reset-token",
      password: validPassword,
      confirmPassword: "Different1a",
    });

    expect(tokenResult.success).toBe(false);
    expect(mismatchResult.success).toBe(false);
  });
});
describe("email normalisation", () => {
  it("trims and lowercases emails on login and register", () => {
    const login = loginSchema.parse({ email: "  Ada@Example.COM ", password: "x" });
    expect(login.email).toBe("ada@example.com");

    const register = registerApiSchema.parse({
      name: " Ada ",
      surname: "Lovelace",
      email: "ADA@example.com",
      password: validPassword,
    });
    expect(register).toMatchObject({ name: "Ada", email: "ada@example.com" });
  });

  it("rejects malformed register API payloads", () => {
    expect(registerApiSchema.safeParse({}).success).toBe(false);
    expect(
      registerApiSchema.safeParse({
        name: ["Ada"],
        surname: "Lovelace",
        email: "ada@example.com",
        password: validPassword,
      }).success
    ).toBe(false);
    expect(
      registerApiSchema.safeParse({
        name: "A".repeat(81),
        surname: "Lovelace",
        email: "ada@example.com",
        password: validPassword,
      }).success
    ).toBe(false);
    expect(
      registerApiSchema.safeParse({
        name: "Ada",
        surname: "Lovelace",
        email: "not-an-email",
        password: validPassword,
      }).success
    ).toBe(false);
  });
});

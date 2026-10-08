import { describe, expect, it } from "vitest";
import { z } from "zod";
import { describeSchema, formValuesToInput, splitList } from "./schema-form";

const schema = z.object({
  host: z.string().min(1),
  apiUrl: z.string().url().optional(),
  port: z.coerce.number().int().min(1).max(65535).default(2087),
  useSsl: z.boolean().default(true),
  mode: z.enum(["live", "test"]),
  dns: z.array(z.string()).default([]),
  token: z.string(),
  sshKey: z.string().optional(),
});

describe("schema-generated forms", () => {
  const fields = describeSchema(
    schema,
    { host: { label: "Sunucu" }, mode: { optionLabels: { live: "Canlı" } }, sshKey: { multiline: true } },
    ["token"]
  );
  const byName = Object.fromEntries(fields.map((field) => [field.name, field]));

  it("describes field types, requiredness, defaults and labels", () => {
    expect(byName.host).toMatchObject({ type: "text", required: true, label: "Sunucu" });
    expect(byName.apiUrl).toMatchObject({ type: "url", required: false, label: "Api Url" });
    expect(byName.port).toMatchObject({ type: "number", required: false, integer: true, min: 1, max: 65535, defaultValue: 2087 });
    expect(byName.useSsl).toMatchObject({ type: "boolean", defaultValue: true });
    expect(byName.mode).toMatchObject({ type: "select", options: [{ value: "live", label: "Canlı" }, { value: "test", label: "test" }] });
    expect(byName.dns).toMatchObject({ type: "list", defaultValue: [] });
    expect(byName.token).toMatchObject({ type: "secret", required: true });
    expect(byName.sshKey).toMatchObject({ type: "textarea" });
  });

  it("turns posted values into schema input (defaults apply to empty optional fields)", () => {
    const input = formValuesToInput(fields, {
      host: " whm.test ",
      apiUrl: "",
      port: "",
      useSsl: false,
      mode: "live",
      dns: "1.1.1.1, 8.8.8.8\n9.9.9.9",
      token: "t",
    });
    expect(input).toEqual({ host: "whm.test", useSsl: false, mode: "live", dns: ["1.1.1.1", "8.8.8.8", "9.9.9.9"], token: "t" });
    expect(schema.parse(input)).toMatchObject({ port: 2087, useSsl: false });
  });

  it("parses numbers with a decimal comma", () => {
    const numberFields = describeSchema(z.object({ ratio: z.number() }));
    expect(formValuesToInput(numberFields, { ratio: "1,5" })).toEqual({ ratio: 1.5 });
  });

  it("splits lists on commas and new lines", () => {
    expect(splitList("a, b\n\nc ,")).toEqual(["a", "b", "c"]);
  });
});

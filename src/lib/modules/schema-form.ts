/**
 * Admin forms generated from a module's zod schema (configSchema /
 * productOptionsSchema). The server turns the schema into plain field
 * descriptors (serialisable to the browser), the client renders them
 * (src/components/admin/modules/schema-fields.tsx), and the posted values go
 * back through `formValuesToInput` + the schema on the server.
 *
 * Supported: z.string (url/email checks → input type), z.number /
 * z.coerce.number (int/min/max), z.boolean, z.enum, z.array(z.string()),
 * wrapped in optional/nullable/default/effects. Anything else renders as text.
 */
import { z } from "zod";
import type { FieldMetaMap } from "./types";

export type SchemaFieldType = "text" | "secret" | "url" | "email" | "number" | "boolean" | "select" | "list" | "textarea";

export interface SchemaFieldDescriptor {
  name: string;
  label: string;
  type: SchemaFieldType;
  required: boolean;
  hint?: string;
  placeholder?: string;
  defaultValue?: string | number | boolean | string[];
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  integer?: boolean;
}

/** What the browser posts back: strings, booleans, string lists. */
export type SchemaFormValues = Record<string, string | boolean | string[] | undefined>;

type AnyZod = z.ZodTypeAny;

function unwrap(schema: AnyZod): { inner: AnyZod; optional: boolean; defaultValue?: unknown } {
  let current: AnyZod = schema;
  let optional = false;
  let defaultValue: unknown;

  // Bounded loop: wrappers never nest deeper than a handful of levels.
  for (let i = 0; i < 10; i++) {
    if (current instanceof z.ZodOptional || current instanceof z.ZodNullable) {
      optional = true;
      current = current.unwrap();
    } else if (current instanceof z.ZodDefault) {
      optional = true;
      defaultValue = current._def.defaultValue();
      current = current._def.innerType;
    } else if (current instanceof z.ZodEffects) {
      current = current.innerType();
    } else if (current instanceof z.ZodCatch) {
      current = current._def.innerType;
    } else {
      break;
    }
  }

  return { inner: current, optional, defaultValue };
}

function humanize(key: string) {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return spaced.charAt(0).toLocaleUpperCase("tr-TR") + spaced.slice(1);
}

/** Object shape of a schema (unwrapping effects), or null. */
export function schemaShape(schema: AnyZod): Record<string, AnyZod> | null {
  const { inner } = unwrap(schema);
  return inner instanceof z.ZodObject ? (inner.shape as Record<string, AnyZod>) : null;
}

export function describeSchema(
  schema: AnyZod,
  meta: FieldMetaMap = {},
  secretFields: readonly string[] = []
): SchemaFieldDescriptor[] {
  const shape = schemaShape(schema);
  if (!shape) return [];

  return Object.entries(shape).map(([name, fieldSchema]) => {
    const { inner, optional, defaultValue } = unwrap(fieldSchema);
    const fieldMeta = meta[name] ?? {};
    const descriptor: SchemaFieldDescriptor = {
      name,
      label: fieldMeta.label ?? fieldSchema.description ?? inner.description ?? humanize(name),
      type: "text",
      required: !optional,
      hint: fieldMeta.hint,
      placeholder: fieldMeta.placeholder,
    };

    if (secretFields.includes(name)) {
      descriptor.type = "secret";
    } else if (inner instanceof z.ZodString) {
      const kinds = inner._def.checks.map((check) => check.kind);
      descriptor.type = fieldMeta.multiline ? "textarea" : kinds.includes("url") ? "url" : kinds.includes("email") ? "email" : "text";
    } else if (inner instanceof z.ZodNumber) {
      descriptor.type = "number";
      for (const check of inner._def.checks) {
        if (check.kind === "int") descriptor.integer = true;
        if (check.kind === "min") descriptor.min = check.value;
        if (check.kind === "max") descriptor.max = check.value;
      }
    } else if (inner instanceof z.ZodBoolean) {
      descriptor.type = "boolean";
      descriptor.required = false;
    } else if (inner instanceof z.ZodEnum) {
      descriptor.type = "select";
      descriptor.options = (inner.options as string[]).map((value) => ({
        value,
        label: fieldMeta.optionLabels?.[value] ?? value,
      }));
    } else if (inner instanceof z.ZodArray) {
      descriptor.type = "list";
    }

    if (defaultValue !== undefined && isSerialisableDefault(defaultValue)) {
      descriptor.defaultValue = defaultValue;
    }

    return descriptor;
  });
}

function isSerialisableDefault(value: unknown): value is string | number | boolean | string[] {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    (Array.isArray(value) && value.every((item) => typeof item === "string"))
  );
}

/** Splits a list field typed as "a, b" or one item per line. */
export function splitList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Converts posted form values into schema input: numbers parsed, empty
 * optional fields dropped (so defaults apply), lists split. Unknown keys are
 * ignored. The result still has to go through `schema.safeParse`.
 */
export function formValuesToInput(fields: SchemaFieldDescriptor[], values: SchemaFormValues) {
  const input: Record<string, unknown> = {};

  for (const field of fields) {
    const raw = values[field.name];

    switch (field.type) {
      case "boolean":
        input[field.name] = raw === true || raw === "true" || raw === "on" || raw === "1";
        break;
      case "number": {
        const text = typeof raw === "string" ? raw.trim().replace(",", ".") : "";
        if (text === "") {
          if (field.required) input[field.name] = undefined;
          break;
        }
        input[field.name] = Number(text);
        break;
      }
      case "list": {
        const list = Array.isArray(raw) ? raw.map((item) => item.trim()).filter(Boolean) : typeof raw === "string" ? splitList(raw) : [];
        if (list.length || field.required) input[field.name] = list;
        break;
      }
      default: {
        const text = typeof raw === "string" ? raw.trim() : "";
        if (text === "" && !field.required) break;
        input[field.name] = text;
      }
    }
  }

  return input;
}

/** zod issues → { field: "message" } for inline form errors. */
export function issuesToFieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

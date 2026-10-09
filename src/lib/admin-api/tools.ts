/**
 * LLM tool definitions (name / description / input_schema — the JSON Schema
 * shape Claude and most agent frameworks accept) generated from the admin
 * API operations: path, query and body fields merged into one object.
 */
import { z } from "zod/v4";
import type { AnyOperation } from "./operation";

export interface AgentToolDefinition {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required: string[] };
  /** Not sent to the model: how to turn the input into an HTTP call. */
  "x-http": { method: string; path: string; pathParams: string[]; queryParams: string[]; bodyParams: string[] };
}

const snake = (id: string) => id.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

function fields(schema: z.ZodType | undefined) {
  if (!schema) return { properties: {} as Record<string, unknown>, required: [] as string[] };
  let current: z.ZodType = schema;
  while (current instanceof z.ZodOptional) current = current.unwrap() as z.ZodType;
  const json = z.toJSONSchema(current, { target: "draft-2020-12", io: "input", unrepresentable: "any" }) as {
    properties?: Record<string, unknown>;
    required?: string[];
  };
  return { properties: json.properties ?? {}, required: schema instanceof z.ZodOptional ? [] : (json.required ?? []) };
}

export function toolDefinition(operation: AnyOperation): AgentToolDefinition {
  const path = fields(operation.params);
  const query = fields(operation.query);
  const body = fields(operation.body);
  const scope = operation.permission ? ` Gerekli yetki: ${operation.permission}.` : "";
  return {
    name: snake(operation.id),
    description: `${operation.summary}. ${operation.description ?? ""}`.trim() + scope,
    input_schema: {
      type: "object",
      properties: { ...path.properties, ...query.properties, ...body.properties },
      required: [...new Set([...Object.keys(path.properties), ...body.required])],
    },
    "x-http": {
      method: operation.method,
      path: operation.path,
      pathParams: Object.keys(path.properties),
      queryParams: Object.keys(query.properties),
      bodyParams: Object.keys(body.properties),
    },
  };
}

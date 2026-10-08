"use client";

import { FormField } from "@/components/app";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { SchemaFieldDescriptor, SchemaFormValues } from "@/lib/modules/schema-form";

const control = "h-11 md:h-9";
const EMPTY_SELECT = "__empty__";

/** Initial form values: current values first, then schema defaults. */
export function initialSchemaValues(
  fields: SchemaFieldDescriptor[],
  current: Record<string, unknown> = {}
): SchemaFormValues {
  const values: SchemaFormValues = {};
  for (const field of fields) {
    const value = current[field.name] ?? field.defaultValue;
    if (field.type === "boolean") values[field.name] = value === true;
    else if (field.type === "list") values[field.name] = Array.isArray(value) ? value.join("\n") : "";
    else values[field.name] = value === undefined || value === null ? "" : String(value);
  }
  return values;
}

/**
 * Renders a module's generated form (configSchema / productOptionsSchema
 * descriptors from src/lib/modules/schema-form.ts). Controlled: the parent
 * keeps `values` and posts them to a server action that re-validates.
 */
export function SchemaFields({
  fields,
  values,
  onChange,
  errors = {},
  idPrefix,
  disabled,
}: {
  fields: SchemaFieldDescriptor[];
  values: SchemaFormValues;
  onChange: (values: SchemaFormValues) => void;
  errors?: Record<string, string>;
  idPrefix: string;
  disabled?: boolean;
}) {
  const set = (name: string, value: string | boolean) => onChange({ ...values, [name]: value });

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {fields.map((field) => {
        const id = `${idPrefix}-${field.name}`;
        const value = values[field.name];
        const text = typeof value === "string" ? value : "";
        const wide = field.type === "textarea" || field.type === "list" || field.type === "boolean";

        if (field.type === "boolean") {
          return (
            <div key={field.name} className="flex items-start justify-between gap-4 md:col-span-2">
              <div className="space-y-0.5">
                <label htmlFor={id} className="text-sm font-medium leading-none">
                  {field.label}
                </label>
                {field.hint ? <p className="text-xs text-muted-foreground">{field.hint}</p> : null}
              </div>
              <Switch id={id} checked={value === true} disabled={disabled} onCheckedChange={(checked) => set(field.name, checked)} />
            </div>
          );
        }

        let input: React.ReactNode;
        if (field.type === "select") {
          input = (
            <Select
              value={text || (field.required ? undefined : EMPTY_SELECT)}
              onValueChange={(next) => set(field.name, next === EMPTY_SELECT ? "" : next)}
              disabled={disabled}
            >
              <SelectTrigger id={id} className={control} aria-invalid={Boolean(errors[field.name])}>
                <SelectValue placeholder="Seçin" />
              </SelectTrigger>
              <SelectContent>
                {field.required ? null : <SelectItem value={EMPTY_SELECT}>—</SelectItem>}
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        } else if (field.type === "textarea" || field.type === "list") {
          input = (
            <Textarea
              id={id}
              value={text}
              rows={field.type === "list" ? 3 : 4}
              placeholder={field.placeholder ?? (field.type === "list" ? "Her satıra bir değer" : undefined)}
              disabled={disabled}
              aria-invalid={Boolean(errors[field.name])}
              onChange={(event) => set(field.name, event.target.value)}
            />
          );
        } else {
          input = (
            <Input
              id={id}
              className={control}
              type={field.type === "secret" ? "password" : field.type === "number" ? "number" : field.type === "url" ? "url" : field.type === "email" ? "email" : "text"}
              inputMode={field.type === "number" ? (field.integer ? "numeric" : "decimal") : undefined}
              min={field.min}
              max={field.max}
              step={field.type === "number" ? (field.integer ? 1 : "any") : undefined}
              autoComplete={field.type === "secret" ? "new-password" : "off"}
              placeholder={field.type === "secret" && text ? undefined : field.placeholder}
              value={text}
              disabled={disabled}
              aria-invalid={Boolean(errors[field.name])}
              onFocus={() => {
                // Masked secret: clear on focus so typing replaces it; leaving it empty keeps the stored value.
                if (field.type === "secret" && text === "********") set(field.name, "");
              }}
              onChange={(event) => set(field.name, event.target.value)}
            />
          );
        }

        return (
          <FormField
            key={field.name}
            label={field.label}
            htmlFor={id}
            required={field.required}
            hint={field.type === "secret" ? (field.hint ?? "Kayıtlı değer gizlidir; değiştirmek için yeni değeri yazın, boş bırakırsanız korunur.") : field.hint}
            error={errors[field.name]}
            className={wide ? "md:col-span-2" : undefined}
          >
            {input}
          </FormField>
        );
      })}
    </div>
  );
}

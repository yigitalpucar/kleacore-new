import { cn } from "@/lib/utils";

/**
 * Settings-style form block: title + description on the left (lg+), fields in
 * a card on the right, optional footer with the submit button.
 *
 *   <form action={…}>
 *     <FormSection title="Profil" description="…" footer={<button className={appButton()}>Kaydet</button>}>
 *       <FormField label="Ad" htmlFor="name"><Input id="name" name="name" /></FormField>
 *     </FormSection>
 *   </form>
 */
export function FormSection({
  title,
  description,
  children,
  footer,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-10", className)}>
      <div className="space-y-1 lg:pt-1">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {description ? <p className="text-[13px] text-muted-foreground">{description}</p> : null}
      </div>
      <div className="min-w-0 rounded-lg border bg-card shadow-sm">
        <div className="space-y-5 p-4 md:p-5">{children}</div>
        {footer ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/30 px-4 py-3 md:px-5">{footer}</div>
        ) : null}
      </div>
    </section>
  );
}

/** Label + control + hint/error, stacked. */
export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium leading-none">
        {label}
        {required ? <span aria-hidden className="ml-0.5 text-muted-foreground">*</span> : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

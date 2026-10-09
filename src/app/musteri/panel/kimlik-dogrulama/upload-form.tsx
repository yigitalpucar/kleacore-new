"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { FormField, SectionCard, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";

const legalProse =
  "text-sm leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mb-1 [&_h2]:mt-4 [&_h2]:text-sm [&_h2]:font-semibold [&_p]:my-2";

type Mode = "identity" | "tax";

/** Multipart POST to /api/kyc/documents (same-origin, size-capped, content-sniffed on the server). */
export function KycUploadForm({
  corporate,
  accept,
  consent,
}: {
  corporate: boolean;
  accept: string;
  consent: { title: string; version: number; html: string };
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>(corporate ? "tax" : "identity");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!accepted) {
      setError("Devam etmek için açık rıza metnini onaylayın.");
      return;
    }
    const form = new FormData(event.currentTarget);
    form.set("consent", "on");
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/kyc/documents", { method: "POST", body: form });
        const result = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
        if (!response.ok || !result?.success) {
          const message = result?.error ?? "Belgeler gönderilemedi; lütfen tekrar deneyin.";
          setError(message);
          toast.error(message);
          return;
        }
        toast.success("Belgeleriniz alındı; inceleme sonucunu e-postayla bildireceğiz.");
        formRef.current?.reset();
        router.refresh();
      } catch {
        setError("Bağlantı hatası; lütfen tekrar deneyin.");
      }
    });
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate>
      <SectionCard
        title="Belgeleri yükle"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground" role={error ? "alert" : undefined}>
              {error ?? "Gönderdikten sonra belgeleriniz incelenene kadar değiştirilemez."}
            </p>
            <button type="submit" disabled={pending} className={appButton({ variant: "primary" })}>
              <Upload aria-hidden />
              {pending ? "Gönderiliyor…" : "Doğrulamaya gönder"}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          {corporate ? (
            <fieldset className="flex flex-wrap gap-4 text-sm">
              <legend className="sr-only">Belge türü</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="mode" checked={mode === "tax"} onChange={() => setMode("tax")} className="size-4 accent-foreground" />
                Vergi levhası
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="mode" checked={mode === "identity"} onChange={() => setMode("identity")} className="size-4 accent-foreground" />
                Yetkilinin kimlik kartı
              </label>
            </fieldset>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            {mode === "tax" ? (
              <FormField label="Vergi levhası" htmlFor="taxCertificate" required>
                <Input id="taxCertificate" name="taxCertificate" type="file" accept={accept} />
              </FormField>
            ) : (
              <>
                <FormField label="Kimlik kartı — ön yüz" htmlFor="identityFront" required>
                  <Input id="identityFront" name="identityFront" type="file" accept={accept} />
                </FormField>
                <FormField label="Kimlik kartı — arka yüz" htmlFor="identityBack" required>
                  <Input id="identityBack" name="identityBack" type="file" accept={accept} />
                </FormField>
              </>
            )}
            <FormField label="Kimliğinizle fotoğrafınız" htmlFor="selfie" hint="İsteğe bağlı">
              <Input id="selfie" name="selfie" type="file" accept={accept} />
            </FormField>
          </div>

          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium">
              {consent.title} <span className="text-xs font-normal text-muted-foreground">v{consent.version}</span>
            </summary>
            <div className={`mt-2 max-h-72 overflow-y-auto ${legalProse}`} dangerouslySetInnerHTML={{ __html: consent.html }} />
          </details>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-0.5 size-4 accent-foreground"
            />
            <span>
              {consent.title}&apos;ni okudum; kimlik belgelerimin 5651 sayılı Kanun kapsamındaki tespit yükümlülüğü için işlenmesine
              ve saklanmasına <strong>açık rıza</strong> veriyorum.
            </span>
          </label>
        </div>
      </SectionCard>
    </form>
  );
}

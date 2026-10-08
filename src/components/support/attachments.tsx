"use client";

import { useRef } from "react";
import { Download, FileText, FileX, Image as ImageIcon, Paperclip, X } from "lucide-react";
import { appButton } from "@/components/app";
import { toast } from "@/lib/toast";

/** Limits mirrored from src/lib/support/attachments.ts (the server re-checks and sniffs content). */
export const CLIENT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const CLIENT_MAX_ATTACHMENTS = 5;
const ACCEPT =
  ".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.log,.csv,.zip,.rar,.7z,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.svg";

export function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

interface AttachmentPickerProps {
  files: File[];
  onChange: (files: File[]) => void;
  id?: string;
  disabled?: boolean;
  /** Compact: only the button (reply footers); the list renders above. */
  compact?: boolean;
}

export function AttachmentPicker({ files, onChange, id = "attachments", disabled, compact }: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    const next = [...files];
    for (const file of picked) {
      if (next.length >= CLIENT_MAX_ATTACHMENTS) {
        toast.error(`En fazla ${CLIENT_MAX_ATTACHMENTS} dosya ekleyebilirsiniz.`);
        break;
      }
      if (file.size > CLIENT_MAX_ATTACHMENT_BYTES) {
        toast.error(`${file.name} dosyası 10 MB sınırını aşıyor.`);
        continue;
      }
      if (file.size === 0) {
        toast.error(`${file.name} dosyası boş.`);
        continue;
      }
      next.push(file);
    }
    onChange(next);
  };

  const list =
    files.length > 0 ? (
      <ul aria-label="Eklenecek dosyalar" className="space-y-1.5">
        {files.map((file, index) => {
          const Icon = file.type.startsWith("image/") ? ImageIcon : FileText;
          return (
            <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 py-1 pl-2.5 pr-1">
              <span className="flex min-w-0 items-center gap-2">
                <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
              </span>
              <button
                type="button"
                aria-label={`${file.name} dosyasını kaldır`}
                className={appButton({ variant: "ghost", size: "icon-sm" })}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                disabled={disabled}
              >
                <X aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    ) : null;

  const button = (
    <>
      <button
        type="button"
        className={appButton({ variant: "outline", size: compact ? "sm" : "md", className: compact ? "" : "w-full" })}
        onClick={() => inputRef.current?.click()}
        disabled={disabled || files.length >= CLIENT_MAX_ATTACHMENTS}
      >
        <Paperclip aria-hidden />
        Dosya ekle
      </button>
      <input
        ref={inputRef}
        id={id}
        type="file"
        multiple
        className="hidden"
        aria-label="Dosya ekle"
        onChange={handleChange}
        accept={ACCEPT}
      />
    </>
  );

  if (compact) return button;

  return (
    <div className="rounded-md border border-dashed p-3">
      {list ? <div className="mb-3">{list}</div> : null}
      {button}
      <p className="mt-2 text-center text-xs text-muted-foreground">
        PNG, JPG, PDF, TXT, ZIP, Office belgeleri · dosya başına en fazla 10 MB, en fazla {CLIENT_MAX_ATTACHMENTS} dosya
      </p>
    </div>
  );
}

/** Selected files above a compact reply box. */
export function SelectedFiles({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  if (files.length === 0) return null;
  return (
    <ul aria-label="Eklenecek dosyalar" className="mt-3 flex flex-wrap gap-2">
      {files.map((file, index) => (
        <li key={`${file.name}-${index}`} className="flex items-center gap-1.5 rounded-md border bg-background py-1 pl-2.5 pr-1 text-[13px]">
          <Paperclip aria-hidden className="size-3.5 text-muted-foreground" />
          <span className="max-w-[180px] truncate">{file.name}</span>
          <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
          <button
            type="button"
            aria-label={`${file.name} dosyasını kaldır`}
            className={appButton({ variant: "ghost", size: "icon-sm" })}
            onClick={() => onChange(files.filter((_, i) => i !== index))}
          >
            <X aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

export interface ThreadAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/** Attachments of one message: stored files are downloadable; legacy name-only rows are marked unavailable. */
export function MessageAttachments({ files, legacy }: { files: ThreadAttachment[]; legacy: string[] }) {
  if (files.length === 0 && legacy.length === 0) return null;
  return (
    <div className="mt-3 border-t border-dashed pt-3">
      <p className="mb-2 text-xs text-muted-foreground">Ekler</p>
      <ul className="flex flex-wrap gap-2">
        {files.map((file) => {
          const Icon = file.mimeType.startsWith("image/") ? ImageIcon : FileText;
          return (
            <li key={file.id}>
              <a
                href={`/api/support/attachments/${file.id}`}
                className="flex min-h-9 items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                download
              >
                <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="max-w-[220px] truncate text-[13px] font-medium">{file.fileName}</span>
                <span className="text-xs text-muted-foreground">{formatFileSize(file.sizeBytes)}</span>
                <Download aria-hidden className="size-3.5 text-muted-foreground" />
              </a>
            </li>
          );
        })}
        {legacy.map((name, index) => (
          <li
            key={`legacy-${index}`}
            className="flex min-h-9 items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-muted-foreground"
            title="Bu ek eski sistemde yalnızca dosya adıyla kaydedildi; içerik yüklenmedi."
          >
            <FileX aria-hidden className="size-4 shrink-0" />
            <span className="max-w-[220px] truncate text-[13px]">{name}</span>
            <span className="text-xs">dosya mevcut değil</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** POSTs a multipart ticket form to one of the /api/…/tickets routes. */
export async function postTicketForm<T = unknown>(
  url: string,
  form: FormData
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const response = await fetch(url, { method: "POST", body: form, credentials: "same-origin" });
    const body = (await response.json().catch(() => null)) as { success?: boolean; data?: T; error?: string } | null;
    if (response.ok && body?.success) return { success: true, data: body.data as T };
    if (response.status === 413) return { success: false, error: "Dosyalar çok büyük (dosya başına en fazla 10 MB)." };
    return { success: false, error: body?.error ?? "İşlem başarısız oldu" };
  } catch {
    return { success: false, error: "Sunucuya ulaşılamadı" };
  }
}

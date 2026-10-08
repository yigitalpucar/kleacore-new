"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Inbox, Pencil, Plug, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { EmptyState, FormField, PageHeader, SectionCard, StatusBadge, appButton, enumLabel } from "@/components/app";
import { Input } from "@/components/ui/input";
import {
  deleteSupportMailbox,
  pollSupportMailboxesNow,
  saveAutoCloseDays,
  saveSupportMailbox,
  testSupportMailbox,
} from "@/lib/actions/admin/support-settings";
import { formatDateTime } from "@/lib/format/date";
import { toast } from "@/lib/toast";

type Department = "" | "GENERAL" | "TECHNICAL" | "BILLING" | "SALES";

interface MailboxRow {
  id: string;
  name: string;
  address: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  folder: string;
  processedFolder: string;
  department: Department | string;
  isActive: boolean;
  lastPolledAt: string | null;
  lastError: string | null;
}

interface InboundRow {
  id: string;
  fromAddress: string;
  subject: string;
  status: string;
  reason: string | null;
  createdAt: string;
  ticket: { id: string; ticketNumber: string } | null;
}

interface Props {
  autoCloseDays: number;
  mailboxes: MailboxRow[];
  inbound: InboundRow[];
  lastRun: { startedAt: string; status: string } | null;
}

const DEPARTMENTS = ["GENERAL", "TECHNICAL", "BILLING", "SALES"] as const;
const selectClass =
  "h-11 w-full rounded-md border bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9";

const EMPTY_FORM = {
  name: "Destek",
  address: "",
  host: "",
  port: "993",
  secure: true,
  username: "",
  password: "",
  folder: "INBOX",
  processedFolder: "",
  department: "" as Department,
  isActive: true,
};

const STATUS_TONE: Record<string, "success" | "muted" | "danger"> = { PROCESSED: "success", IGNORED: "muted", FAILED: "danger" };
const STATUS_LABEL: Record<string, string> = { PROCESSED: "İşlendi", IGNORED: "Yok sayıldı", FAILED: "Hata" };
const REASON_LABEL: Record<string, string> = {
  REPLY: "Yanıt eklendi",
  NEW_TICKET: "Yeni talep",
  NEW_TICKET_GUEST: "Yeni talep (kayıtsız gönderen)",
  NEW_TICKET_THREAD_NOT_OWNED: "Yeni talep (talep no başkasına ait)",
  AUTO_SUBMITTED: "Otomatik yanıt",
  X_AUTOREPLY: "Otomatik yanıt",
  PRECEDENCE: "Toplu / otomatik posta",
  MAILING_LIST: "E-posta listesi",
  BOUNCE: "Geri dönen posta",
  DELIVERY_REPORT: "Teslim raporu",
  SYSTEM_SENDER: "Sistem göndericisi",
  AUTO_SUBJECT: "Otomatik yanıt (konu)",
  OWN_ADDRESS: "Kendi adresimiz",
  SENDER_RATE_LIMIT: "Gönderici sınırı (saatte 20)",
  NO_SENDER: "Gönderen yok",
};

export function SupportSettingsContent({ autoCloseDays, mailboxes, inbound, lastRun }: Props) {
  const router = useRouter();
  const [days, setDays] = useState(String(autoCloseDays));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(mailboxes.length === 0);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState<string | null>(null);

  const update = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const saveDays = async () => {
    setBusy("days");
    const result = await saveAutoCloseDays(Number(days));
    setBusy(null);
    if (!result.success) return toast.error(result.error);
    toast.success("Otomatik kapatma ayarı kaydedildi");
    router.refresh();
  };

  const edit = (m: MailboxRow) => {
    setEditingId(m.id);
    setShowForm(true);
    setForm({
      name: m.name,
      address: m.address,
      host: m.host,
      port: String(m.port),
      secure: m.secure,
      username: m.username,
      password: "",
      folder: m.folder,
      processedFolder: m.processedFolder,
      department: (m.department || "") as Department,
      isActive: m.isActive,
    });
  };

  const closeForm = () => {
    setEditingId(null);
    setShowForm(false);
    setForm(EMPTY_FORM);
  };

  const saveMailbox = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy("mailbox");
    const result = await saveSupportMailbox(editingId, {
      ...form,
      port: Number(form.port),
      password: form.password || undefined,
      department: form.department || null,
      processedFolder: form.processedFolder || null,
    });
    setBusy(null);
    if (!result.success) return toast.error(result.error);
    toast.success("Posta kutusu kaydedildi");
    closeForm();
    router.refresh();
  };

  const remove = async (m: MailboxRow) => {
    if (!window.confirm(`"${m.name}" posta kutusu silinsin mi? Gelen e-posta kayıtları korunur.`)) return;
    await deleteSupportMailbox(m.id);
    toast.success("Posta kutusu silindi");
    router.refresh();
  };

  const test = async (m: MailboxRow) => {
    setBusy(`test-${m.id}`);
    const result = await testSupportMailbox(m.id);
    setBusy(null);
    if (!result.success) return toast.error(result.error);
    toast.success(`Bağlantı başarılı · ${result.data.unseen} okunmamış ileti`);
  };

  const pollNow = async () => {
    setBusy("poll");
    const result = await pollSupportMailboxesNow();
    setBusy(null);
    if (!result.success) return toast.error(result.error);
    const r = result.data;
    toast.success(`${r.created} yeni talep, ${r.replied} yanıt, ${r.ignored} yok sayıldı${r.failed ? `, ${r.failed} hata` : ""}`);
    router.refresh();
  };

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/destek", label: "Destek talepleri" }}
        title="Destek ayarları"
        description="E-posta ile talep (IMAP) posta kutuları ve otomatik kapatma."
      />

      <SectionCard
        title="Otomatik kapatma"
        description="Müşteri yanıtı beklenen (yanıtlandı / müşteri yanıtı bekleniyor) talepler bu kadar gün yanıtsız kalınca kapatılır. Kapanmadan bir gün önce müşteriye uyarı e-postası gider. 0 = kapalı."
        footer={
          <button type="button" className={appButton()} onClick={() => void saveDays()} disabled={busy === "days"}>
            <Save aria-hidden />
            Kaydet
          </button>
        }
      >
        <FormField label="Gün sayısı" htmlFor="auto-close-days">
          <Input
            id="auto-close-days"
            type="number"
            min={0}
            max={90}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="h-11 max-w-32 md:h-10"
          />
        </FormField>
      </SectionCard>

      <SectionCard
        title="Destek posta kutuları"
        description="Okunmamış iletiler 2 dakikada bir okunur: doğrulanmış müşteri e-postası eşleşirse talep müşteriye, konudaki [#T-…] numarası veya yanıt başlıkları eşleşirse mevcut talebe eklenir."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={appButton({ variant: "outline", size: "sm" })}
              onClick={() => void pollNow()}
              disabled={busy === "poll" || mailboxes.length === 0}
            >
              <RefreshCw aria-hidden className={busy === "poll" ? "animate-spin" : undefined} />
              Şimdi oku
            </button>
            {!showForm ? (
              <button type="button" className={appButton({ size: "sm" })} onClick={() => setShowForm(true)}>
                <Plus aria-hidden />
                Posta kutusu ekle
              </button>
            ) : null}
          </div>
        }
        flush
      >
        {lastRun ? (
          <p className="border-b px-4 py-2 text-xs text-muted-foreground">
            Son okuma: {formatDateTime(lastRun.startedAt)} · <StatusBadge kind="cronRun" status={lastRun.status} />
          </p>
        ) : null}
        {mailboxes.length === 0 && !showForm ? (
          <div className="p-4">
            <EmptyState icon={Inbox} title="Posta kutusu yok" description="E-posta ile talep almak için destek@ kutusunu ekleyin." compact />
          </div>
        ) : (
          <ul className="divide-y">
            {mailboxes.map((m) => (
              <li key={m.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {m.name} <span className="font-normal text-muted-foreground">· {m.address}</span>
                  </p>
                  <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
                    {m.username}@{m.host}:{m.port} {m.secure ? "TLS" : "STARTTLS"} · {m.folder}
                    {m.processedFolder ? ` → ${m.processedFolder}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.isActive ? "Etkin" : "Devre dışı"} · {m.department ? enumLabel("ticketDepartment", m.department) : "Genel"} ·{" "}
                    {m.lastPolledAt ? `son okuma ${formatDateTime(m.lastPolledAt)}` : "henüz okunmadı"}
                  </p>
                  {m.lastError ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">Son hata: {m.lastError}</p> : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    className={appButton({ variant: "outline", size: "sm" })}
                    onClick={() => void test(m)}
                    disabled={busy === `test-${m.id}`}
                  >
                    <Plug aria-hidden />
                    Bağlantıyı test et
                  </button>
                  <button type="button" className={appButton({ variant: "outline", size: "sm" })} onClick={() => edit(m)}>
                    <Pencil aria-hidden />
                    Düzenle
                  </button>
                  <button
                    type="button"
                    aria-label={`${m.name} posta kutusunu sil`}
                    className={appButton({ variant: "ghost", size: "icon-sm" })}
                    onClick={() => void remove(m)}
                  >
                    <Trash2 aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {showForm ? (
          <form onSubmit={saveMailbox} className="space-y-4 border-t p-4">
            <h3 className="text-sm font-semibold">{editingId ? "Posta kutusunu düzenle" : "Yeni posta kutusu"}</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Ad" htmlFor="mb-name" required>
                <Input id="mb-name" value={form.name} onChange={(e) => update("name", e.target.value)} className="h-11 md:h-10" />
              </FormField>
              <FormField label="Destek adresi" htmlFor="mb-address" required hint="Müşterilerin yazdığı adres; e-postalarda Reply-To olarak kullanılır.">
                <Input
                  id="mb-address"
                  type="email"
                  placeholder="destek@kleacore.com"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  className="h-11 md:h-10"
                />
              </FormField>
              <FormField label="IMAP sunucusu" htmlFor="mb-host" required>
                <Input
                  id="mb-host"
                  placeholder="mail.kleacore.com"
                  value={form.host}
                  onChange={(e) => update("host", e.target.value)}
                  className="h-11 md:h-10"
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Port" htmlFor="mb-port" required>
                  <Input id="mb-port" type="number" value={form.port} onChange={(e) => update("port", e.target.value)} className="h-11 md:h-10" />
                </FormField>
                <FormField label="Güvenlik" htmlFor="mb-secure">
                  <select
                    id="mb-secure"
                    value={form.secure ? "tls" : "starttls"}
                    onChange={(e) => {
                      const secure = e.target.value === "tls";
                      setForm((f) => ({ ...f, secure, port: f.port === "993" || f.port === "143" ? (secure ? "993" : "143") : f.port }));
                    }}
                    className={selectClass}
                  >
                    <option value="tls">TLS (993)</option>
                    <option value="starttls">STARTTLS (143)</option>
                  </select>
                </FormField>
              </div>
              <FormField label="Kullanıcı adı" htmlFor="mb-user" required>
                <Input
                  id="mb-user"
                  autoComplete="off"
                  value={form.username}
                  onChange={(e) => update("username", e.target.value)}
                  className="h-11 md:h-10"
                />
              </FormField>
              <FormField
                label="Parola"
                htmlFor="mb-pass"
                required={!editingId}
                hint={editingId ? "Değiştirmek istemiyorsanız boş bırakın. Şifreli saklanır." : "Şifreli saklanır."}
              >
                <Input
                  id="mb-pass"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  className="h-11 md:h-10"
                />
              </FormField>
              <FormField label="Klasör" htmlFor="mb-folder">
                <Input id="mb-folder" value={form.folder} onChange={(e) => update("folder", e.target.value)} className="h-11 md:h-10" />
              </FormField>
              <FormField label="İşlenenleri taşı" htmlFor="mb-processed" hint="Boşsa iletiler yalnızca okundu işaretlenir.">
                <Input
                  id="mb-processed"
                  placeholder="INBOX.Islenen"
                  value={form.processedFolder}
                  onChange={(e) => update("processedFolder", e.target.value)}
                  className="h-11 md:h-10"
                />
              </FormField>
              <FormField label="Departman" htmlFor="mb-dept" hint="Yeni talepler bu departmanda açılır.">
                <select
                  id="mb-dept"
                  value={form.department}
                  onChange={(e) => update("department", e.target.value as Department)}
                  className={selectClass}
                >
                  <option value="">Genel</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {enumLabel("ticketDepartment", d)}
                    </option>
                  ))}
                </select>
              </FormField>
              <label className="flex items-center gap-2 self-end text-sm">
                <input type="checkbox" checked={form.isActive} onChange={(e) => update("isActive", e.target.checked)} className="size-4" />
                Etkin (cron okusun)
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={appButton({ variant: "ghost" })} onClick={closeForm}>
                <X aria-hidden />
                Vazgeç
              </button>
              <button type="submit" className={appButton()} disabled={busy === "mailbox"}>
                <Save aria-hidden />
                {busy === "mailbox" ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </form>
        ) : null}
      </SectionCard>

      <SectionCard title="Son gelen e-postalar" description="Son 50 ileti ve ne yapıldığı." flush>
        {inbound.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Henüz e-posta işlenmedi.</p>
        ) : (
          <ul className="divide-y">
            {inbound.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.subject || "(Konu yok)"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.fromAddress} · {formatDateTime(row.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
                  <StatusBadge tone={STATUS_TONE[row.status] ?? "neutral"} label={STATUS_LABEL[row.status] ?? row.status} />
                  <span className="text-muted-foreground">{row.reason ? REASON_LABEL[row.reason] ?? row.reason.slice(0, 80) : ""}</span>
                  {row.ticket ? (
                    <Link href={`/yonetim/destek/${row.ticket.id}`} className="font-mono hover:underline">
                      #{row.ticket.ticketNumber}
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

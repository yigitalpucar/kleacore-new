"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlurFade } from "@/components/magicui/blur-fade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Send,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  File,
} from "lucide-react";
import { createTicket } from "@/lib/actions/customer/tickets";
import { toast } from "@/lib/toast";

interface ServiceItem {
  id: string;
  label: string;
  domain: string | null;
  productName: string;
}

interface YeniDestekContentProps {
  services: ServiceItem[];
}

const departments = [
  { value: "GENERAL", label: "Genel", description: "Genel sorular" },
  { value: "TECHNICAL", label: "Teknik Destek", description: "Sunucu, hosting, domain sorunları" },
  { value: "SALES", label: "Satış", description: "Fiyatlandırma, yeni hizmetler" },
  { value: "BILLING", label: "Muhasebe", description: "Fatura, ödeme sorunları" },
];

const priorities = [
  { value: "LOW", label: "Düşük", description: "Acil değil, zaman olunca bakılabilir" },
  { value: "MEDIUM", label: "Normal", description: "Standart öncelik" },
  { value: "HIGH", label: "Yüksek", description: "Önemli, hızlı yanıt gerekiyor" },
];

interface AttachedFile {
  id: string;
  name: string;
  size: string;
  type: "image" | "document";
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS = 10;

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function YeniDestekContent({ services }: YeniDestekContentProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [department, setDepartment] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [service, setService] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  const handleFileAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    if (attachedFiles.length >= MAX_ATTACHMENTS) {
      toast.error(`En fazla ${MAX_ATTACHMENTS} dosya ekleyebilirsiniz.`);
      event.target.value = "";
      return;
    }

    const nextFiles: AttachedFile[] = [];

    for (const file of files) {
      if (attachedFiles.length + nextFiles.length >= MAX_ATTACHMENTS) {
        break;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`${file.name} dosyası 10MB sınırını aşıyor.`);
        continue;
      }

      nextFiles.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type.startsWith("image/") ? "image" : "document",
      });
    }

    if (nextFiles.length > 0) {
      setAttachedFiles((prev) => [...prev, ...nextFiles]);
      toast.success(`${nextFiles.length} dosya eklendi.`);
    }

    event.target.value = "";
  };

  const removeFile = (id: string) => {
    setAttachedFiles(attachedFiles.filter((f) => f.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.set("subject", subject);
    formData.set("department", department);
    formData.set("priority", priority);
    formData.set("message", message);
    if (service) {
      formData.set("relatedServiceId", service);
    }
    if (attachedFiles.length > 0) {
      formData.set("attachments", JSON.stringify(attachedFiles));
    }

    const result = await createTicket(formData);

    if (result.success) {
      toast.success("Destek talebiniz oluşturuldu.");
      router.push("/musteri/panel/destek");
    } else {
      const errorMessage = result.error ?? "Bir hata oluştu";
      setError(errorMessage);
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case "image":
        return ImageIcon;
      case "document":
        return FileText;
      default:
        return File;
    }
  };

  const isFormValid = department && subject.trim() && message.trim();

  return (
    <div className="space-y-6">
      {/* Header */}
      <BlurFade delay={0.1} inView>
        <div className="flex items-center gap-4">
          <Link href="/musteri/panel/destek">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Yeni Destek Talebi</h1>
            <p className="text-muted-foreground">
              Sorununuzu detayli aciklayin, size en kisa surede yardimci olalim.
            </p>
          </div>
        </div>
      </BlurFade>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <BlurFade delay={0.15} inView>
              <Card>
                <CardHeader>
                  <CardTitle>Talep Detaylari</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Department */}
                  <div className="space-y-2">
                    <Label htmlFor="department">Departman *</Label>
                    <Select value={department} onValueChange={setDepartment}>
                      <SelectTrigger id="department">
                        <SelectValue placeholder="Departman secin" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.value} value={dept.value}>
                            <div>
                              <p className="font-medium">{dept.label}</p>
                              <p className="text-xs text-muted-foreground">{dept.description}</p>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Related Service */}
                  <div className="space-y-2">
                    <Label htmlFor="service">İlgili Hizmet</Label>
                    <Select value={service} onValueChange={setService}>
                      <SelectTrigger id="service">
                        <SelectValue placeholder="Hizmet secin (opsiyonel)" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((svc) => (
                          <SelectItem key={svc.id} value={svc.id}>
                            {svc.label || svc.productName}
                            {svc.domain ? ` - ${svc.domain}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Subject */}
                  <div className="space-y-2">
                    <Label htmlFor="subject">Konu *</Label>
                    <Input
                      id="subject"
                      placeholder="Sorununuzu kisaca ozetleyin"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>

                  {/* Message */}
                  <div className="space-y-2">
                    <Label htmlFor="message">Mesaj *</Label>
                    <Textarea
                      id="message"
                      placeholder="Sorununuzu detayli aciklayin. Ne zaman basladi? Ne denediniz? Hata mesaji var mi?"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={8}
                    />
                  </div>

                  {/* Attachments */}
                  <div className="space-y-2">
                    <Label>Dosya Ekleri</Label>
                    <div className="border-2 border-dashed rounded-lg p-4">
                      {attachedFiles.length > 0 && (
                        <div className="space-y-2 mb-4">
                          {attachedFiles.map((file) => {
                            const FileIcon = getFileIcon(file.type);
                            return (
                              <div
                                key={file.id}
                                className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                              >
                                <div className="flex items-center gap-2">
                                  <FileIcon className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm">{file.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({file.size})
                                  </span>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => removeFile(file.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleFileAttach}
                      >
                        <Paperclip className="mr-2 h-4 w-4" />
                        Dosya Ekle
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                        accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.zip,.rar,.doc,.docx"
                      />
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        PNG, JPG, PDF, ZIP - Maksimum 10MB
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </BlurFade>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <BlurFade delay={0.2} inView>
              <Card>
                <CardHeader>
                  <CardTitle>Oncelik</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {priorities.map((p) => (
                      <label
                        key={p.value}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          priority === p.value
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="priority"
                          value={p.value}
                          checked={priority === p.value}
                          onChange={(e) => setPriority(e.target.value)}
                          className="mt-1"
                        />
                        <div>
                          <p className="font-medium">{p.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </BlurFade>

            <BlurFade delay={0.25} inView>
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <h4 className="font-medium mb-2">Hızlı İpuçları</h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li>&bull; Sorunu detayli aciklayin</li>
                    <li>&bull; Hata mesajlarini ekleyin</li>
                    <li>&bull; Ekran goruntusu paylasin</li>
                    <li>&bull; Domain/IP bilgisi verin</li>
                  </ul>
                </CardContent>
              </Card>
            </BlurFade>

            <BlurFade delay={0.3} inView>
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={!isFormValid || isSubmitting}
              >
                {isSubmitting ? (
                  "Gonderiliyor..."
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Talebi Gonder
                  </>
                )}
              </Button>
            </BlurFade>
          </div>
        </div>
      </form>
    </div>
  );
}

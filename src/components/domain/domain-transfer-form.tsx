"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requestDomainTransfer } from "@/lib/actions/public/domains";
import { toast } from "@/lib/toast";
import { ArrowRight, Loader2, RefreshCw } from "lucide-react";

interface DomainTransferFormProps {
  isLoggedIn: boolean;
  isAutomatedTransferAvailable: boolean;
}

export function DomainTransferForm({
  isLoggedIn,
  isAutomatedTransferAvailable,
}: DomainTransferFormProps) {
  const router = useRouter();
  const [domain, setDomain] = useState("");
  const [eppCode, setEppCode] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<null | { success: boolean; message: string }>(null);

  const handleTransfer = async () => {
    if (!domain.trim() || !eppCode.trim() || !email.trim()) return;

    setIsLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.set("domain", domain);
      formData.set("eppCode", eppCode);
      formData.set("email", email);

      const response = await requestDomainTransfer(formData);
      const message = response.success
        ? response.message ?? "Transfer talebiniz alındı."
        : response.error ?? "Transfer talebi oluşturulamadı.";

      setResult({
        success: response.success,
        message,
      });

      if (response.success) {
        toast.success(message);

        const invoiceId =
          "data" in response &&
          response.data &&
          "invoiceId" in response.data &&
          response.data.invoiceId
            ? response.data.invoiceId
            : null;

        if (invoiceId) {
          router.push(`/musteri/panel/faturalar/${invoiceId}`);
          return;
        }
      } else {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          Transfer Başlat
          {isLoggedIn && isAutomatedTransferAvailable && (
            <Badge variant="secondary" className="ml-auto">
              Otomatik transfer
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoggedIn && isAutomatedTransferAvailable && (
          <p className="text-sm text-muted-foreground">
            Giriş yaptınız ve registrar aktif. Transfer işlemi otomatik başlatılır, ardından
            fatura ödeme sayfasına yönlendirilirsiniz.
          </p>
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">Domain Adı</label>
          <Input
            placeholder="ornek.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">EPP / Auth Kodu</label>
          <Input
            placeholder="EPP kodunuzu girin"
            value={eppCode}
            onChange={(e) => setEppCode(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            EPP kodunu mevcut sağlayıcınızdan alabilirsiniz.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium mb-2 block">İletişim E-postası</label>
          <Input
            type="email"
            placeholder="ornek@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {result && (
          <div
            className={`p-4 rounded-lg ${
              result.success
                ? "bg-green-500/10 text-green-600"
                : "bg-red-500/10 text-red-600"
            }`}
          >
            {result.message}
          </div>
        )}

        <Button
          className="w-full"
          size="lg"
          onClick={handleTransfer}
          disabled={isLoading || !domain.trim() || !eppCode.trim() || !email.trim()}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Kontrol Ediliyor...
            </>
          ) : (
            <>
              Transfer Başlat
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
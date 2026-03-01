"use client";

import { useState, useTransition } from "react";
import { Globe, ArrowRight, Search, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { searchDomainAvailability, type DomainAvailabilityResult } from "@/lib/actions/public/domains";
import type { DomainChoice } from "@/app/hosting/satin-al/[slug]/content";

interface StepDomainProps {
  domainChoice: DomainChoice;
  onDomainChoice: (choice: DomainChoice) => void;
  onNext: () => void;
}

const OPTIONS = [
  {
    type: "new" as const,
    title: "Yeni domain al",
    description: "Yeni bir domain adı kaydet",
    icon: Globe,
  },
  {
    type: "existing" as const,
    title: "Mevcut domainimi kullan",
    description: "Sahip olduğum domaini bağla",
    icon: Globe,
  },
  {
    type: "later" as const,
    title: "Sonra karar vereceğim",
    description: "Domain seçimini atla",
    icon: ArrowRight,
  },
];

export const StepDomain = ({ domainChoice, onDomainChoice, onNext }: StepDomainProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [existingDomain, setExistingDomain] = useState(domainChoice.domain ?? "");
  const [results, setResults] = useState<DomainAvailabilityResult[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    startTransition(async () => {
      const res = await searchDomainAvailability(searchQuery);
      if (res.success && res.data) {
        setResults(res.data.results);
      }
    });
  };

  const handleSelectDomain = (result: DomainAvailabilityResult) => {
    onDomainChoice({
      type: "new",
      domain: result.domain,
      price: result.price,
      renewPrice: result.renewPrice,
    });
  };

  const canContinue =
    domainChoice.type === "later" ||
    (domainChoice.type === "new" && domainChoice.domain) ||
    (domainChoice.type === "existing" && existingDomain.trim());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Domain Seçimi</h2>
        <p className="text-sm text-muted-foreground">
          Hosting paketiniz için domain belirleyin.
        </p>
      </div>

      {/* Option Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((opt) => (
          <Card
            key={opt.type}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              domainChoice.type === opt.type && "ring-2 ring-primary"
            )}
            onClick={() => {
              onDomainChoice({ type: opt.type });
              setResults([]);
            }}
          >
            <CardContent className="p-4 text-center">
              <opt.icon className="h-6 w-6 mx-auto mb-2 text-primary" />
              <p className="font-medium text-sm">{opt.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{opt.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New Domain Search */}
      {domainChoice.type === "new" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="ornek.com"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.map((r) => (
                <div
                  key={r.domain}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border text-sm transition-all",
                    r.available
                      ? "cursor-pointer hover:border-primary"
                      : "opacity-50",
                    domainChoice.domain === r.domain && "ring-2 ring-primary bg-primary/5"
                  )}
                  onClick={() => r.available && handleSelectDomain(r)}
                >
                  <div className="flex items-center gap-2">
                    {domainChoice.domain === r.domain ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="font-medium">{r.domain}</span>
                  </div>
                  <div className="text-right">
                    {r.available ? (
                      <span className="text-primary font-medium">₺{r.price}/yıl</span>
                    ) : (
                      <span className="text-muted-foreground">Kayıtlı</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Existing Domain Input */}
      {domainChoice.type === "existing" && (
        <Input
          placeholder="mevcut-domain.com"
          value={existingDomain}
          onChange={(e) => {
            setExistingDomain(e.target.value);
            onDomainChoice({ type: "existing", domain: e.target.value });
          }}
        />
      )}

      {/* Next Button */}
      <div className="flex justify-end pt-4">
        <Button onClick={onNext} disabled={!canContinue}>
          Devam Et
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Check, X, Loader2, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { searchDomainAvailability } from "@/lib/actions/public/domains";
import { toast } from "@/lib/toast";
import { useCartStore } from "@/store/cart-store";

interface DomainResult {
  domain: string;
  available: boolean;
  price: number;
  renewPrice: number;
}

export interface DomainTldPrice {
  ext: string;
  price: number;
  renewPrice: number;
}

interface DomainSearchProps {
  tlds: DomainTldPrice[];
}

export function DomainSearch({ tlds }: DomainSearchProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<DomainResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const addDomain = useCartStore((state) => state.addDomain);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const result = await searchDomainAvailability(
        query,
        tlds.map((tld) => tld.ext),
      );

      if (!result.success || !result.data) {
        setResults([]);
        toast.error(result.error ?? "Domain sorgusu tamamlanamadı");
        return;
      }

      setResults(
        result.data.results.map((item) => ({
          domain: item.domain,
          available: item.available,
          price: item.price,
          renewPrice: item.renewPrice,
        })),
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleAddToCart = (result: DomainResult) => {
    const wasAdded = addDomain({
      domain: result.domain,
      price: result.price,
      renewPrice: result.renewPrice,
    });

    if (wasAdded) {
      toast.success(`${result.domain} sepete eklendi.`);
      return;
    }

    toast.info("Bu domain zaten sepetinizde.");
  };

  return (
    <div className="w-full">
      {/* Search Box */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Hayalinizdeki domain adını yazın..."
            className="h-14 pl-12 pr-4 text-lg"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button
          size="lg"
          className="h-14 px-8"
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
        >
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Aranıyor...
            </>
          ) : (
            "Ara"
          )}
        </Button>
      </div>

      {/* Results */}
      {isSearching && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isSearching && hasSearched && results.length > 0 && (
        <div className="space-y-3">
          {results.map((result) => (
            <Card
              key={result.domain}
              className={cn(
                "transition-all hover:shadow-md",
                result.available
                  ? "border-green-500/50 bg-green-500/5"
                  : "border-border opacity-60"
              )}
            >
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full",
                      result.available
                        ? "bg-green-500/20 text-green-600"
                        : "bg-red-500/20 text-red-500"
                    )}
                  >
                    {result.available ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <X className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="break-words text-lg font-semibold">{result.domain}</p>
                    <p className="text-sm text-muted-foreground">
                      {result.available
                        ? "Bu domain müsait!"
                        : "Bu domain alınmış"}
                    </p>
                  </div>
                </div>
                <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:justify-end">
                  {result.available && (
                    <>
                      <div className="text-right">
                        <p className="font-bold text-xl">₺{result.price}</p>
                        <p className="text-xs text-muted-foreground">
                          Yenileme: ₺{result.renewPrice}/yıl
                        </p>
                      </div>
                      <Button className="shrink-0" onClick={() => handleAddToCart(result)}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Sepete Ekle
                      </Button>
                    </>
                  )}
                  {!result.available && (
                    <Button variant="outline" size="sm" asChild>
                      <Link
                        href={`/domain/whois?domain=${encodeURIComponent(result.domain)}`}
                      >
                        Whois Sorgula
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* TLD Pricing */}
      {!hasSearched && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
          {tlds.slice(0, 8).map((tld) => (
            <Card key={tld.ext} className="text-center hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <p className="text-lg font-bold text-primary">{tld.ext}</p>
                <p className="text-2xl font-bold mt-1">₺{tld.price}</p>
                <p className="text-xs text-muted-foreground">/yıl</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

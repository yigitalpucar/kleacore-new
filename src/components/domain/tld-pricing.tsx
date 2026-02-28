"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TldItem {
  ext: string;
  category: string;
  registerPrice: number;
  renewPrice: number;
  transferPrice: number;
}

interface TldPricingProps {
  tlds: TldItem[];
}

export const TldPricing = ({ tlds }: TldPricingProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tümü");

  const categories = ["Tümü", ...new Set(tlds.map((item) => item.category))];

  const filteredTlds = tlds.filter((tld) => {
    const matchesSearch = tld.ext
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === "Tümü" || tld.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Uzantı ara... (örn: .com)"
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* TLD Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredTlds.map((tld) => (
          <Card
            key={tld.ext}
            className="hover:border-primary/50 transition-colors"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-xl text-primary">{tld.ext}</CardTitle>
              <CardDescription>{tld.category}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Kayıt</span>
                  <span className="font-bold">₺{tld.registerPrice}/yıl</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Yenileme</span>
                  <span className="text-sm">₺{tld.renewPrice}/yıl</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Transfer</span>
                  <span className="text-sm">₺{tld.transferPrice}</span>
                </div>
              </div>
              <Button className="w-full mt-4" variant="outline" size="sm">
                Kaydet
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTlds.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Aramanızla eşleşen uzantı bulunamadı.
        </div>
      )}
    </div>
  );
};

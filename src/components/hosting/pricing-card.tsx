"use client";

import { Check, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { BorderBeam } from "@/components/magicui/border-beam";
import { useRouter } from "next/navigation";

export interface PlanFeature {
  icon: LucideIcon;
  label: string;
  value: string;
  highlight?: boolean;
}

export interface HostingPlan {
  sku: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  yearlyPrice?: number;
  period: string;
  features: string[];
  storage: string;
  bandwidth: string;
  websites: string;
  emails: string;
  popular?: boolean;
  cta?: string;
  badge?: string;
  detailedFeatures?: PlanFeature[];
}

interface PricingCardProps {
  plan: HostingPlan;
  isYearly?: boolean;
  className?: string;
}

export function PricingCard({ plan, isYearly = false, className }: PricingCardProps) {
  const router = useRouter();
  const displayPrice = isYearly && plan.yearlyPrice ? plan.yearlyPrice : plan.price;
  const periodLabel = isYearly ? "ay" : plan.period;

  const handleAddToCart = () => {
    router.push(`/hosting/satin-al/${plan.slug}`);
  };
  return (
    <Card
      className={cn(
        "relative flex flex-col h-full transition-all hover:shadow-lg",
        plan.popular && "border-primary shadow-lg scale-[1.02] z-10",
        className
      )}
    >
      {/* Badge */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
        {plan.popular ? (
          <span className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap">
            POPÜLER
          </span>
        ) : plan.badge ? (
          <span className="bg-muted text-muted-foreground text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap border">
            {plan.badge}
          </span>
        ) : null}
      </div>

      {plan.popular && (
        <BorderBeam
          size={200}
          duration={12}
          colorFrom="#3b82f6"
          colorTo="#8b5cf6"
        />
      )}

      <CardHeader className="text-center pb-2 pt-6">
        <h3 className="text-xl font-bold">{plan.name}</h3>
        <p className="text-xs text-muted-foreground">{plan.description}</p>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="text-center mb-6">
          <span className="text-sm text-muted-foreground">₺</span>
          <span className="text-4xl font-bold">{displayPrice}</span>
          <span className="text-muted-foreground text-sm">/{periodLabel}</span>
          {isYearly && plan.yearlyPrice && (
            <p className="text-xs text-muted-foreground mt-1">
              Yıllık faturalandırma
            </p>
          )}
        </div>

        {/* Detailed Features List */}
        {plan.detailedFeatures ? (
          <div className="space-y-3">
            {plan.detailedFeatures.map((feature, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <feature.icon className="h-4 w-4" />
                  <span>{feature.label}</span>
                </div>
                <span className={cn(
                  "font-medium",
                  feature.highlight && "text-primary"
                )}>
                  {feature.value}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="font-bold">{plan.storage}</p>
                <p className="text-xs text-muted-foreground">SSD Disk</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="font-bold">{plan.bandwidth}</p>
                <p className="text-xs text-muted-foreground">Trafik</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="font-bold">{plan.websites}</p>
                <p className="text-xs text-muted-foreground">Web Sitesi</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="font-bold">{plan.emails}</p>
                <p className="text-xs text-muted-foreground">E-posta</p>
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          variant={plan.popular ? "default" : "outline"}
          size="lg"
          onClick={handleAddToCart}
        >
          {plan.cta || "Hemen Başla"}
        </Button>
      </CardFooter>
    </Card>
  );
}

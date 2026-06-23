import { Shield, Zap, Headphones, Globe } from "lucide-react";

const items = [
  { icon: Shield, label: "%99.9 Uptime", desc: "Yedekli altyapı" },
  { icon: Zap, label: "NVMe SSD", desc: "Yüksek IOPS" },
  { icon: Headphones, label: "7/24 Destek", desc: "Türkçe ekip" },
  { icon: Globe, label: "Global DNS", desc: "Düşük gecikme" },
];

export function TrustStrip() {
  return (
    <section className="border-b bg-muted/30 py-8">
      <div className="container">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-xl border bg-background/60 px-4 py-3"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useTheme } from "next-themes";
import {
  Menu,
  Moon,
  Sun,
  ShoppingCart,
  ChevronDown,
  Globe,
  Server,
  HardDrive,
  Shield,
  Database,
  Cpu,
  Cloud,
  ArrowRight,
  Sparkles,
  Network,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCartStore } from "@/store/cart-store";

const menuItems = [
  {
    title: "Alan Adı",
    description: "Domain kayıt ve yönetim hizmetleri",
    items: [
      {
        title: "Domain Kaydı",
        href: "/domain/kayit",
        description: "500+ uzantı ile yeni domain kaydedin",
        icon: Globe,
        badge: "Popüler",
      },
      {
        title: "Domain Transferi",
        href: "/domain/transfer",
        description: "Mevcut domaininizi bize transfer edin",
        icon: ArrowRight,
      },
      {
        title: "Belgesiz .TR",
        href: "/domain/belgesiz-tr",
        description: "Belge gerektirmeyen .tr uzantıları",
        icon: Sparkles,
        badge: "Yeni",
      },
      {
        title: "Whois Sorgulama",
        href: "/domain/whois",
        description: "Domain sahiplik bilgisi sorgulayın",
        icon: Database,
      },
    ],
    featured: {
      title: ".com Domain",
      description: "En popüler uzantıyı şimdi kaydedin",
      price: "₺149/yıl",
      href: "/domain/kayit",
    },
  },
  {
    title: "Hosting",
    description: "Web barındırma çözümleri",
    items: [
      {
        title: "Linux Hosting",
        href: "/hosting/linux",
        description: "cPanel ile güçlü Linux hosting",
        icon: Server,
        badge: "Popüler",
      },
      {
        title: "WordPress Hosting",
        href: "/hosting/wordpress",
        description: "WordPress için optimize edilmiş",
        icon: Cloud,
      },
      {
        title: "Kurumsal Hosting",
        href: "/hosting/kurumsal",
        description: "Yüksek performanslı kurumsal çözümler",
        icon: Database,
      },
      {
        title: "Reseller Hosting",
        href: "/hosting/reseller",
        description: "Kendi hosting işinizi kurun",
        icon: Network,
      },
    ],
    featured: {
      title: "Profesyonel Paket",
      description: "En çok tercih edilen hosting paketi",
      price: "₺99/ay",
      href: "/hosting/linux",
    },
  },
  {
    title: "Sunucu",
    description: "VDS, VPS ve fiziksel sunucu çözümleri",
    items: [
      {
        title: "VDS Sunucular",
        href: "/sunucu/vds",
        description: "Sanal özel sunucu çözümleri",
        icon: Server,
        badge: "Popüler",
      },
      {
        title: "VPS Sunucu",
        href: "/sunucu/vps",
        description: "Esnek sanal sunucu çözümleri",
        icon: Server,
      },
      {
        title: "Bulut Sunucu",
        href: "/sunucu/bulut",
        description: "Ölçeklenebilir bulut altyapısı",
        icon: Cloud,
        badge: "Yeni",
      },
      {
        title: "Fiziksel Sunucular",
        href: "/sunucu/fiziksel",
        description: "Dedicated sunucu kiralama",
        icon: Cpu,
      },
    ],
    featured: {
      title: "Bulut Sunucu",
      description: "Esnek ve ölçeklenebilir bulut altyapısı",
      price: "₺299/ay",
      href: "/sunucu/bulut",
    },
  },
  {
    title: "Veri Merkezi",
    description: "Colocation, güvenlik ve ağ hizmetleri",
    items: [
      {
        title: "Sunucu Barındırma",
        href: "/veri-merkezi/barindirma",
        description: "Colocation hizmetleri",
        icon: HardDrive,
      },
      {
        title: "IPv4 & ASN",
        href: "/veri-merkezi/ip-asn",
        description: "IP adresi ve ASN kiralama",
        icon: Network,
      },
      {
        title: "CDN Hizmeti",
        href: "/veri-merkezi/cdn",
        description: "Global içerik dağıtım ağı",
        icon: Globe,
        badge: "Yeni",
      },
      {
        title: "DDoS Koruma",
        href: "/veri-merkezi/ddos-koruma",
        description: "Gelişmiş DDoS saldırı koruması",
        icon: Shield,
      },
    ],
    featured: {
      title: "DDoS Koruma",
      description: "Layer 3-7 saldırılara karşı tam koruma",
      price: "₺499/ay",
      href: "/veri-merkezi/ddos-koruma",
    },
  },
  {
    title: "SSL Sertifikası",
    description: "Web sitenizi güvenli hale getirin",
    items: [
      {
        title: "Standart SSL",
        href: "/ssl/standart",
        description: "DV ve OV SSL sertifikaları",
        icon: Shield,
        badge: "Popüler",
      },
      {
        title: "Wildcard SSL",
        href: "/ssl/wildcard",
        description: "Tüm alt domainler için tek sertifika",
        icon: Globe,
      },
      {
        title: "EV SSL",
        href: "/ssl/ev",
        description: "Yeşil adres çubuğu ile maksimum güven",
        icon: Shield,
        badge: "Premium",
      },
      {
        title: "Kurumsal SSL",
        href: "/ssl/kurumsal",
        description: "Toplu SSL ve özel çözümler",
        icon: Database,
      },
    ],
    featured: {
      title: "OV SSL",
      description: "İşletmeler için önerilen SSL sertifikası",
      price: "₺299/yıl",
      href: "/ssl/standart",
    },
  },
];

export function Header() {
  const { setTheme, theme } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const [activeMenu, setActiveMenu] = React.useState<string | null>(null);
  const totalItems = useCartStore((state) => state.getTotalItems());
  const hasHydrated = useCartStore((state) => state.hasHydrated);

  React.useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "bg-background/80 backdrop-blur-lg border-b shadow-sm"
          : "bg-background/50 backdrop-blur-sm"
      )}
      onMouseLeave={() => setActiveMenu(null)}
    >
      <div className="container flex h-20 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center group">
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            <Image
              src="/logo.svg"
              alt="KLEACORE"
              width={140}
              height={30}
              className="hidden dark:block h-8 w-auto"
              priority
            />
            <Image
              src="/logo-light.svg"
              alt="KLEACORE"
              width={140}
              height={30}
              className="dark:hidden h-8 w-auto [filter:brightness(0)_saturate(100%)]"
              priority
            />
          </motion.div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {menuItems.map((menu) => (
            <div
              key={menu.title}
              className="relative"
              onMouseEnter={() => setActiveMenu(menu.title)}
            >
              <button
                className={cn(
                  "flex items-center gap-1.5 px-5 py-2.5 text-base font-medium rounded-lg transition-colors",
                  activeMenu === menu.title
                    ? "text-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                {menu.title}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    activeMenu === menu.title && "rotate-180"
                  )}
                />
              </button>
            </div>
          ))}

        </nav>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="relative"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          <Button variant="ghost" size="icon" className="hidden sm:flex relative" asChild>
            <Link href="/sepet" aria-label="Sepet">
              <ShoppingCart className="h-5 w-5" />
              {hasHydrated && totalItems > 0 ? (
                <span className="absolute -top-1 -right-1 h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold px-1 flex items-center justify-center">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              ) : null}
            </Link>
          </Button>

          {/* Mobile Menu */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-left">
                  <Image
                    src="/logo.svg"
                    alt="KLEACORE"
                    width={120}
                    height={26}
                    className="hidden dark:block h-6 w-auto"
                  />
                  <Image
                    src="/logo-light.svg"
                    alt="KLEACORE"
                    width={120}
                    height={26}
                    className="dark:hidden h-6 w-auto [filter:brightness(0)_saturate(100%)]"
                  />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-8">
                {menuItems.map((menu) => (
                  <MobileNavSection
                    key={menu.title}
                    title={menu.title}
                    items={menu.items}
                    onClose={() => setIsOpen(false)}
                  />
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Mega Menu Dropdown */}
      {activeMenu && (
        <div
          className="absolute left-0 right-0 top-full border-b bg-background/95 backdrop-blur-lg shadow-lg"
          onMouseEnter={() => setActiveMenu(activeMenu)}
          onMouseLeave={() => setActiveMenu(null)}
        >
            <div className="container py-6">
              {menuItems
                .filter((m) => m.title === activeMenu)
                .map((menu) => (
                  <div key={menu.title} className="grid grid-cols-12 gap-8">
                    {/* Menu Items */}
                    <div className="col-span-8">
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold">{menu.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {menu.description}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {menu.items.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="group flex items-start gap-4 p-4 rounded-xl hover:bg-accent transition-colors"
                            onClick={() => setActiveMenu(null)}
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                              <item.icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium group-hover:text-primary transition-colors">
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {item.description}
                              </p>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                          </Link>
                        ))}
                      </div>
                    </div>

                    {/* Featured Card */}
                    <div className="col-span-4">
                      <div className="h-full rounded-2xl bg-gradient-to-br from-muted via-muted/50 to-muted p-6 border border-border">
                        <div className="flex flex-col h-full">
                          <span className="text-xs font-medium text-primary uppercase tracking-wider">
                            Öne Çıkan
                          </span>
                          <h4 className="text-xl font-bold mt-2">
                            {menu.featured.title}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1 flex-1">
                            {menu.featured.description}
                          </p>
                          <div className="mt-4">
                            <div className="text-2xl font-bold text-primary mb-3">
                              {menu.featured.price}
                            </div>
                            <Button
                              className="w-full bg-foreground text-background hover:bg-foreground/90"
                              asChild
                            >
                              <Link
                                href={menu.featured.href}
                                onClick={() => setActiveMenu(null)}
                              >
                                Hemen Başla
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
    </header>
  );
}

function MobileNavSection({
  title,
  items,
  onClose,
}: {
  title: string;
  items: {
    title: string;
    href: string;
    description: string;
    icon: React.ElementType;
    badge?: string;
  }[];
  onClose: () => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-2 py-1 text-sm font-medium hover:text-primary transition-colors"
      >
        {title}
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 flex flex-col gap-1 overflow-hidden"
          >
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                onClick={onClose}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
                {item.badge && (
                  <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

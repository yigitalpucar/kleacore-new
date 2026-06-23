"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import {
  ArrowRight,
  Server,
  Globe,
  Shield,
  Cloud,
  Zap,
  HardDrive,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

const slides = [
  {
    id: 1,
    badge: "YÜKSEK PERFORMANS",
    title: ["Yüksek Performanslı", "Web Hosting"],
    description:
      "NVMe SSD diskler, LiteSpeed web sunucusu ve ücretsiz SSL sertifikası ile web sitenizi hızlandırın.",
    cta: { text: "Detayları Gör", href: "/hosting/linux" },
    image:
      "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1200&auto=format&fit=crop",
    gradient: "from-emerald-400/80 to-teal-200/80",
    accentColor: "bg-emerald-400",
    accentText: "text-emerald-950",
    glow: "bg-emerald-500/30",
    features: [
      { icon: Zap, title: "Yüksek Performans", desc: "LiteSpeed ile 10x hızlı" },
      { icon: HardDrive, title: "NVMe SSD", desc: "Ultra hızlı disk performansı" },
    ],
  },
  {
    id: 2,
    badge: "TAM KONTROL",
    title: ["Güçlü ve Esnek", "VPS Sunucular"],
    description:
      "Tam root erişimi, özel kaynaklar ve anlık ölçeklendirme ile projelerinizi özgürce yönetin.",
    cta: { text: "Detayları Gör", href: "/sunucu/vps" },
    image:
      "https://images.unsplash.com/photo-1639322537228-f710d846310a?q=80&w=1200&auto=format&fit=crop",
    gradient: "from-sky-400/80 to-cyan-200/80",
    accentColor: "bg-sky-400",
    accentText: "text-sky-950",
    glow: "bg-sky-500/30",
    features: [
      { icon: Server, title: "Root Erişimi", desc: "Tam sunucu kontrolü" },
      { icon: Cloud, title: "Anlık Ölçeklendirme", desc: "İhtiyaca göre kaynak artırma" },
    ],
  },
  {
    id: 3,
    badge: "GÜVENLİ BAĞLANTI",
    title: ["Güvenli Bağlantı", "SSL Sertifikaları"],
    description:
      "256-bit şifreleme ile müşterilerinizin verilerini koruyun. Tüm tarayıcılarda güvenilir.",
    cta: { text: "Detayları Gör", href: "/ssl/standart" },
    image:
      "https://images.unsplash.com/photo-1563013544-824ae1b704d3?q=80&w=1200&auto=format&fit=crop",
    gradient: "from-amber-400/80 to-yellow-200/80",
    accentColor: "bg-amber-400",
    accentText: "text-amber-950",
    glow: "bg-amber-500/30",
    features: [
      { icon: Shield, title: "256-bit Şifreleme", desc: "Bankacılık seviyesi güvenlik" },
      { icon: Globe, title: "Tüm Tarayıcılar", desc: "Evrensel uyumluluk" },
    ],
  },
  {
    id: 4,
    badge: "GÜÇLÜ ALTYAPI",
    title: ["Fiziksel", "Sunucular"],
    description:
      "Kendi özel sunucularınızı, çeşitli işlemci türleri ve yüksek performanslı dedicated sunucular ile kiralayın.",
    cta: { text: "Detayları Gör", href: "/sunucu/fiziksel" },
    image:
      "https://images.unsplash.com/photo-1597852074816-d933c7d2b988?q=80&w=1200&auto=format&fit=crop",
    gradient: "from-violet-400/80 to-purple-200/80",
    accentColor: "bg-violet-400",
    accentText: "text-violet-950",
    glow: "bg-violet-500/30",
    features: [
      { icon: Server, title: "Yüksek Performans", desc: "Yeni nesil işlemciler" },
      { icon: HardDrive, title: "Güçlü Altyapı", desc: "Yedekli veri merkezi" },
    ],
  },
];

export function HeroSlider() {
  const reducedMotion = useReducedMotion();
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, duration: reducedMotion ? 0 : 25 },
    reducedMotion ? [] : [Autoplay({ delay: 6000, stopOnInteraction: false })]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollTo = useCallback(
    (index: number) => {
      if (emblaApi) emblaApi.scrollTo(index);
    },
    [emblaApi]
  );

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const activeSlide = slides[selectedIndex] ?? slides[0];

  return (
    <section className="relative overflow-hidden bg-zinc-950">
      <div
        className="h-[min(88vh,640px)] overflow-hidden md:h-[min(82vh,600px)]"
        ref={emblaRef}
      >
        <div className="flex h-full">
          {slides.map((slide, index) => (
            <div key={slide.id} className="relative h-full min-w-0 flex-[0_0_100%]">
              <div className="absolute inset-0">
                <Image
                  src={slide.image}
                  alt={slide.title.join(" ")}
                  fill
                  sizes="100vw"
                  className={cn(
                    "object-cover opacity-25",
                    !reducedMotion && selectedIndex === index && "animate-hero-ken-burns"
                  )}
                  priority={index === 0}
                  loading={index === 0 ? "eager" : "lazy"}
                />
                <div className="absolute inset-0 bg-zinc-950/65" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-zinc-950/70" />
                <div
                  className={cn(
                    "absolute -right-20 top-1/4 h-64 w-64 rounded-full blur-3xl",
                    slide.glow
                  )}
                />
              </div>

              <div className="container relative flex h-full items-center justify-center">
                <div className="w-full max-w-3xl py-12 text-center lg:py-0">
                  {selectedIndex === index ? (
                    reducedMotion ? (
                      <div className="space-y-6">
                        <HeroSlideContent slide={slide} />
                      </div>
                    ) : (
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={slide.id}
                          initial={{ opacity: 0, y: 24 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -16 }}
                          transition={{ duration: 0.45, ease: "easeOut" }}
                          className="space-y-6"
                        >
                          <HeroSlideContent slide={slide} />
                        </motion.div>
                      </AnimatePresence>
                    )
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={scrollPrev}
        className="absolute left-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/50 md:flex"
        aria-label="Önceki slayt"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={scrollNext}
        className="absolute right-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white backdrop-blur-sm transition hover:bg-black/50 md:flex"
        aria-label="Sonraki slayt"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 gap-2">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => scrollTo(index)}
            className={cn(
              "h-2.5 rounded-full transition-all duration-300",
              selectedIndex === index
                ? cn("w-8", slide.accentColor)
                : "w-2.5 bg-white/30 hover:bg-white/50"
            )}
            aria-label={`Slayt ${index + 1}: ${slide.title.join(" ")}`}
            aria-current={selectedIndex === index}
          />
        ))}
      </div>

      {!reducedMotion ? (
        <div className="absolute bottom-0 left-0 right-0 z-20 h-1 bg-white/10">
          <motion.div
            key={selectedIndex}
            className={cn("h-full", activeSlide.accentColor)}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 6, ease: "linear" }}
          />
        </div>
      ) : null}
    </section>
  );
}

function HeroSlideContent({
  slide,
}: {
  slide: (typeof slides)[number];
}) {
  return (
    <>
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wider text-white/85 backdrop-blur-sm">
          {slide.badge}
        </div>
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
        <span className="block text-white">{slide.title[0]}</span>
        <span
          className={cn(
            "block bg-gradient-to-r bg-clip-text text-transparent",
            slide.gradient
          )}
        >
          {slide.title[1]}
        </span>
      </h1>

      <p className="mx-auto max-w-2xl text-base leading-relaxed text-zinc-400 md:text-lg">
        {slide.description}
      </p>

      <div className="flex flex-wrap justify-center gap-4 pt-1 md:gap-6">
        {slide.features.map((feature) => (
          <div key={feature.title} className="flex items-center gap-3 text-left">
            <div className={cn("rounded-xl p-2.5", slide.accentColor)}>
              <feature.icon className={cn("h-5 w-5", slide.accentText)} />
            </div>
            <div>
              <p className="font-semibold text-white">{feature.title}</p>
              <p className="text-sm text-zinc-500">{feature.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-4 pt-2">
        <Button
          size="lg"
          className={cn(
            "group h-12 gap-2 px-8 text-base",
            slide.accentColor,
            slide.accentText,
            "hover:brightness-110"
          )}
          asChild
        >
          <Link href={slide.cta.href}>
            {slide.cta.text}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-12 border-white/20 bg-white/5 px-8 text-base text-white hover:bg-white/10 hover:text-white"
          asChild
        >
          <Link href="/domain/kayit">Domain Sorgula</Link>
        </Button>
      </div>
    </>
  );
}
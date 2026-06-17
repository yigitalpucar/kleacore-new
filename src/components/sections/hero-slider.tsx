"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ArrowRight, Server, Globe, Shield, Cloud, Zap, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

const slides = [
  {
    id: 1,
    badge: "YÜKSEK PERFORMANS",
    title: ["Yüksek Performanslı", "Web Hosting"],
    description: "NVMe SSD diskler, LiteSpeed web sunucusu ve ücretsiz SSL sertifikası ile web sitenizi hızlandırın.",
    cta: { text: "Detayları Gör", href: "/hosting/linux" },
    image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=2034&auto=format&fit=crop",
    color: "from-zinc-400 to-zinc-200",
    accentColor: "bg-zinc-200",
    features: [
      { icon: Zap, title: "Yüksek Performans", desc: "LiteSpeed ile 10x hızlı" },
      { icon: HardDrive, title: "NVMe SSD", desc: "Ultra hızlı disk performansı" },
    ],
  },
  {
    id: 2,
    badge: "TAM KONTROL",
    title: ["Güçlü ve Esnek", "VPS Sunucular"],
    description: "Tam root erişimi, özel kaynaklar ve anlık ölçeklendirme ile projelerinizi özgürce yönetin.",
    cta: { text: "Detayları Gör", href: "/sunucu/vps" },
    image: "https://images.unsplash.com/photo-1639322537228-f710d846310a?q=80&w=2832&auto=format&fit=crop",
    color: "from-zinc-400 to-zinc-200",
    accentColor: "bg-zinc-200",
    features: [
      { icon: Server, title: "Root Erişimi", desc: "Tam sunucu kontrolü" },
      { icon: Cloud, title: "Anlık Ölçeklendirme", desc: "İhtiyaca göre kaynak artırma" },
    ],
  },
  {
    id: 3,
    badge: "GÜVENLİ BAĞLANTI",
    title: ["Güvenli Bağlantı", "SSL Sertifikaları"],
    description: "256-bit şifreleme ile müşterilerinizin verilerini koruyun. Tüm tarayıcılarda güvenilir.",
    cta: { text: "Detayları Gör", href: "/ssl/standart" },
    image: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?q=80&w=2070&auto=format&fit=crop",
    color: "from-zinc-400 to-zinc-200",
    accentColor: "bg-zinc-200",
    features: [
      { icon: Shield, title: "256-bit Şifreleme", desc: "Bankacılık seviyesi güvenlik" },
      { icon: Globe, title: "Tüm Tarayıcılar", desc: "Evrensel uyumluluk" },
    ],
  },
  {
    id: 4,
    badge: "GÜÇLÜ ALTYAPI",
    title: ["Fiziksel", "Sunucular"],
    description: "Kendi özel sunucularınızı, çeşitli işlemci türleri ve yüksek performanslı dedicated sunucular ile kiralayın.",
    cta: { text: "Detayları Gör", href: "/sunucu/fiziksel" },
    image: "https://images.unsplash.com/photo-1597852074816-d933c7d2b988?q=80&w=2070&auto=format&fit=crop",
    color: "from-zinc-400 to-zinc-200",
    accentColor: "bg-zinc-200",
    features: [
      { icon: Server, title: "Yüksek Performans", desc: "Yeni nesil işlemciler" },
      { icon: HardDrive, title: "Güçlü Altyapı", desc: "Yedekli veri merkezi" },
    ],
  },
];

export function HeroSlider() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 6000, stopOnInteraction: false }),
  ]);
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

  return (
    <section className="relative overflow-hidden bg-zinc-950">
      {/* Slider */}
      <div className="overflow-hidden h-[500px] md:h-[550px] lg:h-[600px]" ref={emblaRef}>
        <div className="flex h-full">
          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className="flex-[0_0_100%] min-w-0 relative h-full"
            >
              {/* Background Image - Tam arka plan */}
              <div className="absolute inset-0">
                <Image
                  src={slide.image}
                  alt={slide.title[1]}
                  fill
                  className="object-cover opacity-20"
                  priority={index === 0}
                />
                {/* Overlay - Koyu gradient */}
                <div className="absolute inset-0 bg-zinc-950/60" />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/80" />
              </div>

              {/* Content */}
              <div className="relative h-full container flex items-center justify-center">
                <div className="w-full max-w-3xl py-12 lg:py-0 text-center">
                  {/* Center - Text Content */}
                  <AnimatePresence mode="wait">
                    {selectedIndex === index && (
                      <motion.div
                        key={slide.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -30 }}
                        transition={{ duration: 0.5 }}
                        className="space-y-6"
                      >
                        {/* Badge */}
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                        >
                          <div className={cn("inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wider backdrop-blur-sm text-white/80")}>
                            <span>{slide.badge}</span>
                          </div>
                        </motion.div>

                        {/* Title */}
                        <motion.h1
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                          className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl"
                        >
                          <span className="text-white block">
                            {slide.title[0]}
                          </span>
                          <span className={cn("bg-clip-text text-transparent bg-gradient-to-r block", slide.color)}>
                            {slide.title[1]}
                          </span>
                        </motion.h1>

                        {/* Description */}
                        <motion.p
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.3 }}
                          className="max-w-2xl mx-auto text-base text-zinc-400 leading-relaxed"
                        >
                          {slide.description}
                        </motion.p>

                        {/* Features */}
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.4 }}
                          className="flex flex-wrap justify-center gap-6 pt-2"
                        >
                          {slide.features.map((feature) => (
                            <div key={feature.title} className="flex items-center gap-3">
                              <div className={cn("p-2.5 rounded-xl", slide.accentColor)}>
                                <feature.icon className="h-5 w-5 text-zinc-900" />
                              </div>
                              <div className="text-left">
                                <p className="font-semibold text-white">{feature.title}</p>
                                <p className="text-sm text-zinc-500">{feature.desc}</p>
                              </div>
                            </div>
                          ))}
                        </motion.div>

                        {/* CTA */}
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.5 }}
                          className="flex flex-wrap justify-center gap-4 pt-4"
                        >
                          <Button size="lg" className={cn("h-12 px-8 text-base gap-2 group text-zinc-900", slide.accentColor, "hover:bg-zinc-300")} asChild>
                            <Link href={slide.cta.href}>
                              {slide.cta.text}
                              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                            </Link>
                          </Button>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dots Navigation - Orta alt */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => scrollTo(index)}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              selectedIndex === index
                ? "w-8 bg-white"
                : "w-2 bg-white/30 hover:bg-white/50"
            )}
            aria-label={`Slide ${index + 1}`}
          />
        ))}
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-20">
        <motion.div
          key={selectedIndex}
          className={cn("h-full", slides[selectedIndex]?.accentColor || "bg-zinc-200")}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 6, ease: "linear" }}
        />
      </div>
    </section>
  );
}

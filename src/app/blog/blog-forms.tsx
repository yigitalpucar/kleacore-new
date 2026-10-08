"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { buttonClasses } from "@/components/site/button-classes";
import { subscribeNewsletter } from "@/lib/actions/contact";
import { toast } from "@/lib/toast";

/** Search box in the blog header (navigates to /blog?search=…). */
export function BlogSearch({ initial, kategori }: { initial: string; kategori: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (kategori) params.set("kategori", kategori);
    if (value.trim()) params.set("search", value.trim());
    const qs = params.toString();
    router.push(qs ? `/blog?${qs}` : "/blog");
  };

  return (
    <form role="search" onSubmit={onSubmit} className="mx-auto flex w-full max-w-xl gap-2">
      <label htmlFor="blog-search" className="sr-only">
        Blog yazılarında ara
      </label>
      <div className="relative flex-1">
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="blog-search"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Blog yazılarında ara..."
          className="h-12 w-full rounded-md border bg-background pl-10 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <button type="submit" className={buttonClasses({ size: "lg", className: "px-5" })}>
        Ara
      </button>
    </form>
  );
}

/** Newsletter sign-up (uses the existing `subscribeNewsletter` action). */
export function BlogNewsletter() {
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Lütfen e-posta adresinizi girin.");
      return;
    }
    setIsSubscribing(true);
    try {
      const result = await subscribeNewsletter(email, "blog");
      if (!result.success) {
        toast.error(result.error ?? "Abonelik tamamlanamadı.");
        return;
      }
      toast.success(result.message ?? "Abonelik başarıyla tamamlandı.");
      setEmail("");
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3 sm:flex-row lg:justify-end">
      <label htmlFor="newsletter-email" className="sr-only">
        E-posta adresiniz
      </label>
      <input
        id="newsletter-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="E-posta adresiniz"
        className="h-11 w-full rounded-md border bg-background px-3.5 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-sm"
      />
      <button type="submit" disabled={isSubscribing} className={buttonClasses()}>
        {isSubscribing ? "Kaydediliyor..." : "Abone ol"}
      </button>
    </form>
  );
}

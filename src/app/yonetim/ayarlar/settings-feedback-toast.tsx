"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";

interface SettingsFeedbackToastProps {
  status?: string;
  message?: string;
  activeTab: string;
}

export function SettingsFeedbackToast({
  status,
  message,
  activeTab,
}: SettingsFeedbackToastProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const shownRef = useRef(false);

  useEffect(() => {
    if (shownRef.current || !status) return;

    shownRef.current = true;

    const feedbackMessage =
      message ??
      (status === "success"
        ? "Ayarlar kaydedildi."
        : "Ayarlar kaydedilemedi.");

    if (status === "success") {
      toast.success(feedbackMessage);
    } else {
      toast.error(feedbackMessage);
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    params.delete("message");
    if (!params.has("tab")) {
      params.set("tab", activeTab);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [activeTab, message, pathname, router, searchParams, status]);

  return null;
}

"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { toast } from "@/lib/toast";

export function LogoutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;

    setLoading(true);
    const result = await logoutAction();
    if (!result.success) {
      toast.error(result.error ?? "Çıkış yapılamadı");
      setLoading(false);
      return;
    }

    toast.success("Çıkış yapıldı");
    window.location.href = "/";
  };

  return (
    <button
      onClick={() => {
        void handleLogout();
      }}
      disabled={loading}
      className={className}
    >
      <LogOut className="h-4 w-4" />
      <span>Çıkış Yap</span>
    </button>
  );
}

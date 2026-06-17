import Link from "next/link";
import Image from "next/image";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminNav } from "@/components/admin/admin-nav";
import { AdminFooter } from "@/components/admin/admin-footer";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();
  const user = session.user;

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 flex flex-col">
      {/* Top Bar with Logo */}
      <div className="sticky top-0 z-40 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
        <div className="relative flex items-center justify-end h-16 px-6">
          {/* Logo - Absolutely Centered */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Link href="/yonetim" className="flex items-center gap-3">
              <Image
                src="/logo.svg"
                alt="KLEACORE"
                width={160}
                height={36}
                className="h-8 w-auto invert dark:invert-0"
                priority
              />
              <span className="text-[10px] font-bold tracking-wide text-zinc-900 dark:text-white bg-zinc-200 dark:bg-zinc-800 px-2.5 py-1 rounded-md">
                ADMIN
              </span>
            </Link>
          </div>

          {/* Header Actions */}
          <AdminHeader userName={user?.name || "Admin"} />
        </div>

        {/* Horizontal Navigation */}
        <AdminNav />
      </div>

      {/* Main Content */}
      <main className="p-6 max-w-[1600px] mx-auto flex-1 w-full">{children}</main>

      {/* Footer */}
      <AdminFooter />
    </div>
  );
}

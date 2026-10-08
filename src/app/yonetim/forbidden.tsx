import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { EmptyState, PageHeader, appButton } from "@/components/app";

/**
 * 403 inside the admin shell: rendered (with status 403) when a staff member
 * opens a page or runs an action their role has no permission for.
 */
export default function AdminForbidden() {
  return (
    <>
      <PageHeader title="Erişim yetkiniz yok" />
      <EmptyState
        icon={ShieldAlert}
        title="Bu sayfa rolünüze kapalı"
        description="Bu işlem için gereken yetki hesabınızda tanımlı değil. Erişime ihtiyacınız varsa bir yöneticiyle görüşün."
        action={
          <Link href="/yonetim" className={appButton({ variant: "outline" })}>
            Genel bakışa dön
          </Link>
        }
      />
    </>
  );
}

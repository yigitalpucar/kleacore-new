import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PanelProfileHeader } from "@/components/panel/panel-profile-header";
import { PanelTabs } from "@/components/panel/panel-tabs";
import { auth } from "@/lib/auth";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />

      {/* Profile Header */}
      <PanelProfileHeader
        userName={user?.name || "Kullanıcı"}
        userEmail={user?.email || ""}
      />

      {/* Tab Navigation */}
      <PanelTabs />

      {/* Panel Content Area */}
      <div className="flex-1 bg-muted/30">
        <div className="container py-6">
          <div className="space-y-6">
            {children}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

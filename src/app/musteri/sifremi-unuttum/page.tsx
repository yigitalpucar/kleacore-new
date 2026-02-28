import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { SifremiUnuttumContent } from "./content";

export default function SifremiUnuttumPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1">
        <SifremiUnuttumContent />
      </main>
      <Footer />
    </div>
  );
}

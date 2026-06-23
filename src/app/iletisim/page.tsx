import { Suspense } from "react";
import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { IletisimContent } from "./content";

export default function IletisimPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1">
        <Suspense>
          <IletisimContent />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

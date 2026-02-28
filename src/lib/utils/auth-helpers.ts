import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function getSession() {
  return await auth();
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/musteri/giris");
  }
  return session;
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/musteri/giris");
  }
  return session;
}

export async function requireCustomer() {
  const session = await auth();
  if (!session?.user) {
    redirect("/musteri/giris");
  }
  return session;
}

export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

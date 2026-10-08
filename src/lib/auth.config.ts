import type { NextAuthConfig } from "next-auth";
import { refreshSessionToken } from "@/lib/auth/session-refresh";

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/musteri/giris",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      return refreshSessionToken(
        token,
        user as { id?: string; role?: string; sessionVersion?: number } | undefined
      );
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const role = (auth?.user as { role?: string })?.role;
      const { pathname } = nextUrl;

      if (pathname.startsWith("/yonetim")) {
        if (!isLoggedIn || role !== "ADMIN") {
          return false;
        }
      }

      if (pathname.startsWith("/musteri/panel")) {
        if (!isLoggedIn) {
          return false;
        }
      }

      return true;
    },
  },
} satisfies NextAuthConfig;

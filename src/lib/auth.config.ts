import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";
import { canAccessRoute, isStaffRole } from "@/lib/auth/permissions";
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
        // Any staff role; per-page permissions are checked server-side.
        if (!isLoggedIn || !isStaffRole(role)) {
          return false;
        }
        // Real 403 status for routes the role cannot open (the page itself
        // also calls requirePermission; streaming would otherwise send 200).
        if (!canAccessRoute(role, pathname)) {
          return NextResponse.rewrite(new URL("/yonetim/yetkisiz", nextUrl), { status: 403 });
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

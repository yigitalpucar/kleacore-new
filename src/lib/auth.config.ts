import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/musteri/giris",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
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

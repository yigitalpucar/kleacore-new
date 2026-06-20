import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { verifyTwoFactorChallengeToken } from "@/lib/auth/two-factor";
import { db } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";

async function completeLogin(user: {
  id: string;
  email: string;
  name: string;
  surname: string;
  role: "ADMIN" | "CUSTOMER";
}) {
  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    id: user.id,
    email: user.email,
    name: `${user.name} ${user.surname}`.trim(),
    role: user.role,
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        twoFactorToken: { label: "Two Factor Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;
        if (user.status !== "ACTIVE") return null;

        const twoFactorToken = credentials.twoFactorToken as string | undefined;
        if (twoFactorToken) {
          const challenge = verifyTwoFactorChallengeToken(twoFactorToken);
          if (!challenge || challenge.userId !== user.id || challenge.email !== user.email) {
            return null;
          }

          return completeLogin(user);
        }

        if (!credentials.password) return null;

        const isValid = await compare(
          credentials.password as string,
          user.password
        );
        if (!isValid) return null;

        return completeLogin(user);
      },
    }),
  ],
});

import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getGoogleClientId, getGoogleClientSecret } from "@/lib/oauth-config";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Google({
      clientId: getGoogleClientId() ?? "",
      clientSecret: getGoogleClientSecret() ?? "",
    }),
  ],
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) {
        return false;
      }
      const existing = await prisma.user.findUnique({
        where: { email: user.email },
      });
      return !!existing;
    },
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
        session.user.role = token.role as "ADMIN" | "USER";
      }
      return session;
    },
  },
});

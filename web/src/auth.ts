import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { normalizeEmail } from "@/lib/email";
import { getGoogleClientId, getGoogleClientSecret } from "@/lib/oauth-config";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Google({
      clientId: getGoogleClientId() ?? "",
      clientSecret: getGoogleClientSecret() ?? "",
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email ? normalizeEmail(profile.email) : null,
          image: profile.picture,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    /** Show auth errors (e.g. invite-only rejection) on our login page with ?error= */
    error: "/login",
  },
  trustHost: true,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) {
        return "/login?error=OAuthSignin";
      }
      const email = normalizeEmail(user.email);
      const existing = await prisma.user.findUnique({
        where: { email },
      });
      if (!existing) {
        return "/login?error=no-invite";
      }
      return true;
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

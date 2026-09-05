import { PrismaAdapter } from "@auth/prisma-adapter";
import type { PrismaClient } from "@prisma/client";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { normalizeEmail } from "@/lib/email";
import {
  getGoogleClientId,
  getGoogleClientSecret,
  isLocalDevAuthEnabled,
} from "@/lib/oauth-config";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

function bootstrapAdminEmail(): string {
  return normalizeEmail(process.env.ADMIN_EMAIL ?? "tinel.c@gmail.com");
}

function localDevEmail(): string {
  return normalizeEmail(
    process.env.LOCAL_DEV_LOGIN_EMAIL ?? process.env.ADMIN_EMAIL ?? "tinel.c@gmail.com",
  );
}

const localDevAuthEnabled = isLocalDevAuthEnabled();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma as PrismaClient),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Google({
      clientId: getGoogleClientId() ?? "",
      clientSecret: getGoogleClientSecret() ?? "",
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email ? normalizeEmail(profile.email) : null,
          image: profile.picture,
        };
      },
    }),
    ...(localDevAuthEnabled
      ? [
          Credentials({
            id: "local-dev",
            name: "Local dev login",
            credentials: {
              email: { label: "Email", type: "text" },
            },
            async authorize(credentials) {
              const email = normalizeEmail(
                String(credentials?.email ?? localDevEmail()),
              );
              if (!email) return null;
              const user = await prisma.user.upsert({
                where: { email },
                create: {
                  email,
                  name: "Local Dev Admin",
                  role: Role.ADMIN,
                },
                update: { role: Role.ADMIN },
              });
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
              };
            },
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  trustHost: true,
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "local-dev") {
        return localDevAuthEnabled ? true : "/login?error=AccessDenied";
      }
      if (account?.provider !== "google" || !user.email) {
        return "/login?error=OAuthSignin";
      }
      const email = normalizeEmail(user.email);
      const existing = await prisma.user.findUnique({ where: { email } });
      if (!existing) {
        if (email === bootstrapAdminEmail()) {
          await prisma.user.upsert({
            where: { email },
            create: {
              email,
              name: user.name ?? null,
              role: Role.ADMIN,
            },
            update: {
              name: user.name ?? null,
              role: Role.ADMIN,
            },
          });
        } else {
          return "/login?error=no-invite";
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true },
        });
        if (dbUser) token.role = dbUser.role;
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

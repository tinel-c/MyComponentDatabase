"use server";

import { signIn } from "@/auth";
import { isGoogleOAuthConfigured, isLocalDevAuthEnabled } from "@/lib/oauth-config";
import { redirect } from "next/navigation";
import { normalizeEmail } from "@/lib/email";

export async function loginWithGoogle() {
  if (!isGoogleOAuthConfigured()) {
    redirect("/login?error=missing-oauth");
  }
  await signIn("google", { redirectTo: "/parts" });
}

export async function loginLocalDev() {
  if (!isLocalDevAuthEnabled()) {
    redirect("/login?error=AccessDenied");
  }
  const email = normalizeEmail(process.env.LOCAL_DEV_LOGIN_EMAIL ?? process.env.ADMIN_EMAIL ?? "tinel.c@gmail.com");
  await signIn("local-dev", { email, redirectTo: "/parts" });
}

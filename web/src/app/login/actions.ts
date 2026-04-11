"use server";

import { signIn } from "@/auth";
import { isGoogleOAuthConfigured } from "@/lib/oauth-config";
import { redirect } from "next/navigation";

export async function loginWithGoogle() {
  if (!isGoogleOAuthConfigured()) {
    redirect("/login?error=missing-oauth");
  }
  await signIn("google", { redirectTo: "/parts" });
}

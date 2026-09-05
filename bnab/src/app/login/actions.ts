"use server";

import { signIn } from "@/auth";
import { isLocalDevAuthEnabled } from "@/lib/oauth-config";

export async function loginWithGoogle() {
  await signIn("google", { redirectTo: "/plan" });
}

export async function loginLocalDev(formData: FormData) {
  if (!isLocalDevAuthEnabled()) {
    throw new Error("Local dev login disabled");
  }
  const email = String(formData.get("email") ?? "");
  await signIn("local-dev", { email, redirectTo: "/plan" });
}

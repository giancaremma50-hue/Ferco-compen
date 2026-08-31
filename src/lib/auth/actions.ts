"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";
import { getSiteUrl } from "@/lib/site-url";

export async function signInWithGoogle(proximo?: string | string[]) {
  const supabase = await createClient();
  const siteUrl = await getSiteUrl();
  const callbackUrl = new URL("/auth/callback", siteUrl);
  callbackUrl.searchParams.set("proximo", sanitizeRedirectPath(proximo));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl.toString() },
  });

  if (error || !data.url) {
    redirect("/auth/auth-error?motivo=fallo_inicio");
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

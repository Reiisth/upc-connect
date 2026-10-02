import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

function getSafeNext(next: string | null) {
  if (!next) return "/";

  if (!next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = getSafeNext(searchParams.get("next"));

  if (!tokenHash || !type) {
    redirect("/auth/error?error=No token hash or type");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  if (type === "invite") {
    redirect("/set-password");
  }

  redirect(next);
}
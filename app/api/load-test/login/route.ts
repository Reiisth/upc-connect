import { timingSafeEqual, createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

const headers = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const secret = process.env.LOAD_TEST_SECRET;
  const email = process.env.LOAD_TEST_EMAIL;
  const suppliedSecret = request.headers.get("x-load-test-secret");
  if (
    process.env.ENABLE_LOAD_TEST_AUTH !== "true" ||
    !secret || !email || !suppliedSecret ||
    !timingSafeEqual(
      createHash("sha256").update(secret).digest(),
      createHash("sha256").update(suppliedSecret).digest(),
    )
  ) {
    return new Response("Not Found", { status: 404, headers });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400, headers });
  }
  if (
    !body || typeof body !== "object" ||
    !("email" in body) || body.email !== email ||
    !("password" in body) || typeof body.password !== "string" || !body.password
  ) {
    return new Response("Unauthorized", { status: 401, headers });
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: body.password });
    if (error) return new Response("Unauthorized", { status: 401, headers });
    // The shared SSR client's cookie adapter writes through next/headers.
    return Response.json({ success: true }, { headers });
  } catch {
    return new Response("Authentication unavailable", { status: 503, headers });
  }
}

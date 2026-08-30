import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function StaffPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/staff/login");
  }

  return (
    <main>
      <h1>Staff Portal</h1>
      <p>Welcome! You are logged in.</p>
    </main>
  );
}
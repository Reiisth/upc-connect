import { cacheLife } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getBranches() {
  "use cache";

  cacheLife("hours");

  const { data, error } = await createAdminClient()
    .from("church_branches")
    .select("id, name")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getDepartments() {
  "use cache";

  cacheLife("hours");

  const { data, error } = await createAdminClient()
    .from("departments")
    .select("id, name")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
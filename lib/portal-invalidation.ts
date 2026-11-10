import "server-only";
import { revalidatePath, updateTag } from "next/cache";
const dependencies: Record<string, string[]> = {
  members: ["members","profile","attendance","inactivity","reports","follow-ups","contributions","baptisms"],
  profile: ["profile","members","attendance","inactivity","reports","follow-ups","contributions","baptisms"],
  attendance: ["attendance","services","inactivity","reports"],
  services: ["services","attendance","inactivity","reports"],
  contributions: ["contributions","reports"], baptisms: ["baptisms","reports"],
  "follow-ups": ["follow-ups","inactivity","reports"], inactivity: ["inactivity","reports"],
  accounts: ["account","profile","members"], account: ["account"], reports: ["reports"],
};
export function portalInvalidationTags(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] !== "portal") return [];
  if (parts[1] === "administration") {
    const reference = parts[2];
    const affected = reference === "profile-fields" ? ["administration/profile-fields","profile"]
      : reference === "departments" ? ["administration/departments","members","profile"]
      : reference === "service-types" ? ["administration/service-types","services","attendance","reports"]
      : ["administration/branches","members","profile","services","attendance","contributions","baptisms","inactivity","follow-ups","reports"];
    return affected.map(domain => "portal:"+domain.replaceAll("/","-"));
  }
  return (dependencies[parts[1]] ?? []).map(domain => "portal:"+domain);
}
/** Called only after a successful Server Action write; keeps existing path semantics. */
export function revalidatePortalPath(path: string, type?: "page" | "layout") {
  revalidatePath(path, type);
  for (const tag of portalInvalidationTags(path)) updateTag(tag);
}

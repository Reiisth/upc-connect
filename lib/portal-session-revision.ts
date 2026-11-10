import "server-only";
import { createHash } from "node:crypto";
export function portalSessionRevision(userId: string, permissions: readonly string[], branchIds: readonly string[], isSystemAdmin: boolean) {
  return createHash("sha256").update(JSON.stringify([userId, [...permissions].sort(), [...branchIds].sort(), isSystemAdmin])).digest("hex");
}

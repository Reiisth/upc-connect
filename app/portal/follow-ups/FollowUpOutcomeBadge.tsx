import { StatusBadge } from "@/components/ui/status-badge";
import { OUTCOME_LABELS, type FollowUpOutcome } from "./types";

export function FollowUpOutcomeBadge({ outcome }: { outcome: FollowUpOutcome }) {
  return <StatusBadge variant={outcome === "resolved" ? "info" : outcome === "needs_follow_up" ? "warning" : "muted"}>{OUTCOME_LABELS[outcome]}</StatusBadge>;
}

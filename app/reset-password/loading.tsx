import { RecoverySkeleton } from "@/components/ui/recovery-skeleton";

export default function Loading() {
  return <RecoverySkeleton fields={2} label="reset password" />;
}

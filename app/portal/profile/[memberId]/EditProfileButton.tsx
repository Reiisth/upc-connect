"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function EditProfileButton({
  memberId,
}: {
  memberId: string;
}) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, [pathname]);

  return (
    <Link
      href={`/portal/profile/${memberId}/edit`}
      onClick={() => setLoading(true)}
      aria-disabled={loading}
      className="mt-5 inline-flex min-w-[140px] items-center justify-center gap-2 rounded-xl bg-[#5D94E8] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#4B82D6] aria-disabled:pointer-events-none aria-disabled:opacity-70"
    >
      {loading ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          Opening...
        </>
      ) : (
        <>
          <Pencil className="h-4 w-4" />
          Edit Profile
        </>
      )}
    </Link>
  );
}
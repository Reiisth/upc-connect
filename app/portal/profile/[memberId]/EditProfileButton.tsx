"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

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
    <Button
      asChild
      className="mt-5 min-w-[140px]"
    >
      <Link
        href={`/portal/profile/${memberId}/edit`}
        onClick={() => setLoading(true)}
        aria-disabled={loading}
        className={
          loading
            ? "pointer-events-none opacity-70"
            : undefined
        }
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
            Opening...
          </>
        ) : (
          <>
            <Pencil />
            Edit Profile
          </>
        )}
      </Link>
    </Button>
  );
}
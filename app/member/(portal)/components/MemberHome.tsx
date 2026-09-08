"use client";

import { useMember } from "./MemberProvider";
import MemberCard from "./MemberCard";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function MemberHome() {
  const { member } = useMember();
  const router = useRouter();
  const pathname = usePathname();

  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (pathname === "/member") {
      setIsEditing(false);
    }
  }, [pathname]);

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <div className="mb-5">
        <p className="text-sm font-medium text-[#5D94E8]">
          Welcome back
        </p>

        <h1 className="mt-1 font-body text-2xl font-semibold text-[#203264] sm:text-3xl">
          Blessed day, {member.nickname || member.first_name}!
        </h1>
      </div>

      <MemberCard member={member} />
      <button
        type="button"
        disabled={isEditing}
        onClick={() => {
          setIsEditing(true);
          router.push("/member/edit-profile");
        }}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#203264] px-4 py-3 text-sm font-medium text-[#203264] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isEditing ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#203264] border-t-transparent" />
            Opening editor...
          </>
        ) : (
          <>
            <Pencil className="h-4 w-4" />
            Edit Information
          </>
        )}
      </button>
    </div>
  );
}
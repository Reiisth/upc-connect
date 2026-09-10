"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { selectMemberProfile } from "./actions";

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  profile_status: string | null;
};

type ProfileGridProps = {
  members: Member[];
};

export default function ProfileGrid({ members }: ProfileGridProps) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function handleProfileClick(member: Member) {
    if (isNavigating) return;

    setIsNavigating(true);
    setSelectedId(member.id);

    try {
      if (member.profile_status === "completed") {
        await selectMemberProfile(member.id);
        return;
      }

      router.push(`/member/complete-profile/${member.id}`);
    } catch (error) {
      console.error("Failed to select profile:", error);

      setIsNavigating(false);
      setSelectedId(null);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {members.map((member) => {
        const initials =
          `${member.first_name?.[0] ?? ""}${member.last_name?.[0] ?? ""}`.toUpperCase();

        const isComplete = member.profile_status === "completed";
        const isSelected = selectedId === member.id;

        return (
          <button
            key={member.id}
            type="button"
            disabled={isNavigating}
            onClick={() => handleProfileClick(member)}
            className={`h-full min-h-[150px] w-full rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[190px] sm:p-5 ${isComplete ? "" : "border-amber-200"
              }`}
          >
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full text-lg font-semibold sm:h-20 sm:w-20 sm:text-2xl ${isComplete
                    ? "bg-brand-gradient text-white"
                    : "bg-amber-100 text-amber-700"
                  }`}
              >
                {initials}
              </div>

              <h2 className="mt-3 line-clamp-1 text-sm font-semibold text-[#203264] sm:text-base">
                {member.first_name} {member.last_name}
              </h2>

              <p
                className={`mt-1 text-xs sm:text-sm ${isComplete
                    ? "text-green-600"
                    : "font-medium text-amber-600"
                  }`}
              >
                {isSelected && isNavigating
                  ? "Loading..."
                  : isComplete
                    ? "Profile ready"
                    : "Complete profile"}
              </p>

              {isSelected && isNavigating && (
                <span className="mt-3 h-4 w-4 animate-spin rounded-full border-2 border-[#203264] border-t-transparent" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
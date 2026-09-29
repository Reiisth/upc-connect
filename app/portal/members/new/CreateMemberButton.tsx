"use client";

import { UserPlus } from "lucide-react";
import { useFormStatus } from "react-dom";

export default function CreateMemberButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center justify-center gap-2 rounded-xl bg-[#203264] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2C447D] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Creating member...
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" />
          Create Member
        </>
      )}
    </button>
  );
}
import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import CreateMemberButton from "./CreateMemberButton";

import { createMember } from "../actions";

export default function NewMemberPage() {
  return (
    <main className="mx-auto w-full max-w-2xl">
      {/* HEADER */}
      <div>
        <Link
          href="/staff/admin/members"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-[#203264]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Members
        </Link>

        <div className="mt-5 flex items-center gap-2 text-[#5D94E8]">
          <UserPlus className="h-4 w-4" />

          <p className="text-sm font-medium">
            Member Management
          </p>
        </div>

        <h1 className="mt-1 font-body text-2xl font-semibold text-[#203264] sm:text-3xl">
          Create Member
        </h1>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Create a basic member record. The member can complete the rest of
          their profile after their account is connected.
        </p>
      </div>

      {/* FORM CARD */}
      <div className="mt-7 rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
        <form action={createMember} className="space-y-5">
          <div>
            <label
              htmlFor="first_name"
              className="mb-2 block text-sm font-medium text-[#203264]"
            >
              First Name
            </label>

            <input
              id="first_name"
              name="first_name"
              required
              autoComplete="given-name"
              placeholder="Enter first name"
              className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:border-[#5D94E8] focus:ring-4 focus:ring-[#5D94E8]/10"
            />
          </div>

          <div>
            <label
              htmlFor="last_name"
              className="mb-2 block text-sm font-medium text-[#203264]"
            >
              Last Name
            </label>

            <input
              id="last_name"
              name="last_name"
              required
              autoComplete="family-name"
              placeholder="Enter last name"
              className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition focus:border-[#5D94E8] focus:ring-4 focus:ring-[#5D94E8]/10"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Link
              href="/staff/admin/members"
              className="flex items-center justify-center rounded-xl border px-5 py-3 text-sm font-medium text-[#203264] transition hover:bg-[#EEF3FB]"
            >
              Cancel
            </Link>

            <CreateMemberButton />
          </div>
        </form>
      </div>
    </main>
  );
}

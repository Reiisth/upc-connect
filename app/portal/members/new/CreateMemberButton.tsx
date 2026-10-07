"use client";

import { UserPlus } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export default function CreateMemberButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
    >
      {pending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          Creating member...
        </>
      ) : (
        <>
          <UserPlus />
          Create Member
        </>
      )}
    </Button>
  );
}
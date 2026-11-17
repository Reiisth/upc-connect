"use client";

import { useState, type ComponentProps } from "react";
import { IdCardLanyard } from "lucide-react";
import { Button } from "@/components/ui/button";
import MemberCardModal from "./MemberCardModal";

export default function MemberCardButton({ member }: Pick<ComponentProps<typeof MemberCardModal>, "member">) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" variant="outline" size="sm" className="min-h-11 shrink-0" aria-label="Show member card" onClick={() => setOpen(true)}><IdCardLanyard aria-hidden="true" />Member card</Button>
    {open && <MemberCardModal member={member} onClose={() => setOpen(false)} />}
  </>;
}

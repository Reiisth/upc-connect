"use client";

import { useState, type ComponentProps } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import MemberCardModal from "./MemberCardModal";

export default function MemberCardButton({ member }: Pick<ComponentProps<typeof MemberCardModal>, "member">) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" variant="outline" onClick={() => setOpen(true)}><CreditCard />Show Card</Button>
    {open && <MemberCardModal member={member} onClose={() => setOpen(false)} />}
  </>;
}

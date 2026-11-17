"use client";

import { useEffect, useState } from "react";
import { listContextReturnHref } from "@/lib/list-context-navigation";

/** Carry only a validated navigation destination; this never authorizes a mutation. */
export function WorkingContextField({ fallback }: { fallback: string }) {
  const [href, setHref] = useState(fallback);
  useEffect(() => { setHref(listContextReturnHref(fallback, window.location.search)); }, [fallback]);
  return <input type="hidden" name="returnTo" value={href} />;
}

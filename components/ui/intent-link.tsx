"use client";
import Link from "next/link";
import { listContextReturnHref } from "@/lib/list-context-navigation";
import { useEffect, useState, type ComponentProps } from "react";
/** Navigation and table links defer route prefetch until intent, then restore Next defaults. */
export default function IntentLink({onMouseEnter, onFocus, onTouchStart, preserveContext = false, restoreContext = false, forwardContext = false, ...props}: ComponentProps<typeof Link> & { preserveContext?: boolean; restoreContext?: boolean; forwardContext?: boolean }) {
  const [intent, setIntent] = useState(false);
  const [source, setSource] = useState("");
  useEffect(() => {
    if (!preserveContext && !restoreContext && !forwardContext) return;
    const sync = () => setSource(window.location.pathname + window.location.search);
    sync();
    window.addEventListener("portal:list-state", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("portal:list-state", sync);
      window.removeEventListener("popstate", sync);
    };
  }, [preserveContext, restoreContext, forwardContext]);
  let href = props.href;
  if (restoreContext && source && typeof href === "string") href = listContextReturnHref(href, source.includes("?") ? source.slice(source.indexOf("?")) : "");
  if ((preserveContext || forwardContext) && source && typeof href === "string" && href.startsWith("/portal/")) {
    const url = new URL(href, "http://portal.invalid");
    const original = new URL(source, "http://portal.invalid").searchParams.get("returnTo");
    url.searchParams.set("returnTo", forwardContext && original?.startsWith("/portal/") && !/[\\\r\n]/.test(original) ? original : source);
    href = url.pathname + url.search + url.hash;
  }
  return <Link {...props} href={href} prefetch={intent ? null : false}
    onMouseEnter={event => { setIntent(true); onMouseEnter?.(event); }}
    onFocus={event => { setIntent(true); onFocus?.(event); }}
    onTouchStart={event => { setIntent(true); onTouchStart?.(event); }} />;
}


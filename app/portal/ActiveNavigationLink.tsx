"use client";

import Link from "@/components/ui/intent-link";
import { usePathname } from "next/navigation";

/** Small client island for segment-safe current-page state. */
export default function ActiveNavigationLink({
  href,
  className,
  activeClassName,
  inactiveClassName,
  children,
}: {
  href: string;
  className: string;
  activeClassName: string;
  inactiveClassName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const activeHref = href.startsWith("/portal/accounts/") ? "/portal/accounts" : href;
  const active = pathname === activeHref || pathname.startsWith(`${activeHref}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${className} ${active ? activeClassName : inactiveClassName}`}
    >
      {children}
    </Link>
  );
}


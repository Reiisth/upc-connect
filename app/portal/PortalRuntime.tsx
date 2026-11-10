"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { initialPortalPrefetch, permitBackgroundPrefetch, portalFreshness } from "@/lib/navigation-performance";
import { Button } from "@/components/ui/button";
export default function PortalRuntime({userId, revision, routes, children}: {userId: string; revision: string; routes: string[]; children: React.ReactNode}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [connectionError, setConnectionError] = useState(false);
  // Client Components also render on the server. Start browser freshness clocks
  // after mount, not while Next is prerendering the route shell.
  const checked = useRef(0);
  const refreshed = useRef(0);
  const inFlight = useRef<AbortController | null>(null);
  const prefetched = useRef(new Map<string, number>());
  const warmRoute = useCallback((href: string) => {
    const connection = (navigator as Navigator & {connection?: {saveData?: boolean; effectiveType?: string}}).connection;
    if (!routes.includes(href) || href === pathname || !permitBackgroundPrefetch(connection) || document.visibilityState !== "visible") return;
    if (Date.now() - (prefetched.current.get(href) ?? 0) < portalFreshness(href)) return;
    prefetched.current.set(href, Date.now());
    // Route-shell warmup only; dynamic application reads stay behind their
    // authorized Suspense/private-cache boundaries until navigation needs them.
    router.prefetch(href);
  }, [pathname, router, routes]);
  const verify = useCallback(async (force = false) => {
    if (document.visibilityState !== "visible" || inFlight.current || (!force && Date.now() - checked.current < 30_000)) return;
    const controller = new AbortController(); inFlight.current = controller;
    try {
      const response = await fetch("/api/portal/session", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
      if (response.status === 401 || response.status === 403) { window.location.replace(response.status === 401 ? "/login" : "/access-denied"); return; }
      if (!response.ok) throw new Error("Verification unavailable");
      const session = await response.json();
      if (session.userId !== userId || session.revision !== revision) { window.location.reload(); return; }
      checked.current = Date.now(); setConnectionError(false);
      if (Date.now() - refreshed.current >= portalFreshness(pathname)) {
        refreshed.current = Date.now(); startTransition(() => router.refresh());
      }
    } catch { if (!controller.signal.aborted) setConnectionError(true); }
    finally { if (inFlight.current === controller) inFlight.current = null; }
  }, [pathname, revision, router, userId]);
  useEffect(() => { checked.current = Date.now(); }, []);
  useEffect(() => { refreshed.current = Date.now(); }, [pathname]);
  useEffect(() => {
    void verify();
    const onFocus = () => { void verify(true); };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) void verify(true); };
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("focus", onFocus); document.addEventListener("visibilitychange", onFocus);
    const interval = setInterval(onFocus, 30_000);
    return () => { clearInterval(interval); window.removeEventListener("pageshow", onPageShow); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); inFlight.current?.abort(); };
  }, [verify]);
  const warmed = useRef(false);
  useEffect(() => {
    if (warmed.current) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let canceled = false;
    const schedule = () => {
      if (canceled) return;
      if ([...document.querySelectorAll<HTMLElement>("[data-page-loading]")].some(element => element.getClientRects().length > 0)) { timers.push(setTimeout(schedule, 500)); return; }
      for (const [index, route] of initialPortalPrefetch(routes, pathname).entries()) {
        timers.push(setTimeout(() => { warmed.current = true; warmRoute(route); }, 1500 + index * 2500));
      }
    };
    schedule();
    return () => { canceled = true; timers.forEach(clearTimeout); };
  }, [pathname, routes, warmRoute]);
  return <>
    {connectionError && <div role="status" className="flex items-center justify-center gap-3 bg-amber-50 px-4 py-2 text-sm text-amber-800">Connection interrupted. Updates may be delayed.<Button type="button" variant="link" size="sm" onClick={() => void verify(true)}>Retry</Button></div>}
    {pending && <p role="status" className="sr-only">Refreshing current page</p>}
    {children}
  </>;
}

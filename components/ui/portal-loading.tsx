"use client";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
const messages = ["Preparing your workspace?", "Loading your church information?", "Getting your pages ready?", "Thank you for your patience?"];
export function PortalLoading() {
  const [message, setMessage] = useState(-1);
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const delay = setTimeout(() => { setMessage(0); interval = setInterval(() => setMessage(value => (value + 1) % messages.length), 4000); }, 3000);
    return () => { clearTimeout(delay); if (interval) clearInterval(interval); };
  }, []);
  return <div role="status" aria-label="Loading portal" className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#EEF3FB] p-6 text-center">
    <LoaderCircle aria-hidden="true" className="h-10 w-10 animate-spin text-[#365FA6] motion-reduce:animate-none" />
    <div className="min-h-6 text-sm text-slate-600" aria-live="polite">{message >= 0 ? messages[message] : <span className="sr-only">Loading portal</span>}</div>
  </div>;
}

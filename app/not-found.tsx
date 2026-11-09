import Link from "next/link";
import { FileQuestion, ArrowLeft, LogIn } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function StatusPage() {
  return <main className="flex min-h-screen items-center justify-center bg-[#EEF3FB] p-4 sm:p-8">
    <Card className="w-full max-w-lg overflow-hidden">
      <div className="h-2 bg-gradient-to-r from-[#5D94E8] to-[#203264]" />
      <CardContent className="p-8 text-center sm:p-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#EEF3FB] text-[#203264]"><FileQuestion className="h-8 w-8" aria-hidden="true" /></div>
        <p className="text-sm font-semibold uppercase tracking-widest text-[#5D94E8]">404</p>
        <h1 className="mt-3 font-radio-canada text-3xl font-semibold text-[#203264]">Page not found</h1>
        <p className="mt-4 leading-relaxed text-slate-600">This page may have moved, or the link may be incorrect.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild><Link href="/portal"><ArrowLeft aria-hidden="true" />Return to Portal</Link></Button>
          <Button variant="outline" asChild><Link href="/login"><LogIn aria-hidden="true" />Sign in</Link></Button>
        </div>
      </CardContent>
    </Card>
  </main>;
}

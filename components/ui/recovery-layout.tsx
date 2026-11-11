import Image from "next/image";
import type { ReactNode } from "react";

export function RecoveryLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      <section className="hidden bg-gradient-to-br from-[#5D94E8] to-[#203264] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/upc-logo.png"
            alt="UPC Batangas"
            width={52}
            height={52}
            className="h-13 w-13 object-contain"
          />
          <div>
            <p className="font-heading text-xl font-semibold">UPC CONNECT</p>
            <p className="text-sm text-white/70">
              United Pentecostal Church Batangas
            </p>
          </div>
        </div>

        <div className="max-w-lg">
          <h2 className="font-body text-4xl font-semibold leading-tight">
            One church.
            <br />
            One connected community.
          </h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/75">
            Recover access to your account and stay connected to your church
            community.
          </p>
        </div>

        <p className="text-xs text-white/50">UPC Batangas</p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-[#EEF3FB] px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image
              src="/upc-logo.png"
              alt="UPC Batangas"
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
            />
            <div>
              <p className="font-heading text-lg font-semibold text-[#203264]">
                UPC CONNECT
              </p>
              <p className="text-xs text-muted-foreground">
                United Pentecostal Church Batangas
              </p>
            </div>
          </div>

          {children}
        </div>
      </section>
    </main>
  );
}

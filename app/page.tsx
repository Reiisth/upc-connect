import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/upc-logo.png"
              alt="UPC Connect"
              width={44}
              height={44}
              priority
            />

            <span className="font-heading text-lg font-semibold">
              UPC CONNECT
            </span>
          </Link>

          <nav className="flex items-center gap-4 text-sm">
            <Link href="#about" className="hover:underline">
              About
            </Link>

            <Link href="#services" className="hover:underline">
              Services
            </Link>

            <Link
              href="/member/login"
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
            >
              Member Login
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-brand-gradient">
        <div className="absolute inset-0 bg-black/10" />

        <div className="relative mx-auto grid min-h-[65vh] max-w-6xl items-center gap-10 px-5 py-12 text-white sm:px-6 sm:py-16 md:grid-cols-2 md:py-20">
          <div>
            <div className="mb-6 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur">
              <Image
                src="/upc-logo.png"
                alt="UPC Connect logo"
                width={34}
                height={34}
              />

              <span className="text-sm font-medium">
                United Pentecostal Church Batangas
              </span>
            </div>

            <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-6xl">
              Stay connected with your church community.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-white/80">
              UPC Connect brings member information, church records, and family
              profiles together in one secure and accessible system.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/member/login"
                className="rounded-lg bg-white px-6 py-3 font-semibold text-[#203264] transition hover:bg-white/90"
              >
                Access Member Portal
              </Link>

              <Link
                href="#about"
                className="rounded-lg border border-white/40 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Learn More
              </Link>
            </div>
          </div>

          <div className="flex justify-center md:justify-end">
            <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-md">
              <div className="rounded-2xl bg-white p-6 text-foreground shadow-lg">
                <div className="flex items-center gap-4">
                  <Image
                    src="/upc-logo.png"
                    alt="UPC Connect"
                    width={56}
                    height={56}
                  />

                  <div>
                    <p className="text-sm text-muted-foreground">Welcome to</p>
                    <h2 className="text-2xl font-semibold text-[#203264]">
                      UPC Connect
                    </h2>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="rounded-xl bg-[#EEF3FB] p-4">
                    <p className="font-semibold text-[#203264]">Member Profiles</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Access the member profiles connected to your account.
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#EEF3FB] p-4">
                    <p className="font-semibold text-[#203264]">Family Access</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Manage multiple family member profiles from one account.
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#EEF3FB] p-4">
                    <p className="font-semibold text-[#203264]">Secure Records</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Keep important church information organized and accessible.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="border-t bg-muted/20">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-3xl font-bold">About UPC Connect</h2>

          <p className="mt-4 max-w-3xl text-muted-foreground">
            UPC Connect is the integrated church management system of United
            Pentecostal Church Batangas, designed to make member information
            and church records easier to manage and access.
          </p>
        </div>
      </section>

      <section id="services">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-3xl font-bold">Built for the church community</h2>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border p-6">
              <h3 className="font-semibold">For Members</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Access personal church information through a secure member
                account.
              </p>
            </div>

            <div className="rounded-xl border p-6">
              <h3 className="font-semibold">For Families</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Manage multiple linked member profiles conveniently from one
                account.
              </p>
            </div>

            <div className="rounded-xl border p-6">
              <h3 className="font-semibold">For UPC Batangas</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Maintain organized, centralized, and secure church records.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© UPC Batangas. UPC Connect.</p>

          <Link href="/staff/login" className="hover:text-foreground hover:underline">
            Staff Portal
          </Link>
        </div>
      </footer>
    </main>
  );
}
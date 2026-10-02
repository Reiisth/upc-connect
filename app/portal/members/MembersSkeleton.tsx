export default function MembersSkeleton() {
  return (
    <main className="space-y-6 animate-pulse">
      {/* PAGE HEADER */}
      <div>
        <div className="h-4 w-24 rounded bg-slate-200" />
        <div className="mt-3 h-9 w-40 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-72 max-w-full rounded bg-slate-200" />
      </div>

      {/* KPI CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border bg-white p-5 shadow-sm"
          >
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-4 h-8 w-16 rounded bg-slate-200" />
          </div>
        ))}
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        {/* TABLE HEADER / TOOLBAR */}
        <div className="border-b p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="h-6 w-32 rounded bg-slate-200" />
              <div className="mt-2 h-4 w-48 rounded bg-slate-100" />
            </div>

            <div className="h-11 w-full rounded-xl bg-slate-100 sm:w-64" />
          </div>
        </div>

        {/* COLUMN HEADERS */}
        <div className="hidden grid-cols-5 gap-4 border-b bg-slate-50 px-5 py-4 md:grid">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-4 w-20 rounded bg-slate-200"
            />
          ))}
        </div>

        {/* ROWS */}
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="grid gap-4 px-5 py-4 md:grid-cols-5 md:items-center"
            >
              <div>
                <div className="h-4 w-36 rounded bg-slate-200" />
                <div className="mt-2 h-3 w-24 rounded bg-slate-100" />
              </div>

              <div className="h-4 w-28 rounded bg-slate-200" />

              <div className="h-6 w-20 rounded-full bg-slate-100" />

              <div className="h-6 w-24 rounded-full bg-slate-100" />

              <div className="space-y-2">
                <div className="h-4 w-24 rounded bg-slate-200" />
                <div className="h-4 w-20 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
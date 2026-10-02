export default function ProfileSkeleton() {
  return (
    <main className="space-y-6 animate-pulse">
      <div>
        <div className="h-4 w-28 rounded bg-slate-200" />

        <div className="mt-3 h-9 w-36 rounded bg-slate-200" />

        <div className="mt-3 h-4 w-52 rounded bg-slate-200" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-full min-h-[150px] w-full rounded-2xl border bg-white p-3 shadow-sm sm:min-h-[190px] sm:p-5"
          >
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="h-14 w-14 rounded-full bg-slate-200 sm:h-20 sm:w-20" />

              <div className="mt-3 h-4 w-24 rounded bg-slate-200 sm:h-5 sm:w-28" />

              <div className="mt-2 h-3 w-20 rounded bg-slate-100 sm:h-4" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
export default function InviteMembersLoading() {
  return (
    <main className="mx-auto w-full max-w-3xl animate-pulse">
      {/* Back link */}
      <div className="h-4 w-32 rounded bg-slate-200" />

      {/* Header */}
      <div className="mt-5">
        <div className="h-4 w-36 rounded bg-slate-200" />

        <div className="mt-3 h-8 w-72 rounded bg-slate-200" />

        <div className="mt-3 space-y-2">
          <div className="h-4 w-full max-w-xl rounded bg-slate-200" />
          <div className="h-4 w-3/4 max-w-lg rounded bg-slate-200" />
        </div>
      </div>

      {/* Form card */}
      <div className="mt-7 rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
        <div className="space-y-7">
          {/* Email */}
          <div>
            <div className="h-4 w-28 rounded bg-slate-200" />

            <div className="mt-3 h-12 w-full rounded-xl bg-slate-200" />

            <div className="mt-2 h-3 w-80 max-w-full rounded bg-slate-200" />
          </div>

          {/* Members */}
          <div>
            <div className="h-4 w-28 rounded bg-slate-200" />

            <div className="mt-4 h-12 w-full rounded-xl bg-slate-200" />

            <div className="mt-4 space-y-2 rounded-2xl border bg-[#F8FAFD] p-3">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-xl bg-white p-3"
                >
                  <div className="h-4 w-4 rounded bg-slate-200" />

                  <div className="flex-1">
                    <div className="h-4 w-44 rounded bg-slate-200" />
                    <div className="mt-2 h-3 w-20 rounded bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Button */}
          <div className="flex justify-end">
            <div className="h-11 w-40 rounded-xl bg-slate-200" />
          </div>
        </div>
      </div>
    </main>
  );
}
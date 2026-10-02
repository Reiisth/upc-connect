export default function ProfileMemberSkeleton() {
  return (
    <div className="mx-auto w-full animate-pulse">
      {/* PAGE HEADER */}
      <div className="mb-6">
        <div className="h-4 w-16 rounded bg-slate-200" />

        <div className="mt-3 h-9 w-44 rounded bg-slate-200" />

        <div className="mt-3 h-4 w-72 max-w-full rounded bg-slate-200" />
      </div>

      <div className="flex flex-col items-center">
        <div className="w-full max-w-[420px]">
          {/* CONTROLS */}
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="h-10 w-32 rounded-xl bg-slate-200" />

            <div className="flex rounded-xl bg-white p-1 shadow-sm">
              <div className="h-8 w-16 rounded-lg bg-slate-200" />
              <div className="h-8 w-16 rounded-lg bg-slate-100" />
            </div>
          </div>

          {/* MEMBER CARD */}
          <div className="overflow-hidden rounded-3xl border bg-white shadow-lg">
            {/* CARD HEADER */}
            <div className="bg-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="h-[50px] w-[50px] rounded-full bg-slate-300" />

                <div className="flex-1">
                  <div className="h-4 w-48 max-w-full rounded bg-slate-300" />
                  <div className="mt-2 h-3 w-28 rounded bg-slate-300" />
                </div>
              </div>
            </div>

            <div className="p-5">
              {/* NAME + AVATAR */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="h-6 w-44 rounded bg-slate-200" />
                  <div className="mt-2 h-4 w-24 rounded bg-slate-100" />
                </div>

                <div className="h-20 w-20 shrink-0 rounded-2xl bg-slate-200" />
              </div>

              {/* MEMBER INFO */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index}>
                    <div className="h-3 w-20 rounded bg-slate-100" />
                    <div className="mt-2 h-4 w-28 max-w-full rounded bg-slate-200" />
                  </div>
                ))}
              </div>

              {/* QR AREA */}
              <div className="mt-6 flex flex-col items-center rounded-2xl bg-[#EEF3FB] p-5">
                <div className="h-3 w-24 rounded bg-slate-200" />

                <div className="mt-3 h-[152px] w-[152px] rounded-2xl bg-white p-4 shadow-sm">
                  <div className="h-full w-full rounded bg-slate-200" />
                </div>

                <div className="mt-3 h-3 w-52 max-w-full rounded bg-slate-200" />
              </div>
            </div>
          </div>
        </div>

        {/* EDIT BUTTON */}
        <div className="mt-5 h-11 w-36 rounded-xl bg-slate-200" />
      </div>
    </div>
  );
}
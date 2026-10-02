export default function IncompleteProfileSkeleton() {
  return (
    <div className="mx-auto max-w-5xl w-full animate-pulse">
      {/* HEADER */}
      <div className="mb-8">
        <div className="h-4 w-16 rounded bg-slate-200" />
        <div className="mt-3 h-9 w-48 rounded bg-slate-200" />
        <div className="mt-3 h-4 w-72 max-w-full rounded bg-slate-200" />
      </div>

      <div className="space-y-8">
        <SkeletonSection fields={8} />
        <SkeletonSection fields={6} />
        <SkeletonSection fields={4} />

        <div className="h-12 w-full rounded-xl bg-slate-200 sm:w-36" />
      </div>
    </div>
  );
}

function SkeletonSection({
  fields,
}: {
  fields: number;
}) {
  return (
    <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
      <div className="h-6 w-44 rounded bg-slate-200" />

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index}>
            <div className="mb-2 h-4 w-24 rounded bg-slate-200" />
            <div className="h-12 w-full rounded-xl bg-slate-100" />
          </div>
        ))}
      </div>
    </section>
  );
}
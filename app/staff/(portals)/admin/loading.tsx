export default function AdminLoading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded bg-white" />
      <div className="h-64 animate-pulse rounded-xl bg-white" />
    </div>
  );
}
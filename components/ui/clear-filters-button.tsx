import { Button } from "@/components/ui/button";

export function ClearFiltersButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`h-auto min-h-11 rounded-lg px-1 py-2 text-sm font-medium text-slate-600 hover:bg-transparent hover:text-[#203264] hover:underline md:min-h-9 ${className ?? ""}`}
    >
      Clear filters
    </Button>
  );
}

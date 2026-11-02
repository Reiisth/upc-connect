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
      className={`h-auto rounded-none px-0 py-0 text-sm font-medium text-slate-500 hover:bg-transparent hover:text-[#203264] hover:underline ${className ?? ""}`}
    >
      Clear filters
    </Button>
  );
}

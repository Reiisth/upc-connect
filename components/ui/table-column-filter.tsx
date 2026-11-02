"use client";

import { Filter } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type FilterOption = { value: string; label: string };

export function TableColumnFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  const activeLabel = options.find((option) => option.value === value)?.label;
  const active = value !== "all";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Filter ${label}${activeLabel ? `, currently ${activeLabel}` : ""}`}
          aria-pressed={active}
          aria-haspopup="menu"
          className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-[#5D94E8] focus-visible:ring-offset-2 ${active ? "bg-blue-50 text-[#203264]" : "text-slate-500 hover:bg-slate-100 hover:text-[#203264]"}`}
        >
          <Filter className="h-4 w-4" aria-hidden="true" />
          {active && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
          {active && <span className="sr-only">Active filter: {activeLabel}</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuLabel>Filter {label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {active && <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onChange("all")}>Clear filter</DropdownMenuItem>
        </>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

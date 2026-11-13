import Link from "next/link";
import { Button } from "./button";

type Props = { page: number; pageSize: number; total: number; label: string; noun?: string } & (
  { onPageChange: (page: number) => void; hrefForPage?: never } |
  { hrefForPage: (page: number) => string; onPageChange?: never }
);

export function Pagination({ page, pageSize, total, label, noun = "records", onPageChange, hrefForPage }: Props) {
  if (!total) return null;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.max(1, Math.min(page, pages));
  function control(target: number, text: string, disabled: boolean) {
    return hrefForPage && !disabled ? <Button variant="outline" size="sm" asChild><Link href={hrefForPage(target)}>{text}</Link></Button>
      : <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onPageChange?.(target)}>{text}</Button>;
  }
  return <nav aria-label={label} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <p role="status" aria-live="polite" className="text-sm text-slate-500">Showing {(current - 1) * pageSize + 1}-{Math.min(current * pageSize, total)} of {total} {noun}</p>
    <div className="flex flex-wrap items-center gap-2">
      {control(current - 1, "Previous", current === 1)}
      <span className="text-sm text-slate-500">Page {current} of {pages}</span>
      {control(current + 1, "Next", current === pages)}
    </div>
  </nav>;
}

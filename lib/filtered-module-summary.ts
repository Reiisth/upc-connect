import type { ModuleSummary } from "@/components/module-summary";
import type { ContributionRecord } from "@/app/portal/contributions/types";
import type { BaptismRecord } from "@/app/portal/baptisms/types";

type Row = ContributionRecord | BaptismRecord;
const dateOf = (row: Row) => "contributionDate" in row ? row.contributionDate : row.baptismDate;
const cents = (amount: string) => { const [whole, fraction = ""] = amount.split("."); return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0")); };
const decimal = (value: bigint) => `${value / BigInt(100)}.${String(value % BigInt(100)).padStart(2, "0")}`;

/** Input contains all authorized records matching the non-date filters, never a page slice. */
export function filteredModuleSummary(base: ModuleSummary, rows: Row[]): ModuleSummary {
  const money = base.module === "contributions";
  function period(from: string, to: string) {
    const dated = rows.filter(row => { const date = dateOf(row); return date && date >= from && date <= to; });
    const sum = (items: Row[]) => items.reduce((total, row) => total + ("amount" in row ? cents(row.amount) : BigInt(0)), BigInt(0));
    const amount = sum(dated);
    const totals = [{ branchId: null, count: dated.length, ...(money ? {
      amount: decimal(amount), average: dated.length ? decimal((amount + BigInt(Math.floor(dated.length / 2))) / BigInt(dated.length)) : null,
    } : {
      water: dated.filter(row => "baptismType" in row && row.baptismType === "water").length,
      holyGhost: dated.filter(row => "baptismType" in row && row.baptismType === "holy_ghost").length,
      undated: rows.filter(row => !dateOf(row)).length,
    }) }];
    const months = [...new Set(dated.map(row => `${dateOf(row)!.slice(0, 7)}-01`))].sort();
    const trend = months.map(period => {
      const items = dated.filter(row => dateOf(row)!.slice(0, 7) === period.slice(0, 7));
      return { branchId: null, period, value: money ? decimal(sum(items)) : items.length,
        water: items.filter(row => "baptismType" in row && row.baptismType === "water").length,
        holyGhost: items.filter(row => "baptismType" in row && row.baptismType === "holy_ghost").length };
    });
    const breakdown = (money ? ["member", "visitor", "anonymous"] : ["water", "holy_ghost"]).map(label => {
      const items = dated.filter(row => "contributorType" in row ? row.contributorType === label : row.baptismType === label);
      return { branchId: null, label, value: money ? decimal(sum(items)) : items.length };
    });
    return { totals, trend, breakdown };
  }
  return { ...base, ...period(base.from, base.to), comparison: base.comparison ? {
    ...base.comparison, totals: period(base.comparison.from, base.comparison.to).totals,
  } : undefined };
}

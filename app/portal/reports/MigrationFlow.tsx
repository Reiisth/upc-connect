"use client";

import { useId, useMemo, useState } from "react";
import { ArrowRight, ArrowRightLeft, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { MigrationAnalytics } from "@/lib/member-migrations/server";
import { layoutMigrationFlows, migrationFlowModel, migrationFlowSummary, wrapFlowLabel, type MigrationFlow as Flow, type PositionedFlowNode } from "@/lib/member-migrations/flow-layout";

const number = (value: number) => value.toLocaleString("en-PH");
const kindLabel = (flow: Flow) => flow.kind === "departure" ? "departure" : flow.kind === "return" ? "return" : "transfer";
const quantity = (flow: Flow) => `${number(flow.count)} ${kindLabel(flow)}${flow.count === 1 ? "" : "s"}`;

export default function MigrationFlow({ data }: { data: MigrationAnalytics }) {
  const prefix = useId();
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [includeExternal, setIncludeExternal] = useState(false);
  const [inspected, setInspected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const model = useMemo(() => migrationFlowModel(data,includeExternal),[data,includeExternal]);
  const layout = useMemo(() => layoutMigrationFlows(model),[model]);
  const nodes = new Map(model.nodes.map(node => [node.id,node]));
  const branches = model.nodes.filter(node => node.category === "branch");
  // A new applied scope may remove the previously selected branch.
  const selection = branches.some(node => node.id === selectedBranch) ? selectedBranch : "all";
  const matches = (flow: Flow) => selection === "all" || flow.source === selection || flow.destination === selection;
  const visible = model.flows.filter(matches);
  const activeRoute = visible.find(flow => flow.id === (hovered ?? inspected));
  const summary = migrationFlowSummary(model,selection);
  const routeLabel = (flow: Flow) => `${nodes.get(flow.source)!.label} → ${nodes.get(flow.destination)!.label}: ${quantity(flow)}`;
  const total = visible.reduce((sum,flow) => sum+flow.count,0);

  function chooseBranch(value: string) {
    setSelectedBranch(value);setInspected(null);setHovered(null);
  }
  function chooseRoute(flow: Flow) {
    if (!matches(flow)) chooseBranch("all");
    setInspected(inspected === flow.id ? null : flow.id);setHovered(null);
  }
  function nodeView(node: PositionedFlowNode, side: "from" | "to") {
    const selectable = node.category === "branch";
    const chosen = selection === node.id;
    const related = selection === "all" || chosen || model.flows.some(flow => matches(flow) && (side === "from" ? flow.source === node.id : flow.destination === node.id));
    const lines = wrapFlowLabel(node.label);
    const center = node.y+node.height/2;
    const select = () => { if (selectable) chooseBranch(chosen ? "all" : node.id); };
    return <g key={`${side}:${node.id}`} role={selectable ? "button" : undefined} tabIndex={selectable ? 0 : undefined}
      aria-label={`${side === "from" ? "From" : "To"} ${node.label}, ${number(node.total)} ${includeExternal ? "movements" : "transfers"}${selectable ? ". Highlight this branch" : ""}`}
      aria-pressed={selectable ? chosen : undefined} className={selectable ? "group cursor-pointer outline-none" : undefined}
      onClick={selectable ? select : undefined} onKeyDown={selectable ? event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault();select(); }
      } : undefined} opacity={related ? 1 : 0.4}>
      <title>{node.label}</title>
      <rect x={side === "from" ? 0 : 738} y={node.y} width={222} height={node.height} rx={10}
        fill={chosen ? "#EEF3FB" : "transparent"} stroke="transparent" strokeWidth={2} className="group-focus-visible:stroke-[#365FA6]" />
      <rect x={node.x} y={node.y} width={18} height={node.height} rx={5} fill={node.color} />
      <text x={side === "from" ? 180 : 780} y={center-(lines.length-1)*8-4} textAnchor={side === "from" ? "end" : "start"} fontSize={14} fontWeight={600} fill="#203264">
        {lines.map((line,index) => <tspan key={index} x={side === "from" ? 180 : 780} dy={index ? 16 : 0}>{line}</tspan>)}
      </text>
      <text x={side === "from" ? 180 : 780} y={center+(lines.length-1)*8+16} textAnchor={side === "from" ? "end" : "start"} fontSize={12} fill="#64748B" className="tabular-nums">{number(node.total)} {includeExternal ? "movements" : "transfers"}</text>
    </g>;
  }
  function routeCards() {
    return <ul className="grid gap-2 sm:grid-cols-2">
      {visible.map(flow => <li key={flow.id} className="min-w-0">
        <button type="button" aria-label={routeLabel(flow)} aria-pressed={inspected === flow.id} onClick={() => chooseRoute(flow)}
          className={`flex min-h-16 w-full items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#365FA6] ${inspected === flow.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
          <span className="h-10 w-1 shrink-0 rounded-full" style={{backgroundColor:flow.color}} aria-hidden="true" />
          <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium text-[#203264]">{nodes.get(flow.source)!.label}</span>
            <span className="mt-1 flex items-start gap-1.5 text-sm text-slate-600"><ArrowRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span className="break-words">{nodes.get(flow.destination)!.label}</span></span>
          </span>
          <span className="shrink-0 text-right"><span className="block text-xl font-semibold tabular-nums text-[#203264]">{number(flow.count)}</span><span className="text-xs text-slate-500">{kindLabel(flow)}{flow.count === 1 ? "" : "s"}</span></span>
        </button>
      </li>)}
    </ul>;
  }

  return <Card className="min-w-0"><CardContent className="space-y-4 p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 id={`${prefix}-title`} className="flex items-center gap-2 text-lg font-semibold text-[#203264]"><ArrowRightLeft className="h-5 w-5 text-[#365FA6]" aria-hidden="true" />Member Flow</h3>
        <p className="mt-1 text-sm text-slate-600">Follow the routes between branches. Wider bands mean more {includeExternal ? "movements" : "transfers"}.</p>
      </div>
      <span className="rounded-full bg-[#EEF3FB] px-3 py-1.5 text-sm font-semibold tabular-nums text-[#203264]">{number(total)} {includeExternal ? "movements" : "transfers"}</span>
    </div>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-1 text-sm text-slate-700" htmlFor={`${prefix}-external`}>
        <Checkbox id={`${prefix}-external`} checked={includeExternal} onCheckedChange={checked => {setIncludeExternal(checked === true);setInspected(null);setHovered(null);}} />
        Include departures and returns
      </label>
      {selection !== "all" && <Button type="button" variant="ghost" size="sm" onClick={() => chooseBranch("all")}><RotateCcw aria-hidden="true" />Show all branches</Button>}
    </div>
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="mb-2 text-xs font-medium text-slate-600">{selection === "all" ? "All branches" : nodes.get(selection)!.label} · {includeExternal ? "All shown movements" : "Transfers only"}</p>
      <dl className="grid grid-cols-3 gap-3">{[[includeExternal ? "Incoming" : "Transfers in",summary.incoming],[includeExternal ? "Outgoing" : "Transfers out",summary.outgoing],[includeExternal ? "Net Movement" : "Net Transfers",summary.net]].map(([label,value]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-lg font-semibold tabular-nums text-[#203264]">{Number(value) > 0 && String(label).startsWith("Net ") ? "+" : ""}{number(Number(value))}</dd></div>)}</dl>
    </div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
      <span>Transfers use the source branch color</span>
      {includeExternal && <><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#B7791F]" aria-hidden="true" />Departures</span><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#16836B]" aria-hidden="true" />Returns</span></>}
    </div>
    <p role="status" aria-live="polite" className="min-h-6 text-sm font-medium text-[#203264]">{activeRoute ? routeLabel(activeRoute) : selection === "all" ? "Select a branch to highlight its routes." : `Showing routes involving ${nodes.get(selection)!.label}.`}</p>
    {!visible.length ? <EmptyState title={includeExternal ? "No movements in this selection" : "No transfers in this selection"} description={includeExternal ? "Try another branch or date range." : "Try another branch or date range, or include departures and returns."} /> : <>
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white xl:block">
        <div className="flex justify-between border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"><span>From branch</span><span>To branch</span></div>
        <div className="max-h-[38rem] overflow-y-auto p-3">
          <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className="dashboard-chart-enter block h-auto w-full" role="group" aria-labelledby={`${prefix}-title`} aria-describedby={`${prefix}-description`}>
            <desc id={`${prefix}-description`}>Recorded movements flow from left to right. Each band represents events, not distinct members. Select a branch or route using the keyboard or pointer.</desc>
            {layout.links.map(flow => <g key={flow.id}>
              <path d={flow.path} fill={flow.color} opacity={!matches(flow) ? 0.08 : activeRoute ? activeRoute.id === flow.id ? 0.85 : 0.18 : selection === "all" ? 0.45 : 0.7}
                role="button" tabIndex={matches(flow) ? 0 : -1} aria-label={routeLabel(flow)} aria-pressed={inspected === flow.id}
                onMouseEnter={() => {if(matches(flow))setHovered(flow.id);}} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(flow.id)} onBlur={() => setHovered(null)}
                onClick={() => chooseRoute(flow)} onKeyDown={event => {if(event.key === "Enter" || event.key === " "){event.preventDefault();chooseRoute(flow);}}}
                className="cursor-pointer outline-none focus-visible:stroke-[#203264]" strokeWidth={2}>
                <title>{routeLabel(flow)}</title>
              </path>
              {matches(flow) && (flow.thickness >= 18 || layout.links.length <= 8) && <g pointerEvents="none" aria-hidden="true" opacity={activeRoute && activeRoute.id !== flow.id ? 0.3 : 1}>
                <rect x={flow.labelX-(number(flow.count).length*8+18)/2} y={flow.labelY-11} width={number(flow.count).length*8+18} height={22} rx={8} fill="white" stroke="#E2E8F0" />
                <text x={flow.labelX} y={flow.labelY+4} textAnchor="middle" fontSize={12} fontWeight={600} fill="#203264" className="tabular-nums">{number(flow.count)}</text>
              </g>}
            </g>)}
            {layout.left.map(node => nodeView(node,"from"))}{layout.right.map(node => nodeView(node,"to"))}
          </svg>
        </div>
      </div>
      <div className="xl:hidden" aria-label="Directional migration routes">{routeCards()}</div>
      <details className="hidden xl:block"><summary className="inline-flex min-h-11 cursor-pointer items-center rounded-lg px-1 text-sm font-medium text-[#365FA6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#365FA6]">View routes and exact counts</summary><div className="mt-2">{routeCards()}</div></details>
    </>}
  </CardContent></Card>;
}

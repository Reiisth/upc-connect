"use client";

import { chartCeiling } from "@/lib/chart-scale";
import { useEffect, useId, useRef, useState } from "react";
import { useChartScale } from "./use-chart-scale";

type SparklineProps = { values: readonly number[]; previousValues?: readonly number[]; pointLabels?:readonly string[]; previousPointLabels?:readonly string[]; label: string; scaleKey: string; className?: string };

/** A miniature trend that keeps its zero baseline and scale when filters reduce values. */
export function Sparkline({ values, previousValues = [], pointLabels=[],previousPointLabels=[],label, scaleKey, className }: SparklineProps) {
  const id=useId();
  const wrapper=useRef<HTMLDivElement>(null);
  const closeTimer=useRef<number|undefined>(undefined);
  const [active,setActive]=useState<number|null>(null);
  const index=active===null?null:Math.min(active,Math.max(0,values.length-1));
  const cancelClose=()=>{window.clearTimeout(closeTimer.current);};
  const scheduleClose=()=>{cancelClose();closeTimer.current=window.setTimeout(()=>setActive(null),150);};
  useEffect(()=>()=>window.clearTimeout(closeTimer.current),[]);
  useEffect(()=>{
    if (active===null) return;
    const dismiss=(event:PointerEvent)=>{if(!wrapper.current?.contains(event.target as Node))setActive(null);};
    document.addEventListener("pointerdown",dismiss);
    return ()=>document.removeEventListener("pointerdown",dismiss);
  },[active]);
  const width = 320, height = 88, padding = 5;
  const safe = values.length ? values.map(value => Number.isFinite(value) ? Math.max(0, value) : 0) : [0];
  const prior=previousValues.map(value=>Number.isFinite(value)?Math.max(0,value):0);
  const max = useChartScale(scaleKey, chartCeiling(Math.max(0, ...safe, ...prior)), true).max;
  const coordinates = (series: readonly number[]) => series.map((value, index) => ({
    x: series.length === 1 ? width / 2 : padding + index * (width - padding * 2) / (series.length - 1),
    y: height - padding - value / max * (height - padding * 2),
  }));
  const points=coordinates(safe), previousPoints=coordinates(prior);
  const lineFor=(series: typeof points) => series.length === 1 ? `${padding},${series[0].y} ${width - padding},${series[0].y}` : series.map(point => `${point.x},${point.y}`).join(" ");
  const line=lineFor(points), previousLine=lineFor(previousPoints);
  const last = points[points.length - 1];
  const priorIndex=index===null||!prior.length?null:Math.round(index/Math.max(1,safe.length-1)*(prior.length-1));
  const difference=index!==null&&priorIndex!==null?safe[index]-prior[priorIndex]:null;
  const choosePoint=(event:React.PointerEvent<SVGSVGElement>)=>{
    cancelClose();
    const bounds=event.currentTarget.getBoundingClientRect();
    const x=bounds.width ? (event.clientX-bounds.left)/bounds.width*width : width;
    setActive(Math.max(0,Math.min(safe.length-1,Math.round((x-padding)/(width-padding*2)*(safe.length-1)))));
  };
  const number=(value:number)=>value.toLocaleString("en-PH");
  return <div ref={wrapper} className="relative min-w-0">
  <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={label} aria-describedby={index===null?undefined:`${id}-tooltip`} tabIndex={0}
    onPointerMove={choosePoint} onPointerDown={choosePoint} onPointerLeave={event=>{if(event.pointerType!=="touch")scheduleClose();}}
    onFocus={()=>{cancelClose();setActive(current=>current??safe.length-1);}} onBlur={()=>{cancelClose();setActive(null);}}
    onKeyDown={event=>{
      if(event.key==="Escape"){setActive(null);return;}
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
      event.preventDefault();setActive(event.key==="Home"?0:event.key==="End"?safe.length-1:Math.max(0,Math.min(safe.length-1,(index??safe.length-1)+(event.key==="ArrowLeft"?-1:1))));
    }}
    className={`dashboard-sparkline block h-auto w-full rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#5D94E8] ${className ?? ""}`} preserveAspectRatio="xMidYMid meet">
    <title>{index===null?label:""}</title>
    <desc>Hover or tap to compare membership totals. Use Left and Right arrow keys to browse points; Escape closes the tooltip.</desc>
    <defs>
      <linearGradient id={`${id}-blue`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.24" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient>
      <linearGradient id={`${id}-grey`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#94A3B8" stopOpacity="0.14" /><stop offset="100%" stopColor="#94A3B8" stopOpacity="0" /></linearGradient>
    </defs>
    <rect x="0" y="0" width={width} height={height} fill="transparent" aria-hidden="true" />
    {Array.from({length:6},(_,index)=><line key={index} x1={padding+index*(width-padding*2)/5} x2={padding+index*(width-padding*2)/5} y1={padding} y2={height-padding} stroke="#CBD5E1" strokeOpacity="0.45" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />)}
    <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" strokeOpacity="0.12" />
    {prior.length > 0 && <polygon points={`${padding},${height-padding} ${previousLine} ${width-padding},${height-padding}`} fill={`url(#${id}-grey)`} />}
    <polygon points={`${padding},${height - padding} ${line} ${width - padding},${height - padding}`} fill={`url(#${id}-blue)`} />
    {prior.length > 0 && <polyline pathLength={1} strokeDasharray="1" points={previousLine} fill="none" stroke="#94A3B8" strokeWidth="1.5" strokeLinejoin="miter" strokeLinecap="butt" vectorEffect="non-scaling-stroke" />}
    <polyline pathLength={1} strokeDasharray="1" points={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" strokeLinecap="butt" vectorEffect="non-scaling-stroke" />
    <circle cx={last.x} cy={last.y} r="3.5" fill="currentColor" />
    {index!==null&&<g aria-hidden="true"><line x1={points[index].x} x2={points[index].x} y1={padding} y2={height-padding} stroke="#94A3B8" strokeDasharray="3 3"/>{priorIndex!==null&&<circle cx={previousPoints[priorIndex].x} cy={previousPoints[priorIndex].y} r="3" fill="#94A3B8" stroke="white" strokeWidth="1.5"/>}<circle cx={points[index].x} cy={points[index].y} r="4" fill="currentColor" stroke="white" strokeWidth="2"/></g>}
  </svg>
  {index!==null&&<div id={`${id}-tooltip`} role="tooltip" onPointerEnter={cancelClose} onPointerLeave={scheduleClose} className="absolute bottom-full right-0 z-50 mb-2 w-60 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-xl">
    <p className="font-semibold text-[#203264]">{pointLabels[index]??`Point ${index+1}`}</p>
    <p className="mt-1 flex justify-between gap-2"><span>Current period</span><strong className="tabular-nums text-[#5D94E8]">{number(safe[index])} members</strong></p>
    {priorIndex!==null&&<><p className="mt-2 text-slate-500">{previousPointLabels[priorIndex]??"Previous period"}</p><p className="mt-1 flex justify-between gap-2"><span>Previous period</span><strong className="tabular-nums text-slate-500">{number(prior[priorIndex])} members</strong></p><p className={`mt-2 border-t border-slate-100 pt-2 font-semibold tabular-nums ${difference!>0?"text-emerald-700":difference!<0?"text-red-700":"text-slate-500"}`}>{difference!>0?"+":""}{number(difference!)} vs previous period</p></>}
  </div>}
  </div>;
}

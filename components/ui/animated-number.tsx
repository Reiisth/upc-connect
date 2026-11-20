"use client";
import { useEffect, useRef } from "react";

/** Interpolate integer units (including cents) without rounding large money through Number. */
export function interpolateMetric(value:string,progress:number):string {
  if (progress >= 1) return value;
  const match=/^([^\d]*?)([+-]?)(\d[\d,]*)(?:\.(\d+))?(%?)$/.exec(value);
  if (!match) return value;
  const [,prefix,sign,whole,fraction="",suffix]=match;
  const units=BigInt(whole.replaceAll(",","")+fraction);
  const current=(units*BigInt(Math.round(Math.max(0,Math.min(1,progress))*1_000_000))/BigInt(1_000_000)).toString().padStart(fraction.length+1,"0");
  const integer=(fraction ? current.slice(0,-fraction.length) : current).replace(/\B(?=(\d{3})+(?!\d))/g,",");
  return `${prefix}${sign}${integer}${fraction ? "."+current.slice(-fraction.length) : ""}${suffix}`;
}

export function AnimatedNumber({value,as:Tag="span",className}:{value:string;as?:"span"|"p"|"dd";className?:string}) {
  const ref=useRef<HTMLElement|null>(null);
  useEffect(()=>{
    const element=ref.current;
    if (!element) return;
    element.textContent=value;
    const media=window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (media?.matches || !window.requestAnimationFrame || interpolateMetric(value,0) === value) return;
    let frame=0,start:number|undefined;
    const finish=()=>{window.cancelAnimationFrame(frame);element.textContent=value;};
    const tick=(now:number)=>{
      start??=now;
      const progress=Math.min(1,(now-start)/900);
      element.textContent=interpolateMetric(value,1-Math.pow(1-progress,3));
      if (progress<1) frame=window.requestAnimationFrame(tick);
    };
    const begin=()=>{element.textContent=interpolateMetric(value,0);frame=window.requestAnimationFrame(tick);};
    const observer=typeof window.IntersectionObserver === "function" ? new window.IntersectionObserver(entries=>{
      if (entries.some(entry=>entry.isIntersecting)) {observer?.disconnect();begin();}
    },{threshold:0.15}) : null;
    if (observer) observer.observe(element); else begin();
    const motionChanged=()=>{if(media?.matches){observer?.disconnect();finish();}};
    media?.addEventListener("change",motionChanged);
    return ()=>{observer?.disconnect();finish();media?.removeEventListener("change",motionChanged);};
  },[value]);
  // Full, exact values render on the server and remain available without animation.
  return <Tag ref={element=>{ref.current=element;}} className={className} aria-live="off">{value}</Tag>;
}

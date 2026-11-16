"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createChartScaleStore } from "@/lib/chart-scale";

const scales = createChartScaleStore();
const serverCeiling = () => 0;

export function useChartScale(key: string, required: number, enabled: boolean) {
  const saved = useSyncExternalStore(scales.subscribe, () => scales.get(key), serverCeiling);
  useEffect(() => {
    if (enabled) scales.set(key, required);
  }, [key, required, enabled]);
  // Expand immediately so a new larger value can never be clipped before the effect.
  return { max: Math.max(saved, required), fit: () => scales.set(key, required, true) };
}

const reducedMotion = () => typeof window === "undefined" || !window.matchMedia || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function subscribeMotion(listener: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
export function useChartReducedMotion() {
  return useSyncExternalStore(subscribeMotion, reducedMotion, () => true);
}

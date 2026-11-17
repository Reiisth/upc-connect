"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

// Only UI selections belong here. Records, permissions and pending operations stay in React.
export function readListState<T>(search: string, key: string, fallback: T): T {
  try {
    const raw = new URLSearchParams(search).get(`view.${key}`);
    if (raw === null) return fallback;
    const value: unknown = JSON.parse(raw);
    return sameShape(value, fallback) ? value as T : fallback;
  } catch { return fallback; }
}

function sameShape(value: unknown, fallback: unknown): boolean {
  if (typeof fallback === "number") return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
  if (typeof fallback === "string") return typeof value === "string" && value.length <= 500;
  if (typeof fallback === "boolean") return typeof value === "boolean";
  if (!fallback || typeof fallback !== "object" || !value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value).length === Object.keys(fallback).length && Object.entries(fallback).every(([key, item]) =>
    Object.hasOwn(value, key) && sameShape((value as Record<string, unknown>)[key], item));
}

/** Keep list controls in the URL so refresh, browser Back and copied links restore them. */
export function useListState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const defaults = useRef(initial);
  const [value, setValue] = useState(initial);
  const current = useRef(value);
  current.current = value;
  useEffect(() => {
    function restore() {
      const next = readListState(window.location.search, key, defaults.current);
      current.current = next;
      setValue(next);
    }
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [key]);
  function update(action: SetStateAction<T>) {
    const next = typeof action === "function" ? (action as (previous: T) => T)(current.current) : action;
    current.current = next;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (JSON.stringify(next) === JSON.stringify(defaults.current)) url.searchParams.delete(`view.${key}`);
      else url.searchParams.set(`view.${key}`, JSON.stringify(next));
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
      window.dispatchEvent(new Event("portal:list-state"));
    }
    setValue(next);
  }
  return [value, update];
}

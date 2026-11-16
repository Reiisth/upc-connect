/** Largest plotted extent, including the sum of series in stacked charts. */
export function chartExtent(series: (number | null)[][], stacked: boolean) {
  let largest = 0;
  const length = Math.max(0, ...series.map(values => values.length));
  for (let index = 0; index < length; index++) {
    let sum = 0;
    for (const values of series) {
      const value = values[index];
      if (value === null || value === undefined || !Number.isFinite(value) || value < 0) continue;
      if (stacked) sum = Math.min(Number.MAX_VALUE, sum + value);
      else largest = Math.max(largest, value);
    }
    if (stacked) largest = Math.max(largest, sum);
  }
  return largest;
}

/** Readable ceiling with four intervals; counts always have whole-number ticks. */
export function chartCeiling(extent: number, money = false) {
  if (!Number.isFinite(extent) || extent <= 0) return money ? 1 : 4;
  const rawStep = extent / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const fraction = rawStep / magnitude;
  const nice = [1, 2, 2.5, 5, 10].find(value => value >= fraction) ?? 10;
  const step = Math.max(money ? 0.01 : 1, nice * magnitude);
  const ceiling = step * 4;
  return Number.isFinite(ceiling) ? Math.max(extent, ceiling) : extent;
}

/** Browser-memory store: survives chart unmounts during loading and report tab changes.
 * No records, identities or values are persisted to browser storage or written during SSR.
 */
export function createChartScaleStore() {
  const ceilings = new Map<string, number>();
  const listeners = new Set<() => void>();
  return {
    get: (key: string) => ceilings.get(key) ?? 0,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set(key: string, value: number, reset = false) {
      const previous = ceilings.get(key) ?? 0;
      const next = reset ? value : Math.max(previous, value);
      if (previous === next) return;
      ceilings.set(key, next);
      for (const listener of listeners) listener();
    },
  };
}
